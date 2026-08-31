"""
Settl.ai embeddings + retrieval layer.

Builds a Chroma vector index over all reconciliation records using the
Gemini API for embeddings (not a local model) and exposes search() for the
Q&A agent.

Previously used a local sentence-transformers model (all-MiniLM-L6-v2),
which pulls in torch. On Render's free tier (~512MB RAM), that combination
silently OOM-killed the process on the very first /ask request — GET
endpoints never touched this file so they worked fine, masking the problem.
No Python traceback appeared because the OS kills the process directly, not
a catchable exception. Switched to Gemini's embed_content API to remove the
heavy local dependency entirely. See broke-log bug #9.

Hybrid retrieval: semantic vector search alone doesn't reliably surface
arbitrary alphanumeric identifiers (an order_id has no real semantic
meaning), so search() checks the query for an explicit order_id first and
does an exact metadata lookup before falling back to (or padding with)
semantic results. See broke-log bug #7 for how this was found.

The Chroma client and embedding function are created once per process
(lazily, on first search) rather than per-call — repeated PersistentClient
creation against the same path races Chroma's internal teardown under
concurrent requests and crashes. See broke-log bug #8.
"""

import json
import os
import re
from pathlib import Path

import chromadb
from google import genai
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

DATA_DIR = Path(__file__).parent.parent / "data"
CHROMA_DIR = Path(__file__).parent.parent / "chroma_db"
ORDER_ID_PATTERN = re.compile(r"order_\d+[A-Za-z]?", re.IGNORECASE)

EMBED_MODEL = "gemini-embedding-001"

_genai_client = None
_search_client = None
_search_collection = None


def _get_genai_client():
    """Lazy — must not run at module import time. qa_agent.py imports this
    module before it calls load_dotenv() itself, so reading the API key at
    import time would fail locally (Render sets the real env var directly,
    so it's only a local-dev ordering issue, but lazy init sidesteps it
    either way)."""
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _genai_client


class GeminiEmbeddingFunction:
    """Chroma-compatible embedding function backed by the Gemini API.
    gemini-embedding-001 returns one embedding per input string in a batch
    call, matching Chroma's expected (list[str] -> list[list[float]])
    contract directly — gemini-embedding-2 aggregates multiple inputs into
    a single vector instead, which would not work here."""

    def __call__(self, input):
        client = _get_genai_client()
        result = client.models.embed_content(model=EMBED_MODEL, contents=list(input))
        return [e.values for e in result.embeddings]


_embedding_fn = GeminiEmbeddingFunction()


def record_to_text(r):
    parts = [f"Order {r.get('order_id') or 'unknown'}", f"status: {r['status']}"]
    if r.get("utr"):
        parts.append(f"UTR {r['utr']}")
    if r.get("settlement_id"):
        parts.append(f"settlement {r['settlement_id']}")
    parts.append(f"confidence {r.get('confidence', 'n/a')}")
    explanations = {
        "clean_match": "fully reconciled with no issues",
        "timing_gap": "bank credit arrived later than the normal T+2 settlement window",
        "partial_payment": "bank credited less than the expected settlement amount",
        "fee_deduction_err": "settlement fee does not match the standard 2% plus GST calculation",
        "tds_gst_mismatch": "TDS deduction does not match the expected 1% calculation",
        "duplicate": "this settlement entry appears more than once for the same order",
        "phantom_bank": "bank credit exists with no matching settlement or ledger record",
        "phantom_ledger": "ledger invoice exists with no matching settlement record",
        "unmatched": "could not be reconciled against any bank record",
    }
    parts.append(explanations.get(r["status"], ""))
    return ", ".join(p for p in parts if p)


def build_index():
    with open(DATA_DIR / "reconciliation_summary.json") as f:
        summary = json.load(f)

    records = summary["records"]

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    try:
        client.delete_collection("reconciliation_records")
    except Exception:
        pass
    collection = client.create_collection(
        name="reconciliation_records", embedding_function=_embedding_fn
    )

    ids, documents, metadatas = [], [], []
    seen_keys = set()
    for i, r in enumerate(records):
        base_key = r.get("order_id") or r.get("utr") or f"row_{i}"
        key = str(base_key)
        if key in seen_keys:
            key = f"{base_key}__{r.get('settlement_id', i)}"
        seen_keys.add(key)
        ids.append(key)
        documents.append(record_to_text(r))
        metadatas.append({k: str(v) for k, v in r.items() if v is not None})

    collection.add(ids=ids, documents=documents, metadatas=metadatas)
    print(f"Indexed {len(ids)} records into Chroma at {CHROMA_DIR}")
    return collection


def _get_search_collection():
    """Lazily create the Chroma client + embedding function exactly once per
    process. Fixes a real bug where per-call PersistentClient creation
    against the same path crashed under FastAPI's concurrent request
    handling (KeyError / AttributeError from Chroma's internal teardown)."""
    global _search_client, _search_collection
    if _search_collection is None:
        _search_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        _search_collection = _search_client.get_collection(
            "reconciliation_records", embedding_function=_embedding_fn
        )
    return _search_collection


def search(query, k=5):
    collection = _get_search_collection()

    # if the query names a specific order_id, try exact match first —
    # semantic embeddings don't reliably retrieve arbitrary alphanumeric IDs
    id_match = ORDER_ID_PATTERN.search(query)
    if id_match:
        target_id = id_match.group(0)
        exact = collection.get(where={"order_id": target_id})
        if exact["ids"]:
            results_list = [
                {"id": id_, "document": doc, "metadata": meta}
                for id_, doc, meta in zip(exact["ids"], exact["documents"], exact["metadatas"])
            ]
            if len(results_list) < k:
                semantic = collection.query(query_texts=[query], n_results=k)
                seen = {r["id"] for r in results_list}
                for id_, doc, meta in zip(
                    semantic["ids"][0], semantic["documents"][0], semantic["metadatas"][0]
                ):
                    if id_ not in seen and len(results_list) < k:
                        results_list.append({"id": id_, "document": doc, "metadata": meta})
            return results_list[:k]

    results = collection.query(query_texts=[query], n_results=k)
    return [
        {"id": id_, "document": doc, "metadata": meta}
        for id_, doc, meta in zip(
            results["ids"][0], results["documents"][0], results["metadatas"][0]
        )
    ]


if __name__ == "__main__":
    build_index()
    print("\nTest query: 'orders with fee deduction errors'")
    for r in search("orders with fee deduction errors", k=3):
        print(" ", r["id"], "->", r["document"])
    print("\nTest query: 'TDS mismatches'")
    for r in search("TDS mismatches", k=3):
        print(" ", r["id"], "->", r["document"])