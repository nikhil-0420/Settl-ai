"""
Settl.ai Q&A agent — answers questions grounded in retrieved reconciliation
records, with forced citation and explicit refusal when the data doesn't
support a confident answer.
"""
import os
import re
from pathlib import Path

from google import genai
from dotenv import load_dotenv
from audit import log_decision
from embeddings import search
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

load_dotenv(Path(__file__).parent.parent / ".env")
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

MODEL = "gemini-3.5-flash-lite" 

GEMINI_TIMEOUT_SECONDS = 15
_llm_executor = ThreadPoolExecutor(max_workers=4)

ORDER_ID_PATTERN = re.compile(r"order_\w+")

SYSTEM_PROMPT = """You are a reconciliation assistant for Settl.ai. You answer
questions about settlement records using ONLY the record data provided below.

Rules you must follow exactly:
1. Every factual claim in your answer must reference a specific order_id from
   the provided records. Cite it like this: [order_XXXXXX]. This bracket
   format is required every single time you mention an order_id — never
   write an order_id without brackets around it.
2. If the provided records do not contain enough information to answer
   confidently, say exactly: "I don't have enough information to answer that
   confidently." Do not guess or make up a record ID.
3. Never state a status, amount, or reason that isn't explicitly present in
   the records shown to you.
4. Keep answers to 2-3 sentences.

Example of the required citation format:
Question: Why didn't order_200099A reconcile?
Answer: Order [order_200099A] shows a timing gap because the bank credit
arrived 8 days after settlement, outside the normal window.

Example with multiple orders:
Question: Which orders have duplicate entries?
Answer: [order_200030S] and [order_200007L] each appear as duplicate
settlement entries for the same order.
"""

REFERENTIAL_PATTERN = re.compile(
    r"\b(it|its|that|this|those|these|that one|that order|the same|their)\b",
    re.IGNORECASE
)
STATUS_KEYWORDS = ["tds", "gst", "fee", "duplicate", "timing", "partial", "phantom", "unmatched", "clean"]
BROAD_QUERY_KEYWORDS = ["total", "count", "overall", "summary", "how many", "match rate", "all orders", "breakdown"]


def needs_history_context(question):
    """A follow-up only needs prior-turn context if it doesn't already name
    its own subject. A question with an explicit order_id, a known status
    keyword, or a broad/aggregate keyword is self-contained. Otherwise, if
    history exists, assume it's a continuation — implicit follow-ups
    ("what's the confidence score?") don't always use a pronoun, so we can't
    rely on pronoun-matching alone."""
    if ORDER_ID_PATTERN.search(question):
        return False
    q = question.lower()
    if any(kw in q for kw in STATUS_KEYWORDS):
        return False
    if any(kw in q for kw in BROAD_QUERY_KEYWORDS):
        return False
    return True


def ask(question, k=5, simulate_outage=False, history=None):
    history = history[-1:] if history else []
    use_history = bool(history) and needs_history_context(question)

    search_query = question
    if use_history:
        last_turn = history[-1]
        search_query = f"{last_turn['question']} {last_turn['answer']} {question}"

    retrieved = search(search_query, k=k)
    context = "\n".join(f"- {r['document']}" for r in retrieved)
    retrieved_ids = {r["id"] for r in retrieved}

    # live-inducible failure: an env var or explicit flag kills the LLM call
    # mid-request, so the fallback can be demonstrated on camera, not just described
    if simulate_outage or os.environ.get("SIMULATE_LLM_OUTAGE") == "1":
        result = {
            "question": question,
            "answer": "The reasoning service is unavailable right now, so I'm escalating this to a human reviewer rather than guessing.",
            "retrieved_ids": list(retrieved_ids),
            "cited_ids": [],
            "is_refusal": True,
            "valid_citations": None,
        }
        log_decision("outage_fallback", "Simulated LLM outage — escalated instead of guessing",
                      question=question, answer=result["answer"], is_refusal=True)
        return result

    history_section = ""
    if use_history:
        last_turn = history[-1]
        history_section = (
            f"\n\nPrevious exchange:\nQ: {last_turn['question']}\n"
            f"A: {last_turn['answer']}\n\n"
            f"If the current question below uses a pronoun or reference like "
            f"'it' or 'that one', it refers to the order_id discussed in the "
            f"previous exchange above — resolve it to that order_id, then "
            f"answer normally using ONLY the Records section, following the "
            f"same citation rules."
        )

    prompt = f"{SYSTEM_PROMPT}{history_section}\n\nRecords:\n{context}\n\nQuestion: {question}\n\nAnswer:"
    future = _llm_executor.submit(
    client.models.generate_content, model=MODEL, contents=prompt
    )
    try:
        response = future.result(timeout=GEMINI_TIMEOUT_SECONDS)
    except FutureTimeoutError:
        result = {
            "question": question,
            "answer": "The reasoning service is taking too long to respond, so I'm escalating this to a human reviewer rather than making you wait.",
            "retrieved_ids": list(retrieved_ids),
            "cited_ids": [],
            "is_refusal": True,
            "valid_citations": None,
        }
        log_decision("timeout_fallback", "Gemini call exceeded timeout — escalated instead of hanging",
                     question=question, answer=result["answer"], is_refusal=True)
        return result

    answer = response.text.strip()

    cited_ids = set(re.findall(r"\[(\w[\w_]*)\]", answer))
    is_refusal = "don't have enough information" in answer.lower()
    valid_citations = cited_ids.issubset(retrieved_ids) and len(cited_ids) > 0

    result = {
        "question": question,
        "answer": answer,
        "retrieved_ids": list(retrieved_ids),
        "cited_ids": list(cited_ids),
        "is_refusal": is_refusal,
        "valid_citations": valid_citations if not is_refusal else None,
    }

    log_decision(
        "refused" if is_refusal else "answered",
        f"valid_citations={result['valid_citations']}",
        question=question, answer=answer,
        cited_ids=list(cited_ids), is_refusal=is_refusal,
    )
    return result


if __name__ == "__main__":
    test_questions = [
        "Why didn't order_200036U reconcile cleanly?",
        "What's the capital of France?",  # deliberately unanswerable from this data
    ]
    for q in test_questions:
        result = ask(q)
        print(f"\nQ: {result['question']}")
        print(f"A: {result['answer']}")
        print(f"Refusal: {result['is_refusal']} | Valid citations: {result['valid_citations']} | Cited: {result['cited_ids']}")