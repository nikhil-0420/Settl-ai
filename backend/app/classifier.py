"""
Settl.ai exception classifier + confidence scoring.

Assigns a per-record confidence score (not a fixed constant per status) —
confidence reflects how far a record sits from its tolerance boundary, so a
borderline classification scores lower than an unambiguous one. Deterministic
severity tiers in generate_data.py guarantee real score variance across the
small seeded sample (see broke-log bug #5).

Run: python classifier.py — writes reconciliation_summary.json

"""

import json
from collections import defaultdict
from pathlib import Path
from matcher import run_matching, load_data, AMOUNT_TOLERANCE, FEE_TOLERANCE, DATE_WINDOW_DAYS, TDS_TOLERANCE

DATA_DIR = Path(__file__).parent.parent / "data"

def compute_confidence(status, row, bank_by_utr, ledger_by_order):
    """Confidence = how decisively the evidence supports this classification.
    Higher = further from the tolerance boundary (unambiguous). Lower = close
    to the edge (a human should double check it)."""

    if status == "clean_match":
        bank_row = bank_by_utr.get(row["utr"])
        if not bank_row:
            return 50
        amount_diff = abs(bank_row["credit_amount"] - row["net_amount"])
        ratio = amount_diff / AMOUNT_TOLERANCE if AMOUNT_TOLERANCE else 0
        return round(max(60, 100 - ratio * 40))

    if status == "partial_payment":
        bank_row = bank_by_utr.get(row["utr"])
        amount_diff = abs(bank_row["credit_amount"] - row["net_amount"]) if bank_row else 0
        excess_ratio = min((amount_diff - AMOUNT_TOLERANCE) / AMOUNT_TOLERANCE, 3) if AMOUNT_TOLERANCE else 0
        return round(min(60 + excess_ratio * 13, 99))

    if status == "fee_deduction_err":
        expected_fee = round(row["amount"] * 0.02)
        expected_tax = round(expected_fee * 0.18)
        fee_tax_diff = abs((row["fee"] + row["tax"]) - (expected_fee + expected_tax))
        excess_ratio = min((fee_tax_diff - FEE_TOLERANCE) / FEE_TOLERANCE, 5) if FEE_TOLERANCE else 0
        return round(min(65 + excess_ratio * 7, 99))

    if status == "tds_gst_mismatch":
        expected_tds = round(row["amount"] * 0.01)
        tds_diff = abs(row["tds"] - expected_tds)
        excess_ratio = min((tds_diff - TDS_TOLERANCE) / TDS_TOLERANCE, 5) if TDS_TOLERANCE else 0
        return round(min(65 + excess_ratio * 7, 99))

    if status == "timing_gap":
        bank_row = bank_by_utr.get(row["utr"])
        if not bank_row:
            return 60
        day_gap = (bank_row["value_date"] - row["settled_at"]).days
        window_position = (day_gap - 2) / (DATE_WINDOW_DAYS) if DATE_WINDOW_DAYS else 0
        return round(max(55, 90 - window_position * 25))

    if status == "duplicate":
        return 95

    if status == "unmatched":
        return 90

    if status == "ledger_missing":
       return 88

    if status == "ledger_mismatch":
       ledger_row = ledger_by_order.get(row["order_id"])
       ledger_diff = abs(ledger_row["expected_amount"] - row["amount"]) if ledger_row else 0
       excess_ratio = min((ledger_diff - AMOUNT_TOLERANCE) / AMOUNT_TOLERANCE, 3) if AMOUNT_TOLERANCE else 0
       return round(min(60 + excess_ratio * 13, 99))

    return 50

def build_summary(data_dir=None, write_file=True):
    data_dir = data_dir or DATA_DIR
    settlement, bank, ledger = load_data(data_dir)
    bank_by_utr = bank.set_index("utr").to_dict("index")
    ledger_by_order = ledger.set_index("order_id").to_dict("index")
    results = run_matching(data_dir)

    for r in results:
        row = settlement[settlement["settlement_id"] == r.get("settlement_id")]
        if not row.empty:
            r["confidence"] = compute_confidence(r["status"], row.iloc[0], bank_by_utr, ledger_by_order)
        else:
            r["confidence"] = compute_confidence(r["status"], {}, bank_by_utr, ledger_by_order)

    by_status = defaultdict(list)
    for r in results:
        by_status[r["status"]].append(r)

    total = len(results)
    clean = len(by_status.get("clean_match", []))

    summary = {
        "total_records": total,
        "match_rate": round(clean / total, 4) if total else 0,
        "breakdown": {
            status: {
                "count": len(items),
                "avg_confidence": round(sum(i["confidence"] for i in items) / len(items), 1),
            }
            for status, items in by_status.items()
        },
        "records": results,
    }

    if write_file:
        with open(data_dir / "reconciliation_summary.json", "w") as f:
            json.dump(summary, f, indent=2, default=str)

    print(f"Match rate: {summary['match_rate']:.1%}")
    print("Breakdown:", {k: v["count"] for k, v in summary["breakdown"].items()})
    return summary

if __name__ == "__main__":
    build_summary()