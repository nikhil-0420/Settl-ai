"""
Settl.ai FastAPI backend.

Endpoints:
  GET /              -> health check
  GET /match-summary -> total records, match rate, per-status breakdown
  GET /records       -> all records, optionally filtered by ?status=
  GET /records/{order_id} -> 3-way source comparison (settlement/bank/ledger)
                              for a single order
  POST /ask          -> Q&A agent, grounded + cited, with live outage simulation
  GET /audit-log      -> recent agent decisions with reasoning

Reads from reconciliation_summary.json (pre-computed by classifier.py) for
list/summary views, and from the raw CSVs directly for the record-detail
3-way comparison.

"""
import json
import sys
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))  # so uvicorn can resolve sibling imports (qa_agent, audit)

from qa_agent import ask
from audit import read_audit_log, log_decision
from resolutions import load_all as load_resolutions, get_resolution, resolve_order
from export import build_csv, build_pdf
from fastapi.responses import Response
from datetime import datetime, timezone

import shutil
import tempfile
from fastapi import UploadFile, File

from classifier import build_summary as build_summary_for

DATA_DIR = Path(__file__).parent.parent / "data"

app = FastAPI(title="Settl.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUIRED_COLUMNS = {
    "settlement_report.csv": {"settlement_id", "payment_id", "order_id", "amount", "fee", "tax", "tds", "net_amount", "settled_at", "utr", "method"},
    "bank_statement.csv": {"utr", "credit_amount", "value_date", "narration"},
    "internal_ledger.csv": {"order_id", "invoice_id", "expected_amount", "invoice_date", "status"},
}

def load_summary():
    with open(DATA_DIR / "reconciliation_summary.json") as f:
        return json.load(f)

def load_cycle_history():
    path = DATA_DIR / "cycle_history.json"
    if not path.exists():
        return []
    with open(path) as f:
        return json.load(f)

def validate_csv_columns(filename: str, content: bytes):
    import io
    header_line = content.split(b"\n", 1)[0].decode("utf-8-sig").strip()
    actual_columns = set(col.strip() for col in header_line.split(","))
    expected = REQUIRED_COLUMNS[filename]
    missing = expected - actual_columns
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"{filename} is missing required columns: {', '.join(sorted(missing))}",
        )

    
@app.get("/match-summary")
def match_summary():
    summary = load_summary()
    return {
        "total_records": summary["total_records"],
        "match_rate": summary["match_rate"],
        "breakdown": summary["breakdown"],
    }


@app.get("/records")
def list_records(status: str | None = None):
    summary = load_summary()
    records = summary["records"]
    if status:
        records = [r for r in records if r["status"] == status]
    resolutions = load_resolutions()
    records = [{**r, "resolved": r.get("order_id") in resolutions} for r in records]
    return {"count": len(records), "records": records}

@app.get("/records/{order_id}")
def record_detail(order_id: str):
    settlement = pd.read_csv(DATA_DIR / "settlement_report.csv")
    bank = pd.read_csv(DATA_DIR / "bank_statement.csv")
    ledger = pd.read_csv(DATA_DIR / "internal_ledger.csv")

    settlement_row = settlement[settlement["order_id"] == order_id]
    ledger_row = ledger[ledger["order_id"] == order_id]

    if settlement_row.empty and ledger_row.empty:
        raise HTTPException(status_code=404, detail=f"No record found for {order_id}")

    classified = load_summary().get("records", [])
    match = next((r for r in classified if r.get("order_id") == order_id), None)

    result = {
        "order_id": order_id,
        "classified_status": match["status"] if match else None,
        "confidence": match["confidence"] if match else None,
        "resolution": get_resolution(order_id),
    }

    if not settlement_row.empty:
        s = settlement_row.iloc[0].to_dict()
        result["settlement"] = s
        bank_row = bank[bank["utr"] == s["utr"]]
        result["bank"] = bank_row.iloc[0].to_dict() if not bank_row.empty else None
    else:
        result["settlement"] = None
        result["bank"] = None

    result["ledger"] = ledger_row.iloc[0].to_dict() if not ledger_row.empty else None

    return result


class HistoryTurn(BaseModel):
    question: str
    answer: str


class AskRequest(BaseModel):
    question: str
    history: list[HistoryTurn] | None = None


@app.post("/ask")
def ask_question(body: AskRequest, simulate_outage: bool = False):
    history = [turn.dict() for turn in body.history] if body.history else None
    return ask(body.question, simulate_outage=simulate_outage, history=history)


class ResolveRequest(BaseModel):
    note: str


@app.post("/records/{order_id}/resolve")
def resolve_record(order_id: str, body: ResolveRequest):
    entry = resolve_order(order_id, body.note)
    log_decision(
        "manual_resolution",
        detail=f"Order {order_id} marked resolved: {body.note}",
        answer=body.note,
        cited_ids=[order_id],
        is_refusal=False,
    )
    return {"order_id": order_id, "resolution": entry}


@app.get("/export/csv")
def export_csv():
    summary = load_summary()
    resolutions = load_resolutions()
    content = build_csv(summary, resolutions)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=settl_ai_reconciliation.csv"},
    )


@app.get("/export/pdf")
def export_pdf():
    summary = load_summary()
    resolutions = load_resolutions()
    buf = build_pdf(summary, resolutions)
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=settl_ai_reconciliation.pdf"},
    )

@app.get("/trend")
def trend():
    history = load_cycle_history()
    current_summary = load_summary()
    current_cycle = {
        "cycle": f"Cycle {len(history) + 1}",
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total_records": current_summary["total_records"],
        "match_rate": current_summary["match_rate"],
        "breakdown": {k: v.get("count", 0) for k, v in current_summary["breakdown"].items()},
    }
    return {"cycles": history + [current_cycle]}

@app.get("/audit-log")
def audit_log(limit: int = 50):
    return {"entries": read_audit_log(limit)}


@app.get("/")
def root():
    return {"status": "Settl.ai API running"}

@app.post("/upload")
async def upload_and_reconcile(
    settlement_report: UploadFile = File(...),
    bank_statement: UploadFile = File(...),
    internal_ledger: UploadFile = File(...),
):
    files = {
        "settlement_report.csv": settlement_report,
        "bank_statement.csv": bank_statement,
        "internal_ledger.csv": internal_ledger,
    }

    contents = {}
    for filename, upload in files.items():
        content = await upload.read()
        validate_csv_columns(filename, content)
        contents[filename] = content

    temp_dir = Path(tempfile.mkdtemp(prefix="settl_upload_"))
    try:
        for filename, content in contents.items():
            with open(temp_dir / filename, "wb") as f:
                f.write(content)

        summary = build_summary_for(data_dir=temp_dir, write_file=False)
        return summary
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Couldn't process this data: {e}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)