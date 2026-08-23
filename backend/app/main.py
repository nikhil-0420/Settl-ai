# backend/app/main.py
import json
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

DATA_DIR = Path(__file__).parent.parent / "data"

app = FastAPI(title="Settl.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite's default dev port
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_summary():
    with open(DATA_DIR / "reconciliation_summary.json") as f:
        return json.load(f)

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

    result = {"order_id": order_id}

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

@app.get("/")
def root():
    return {"status": "Settl.ai API running"}