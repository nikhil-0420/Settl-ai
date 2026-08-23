"""
Settl.ai matching engine.

3-pass deterministic classification against the synthetic 3-source dataset:
exact fee/TDS arithmetic checks (independent of amount matching — see broke-
log bug #2), amount-tolerance fuzzy pass, then date-window pass. Self-grades
against ground_truth.json for exact, defensible accuracy — not estimated.

Run: python matcher.py

"""

import pandas as pd
import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
AMOUNT_TOLERANCE = 5000          # paise (~₹50) — treat as "close enough" before flagging
FEE_TOLERANCE = 100              # paise (~₹1) — fee/tax is arithmetic, should be exact
DATE_WINDOW_DAYS = 12             # beyond T+2 norm, still "timing_gap" not "unmatched"
TDS_TOLERANCE = 100              # paise (~₹1) — TDS is arithmetic, should be exact

def load_data():
    settlement = pd.read_csv(DATA_DIR / "settlement_report.csv", parse_dates=["settled_at"])
    bank = pd.read_csv(DATA_DIR / "bank_statement.csv", parse_dates=["value_date"])
    ledger = pd.read_csv(DATA_DIR / "internal_ledger.csv", parse_dates=["invoice_date"])
    return settlement, bank, ledger

# in classify_settlement_row(), replace the whole function body with:
def classify_settlement_row(row, bank_by_utr, ledger_by_order):
    bank_row = bank_by_utr.get(row["utr"])
    if bank_row is None:
        return "unmatched"

    expected_fee = round(row["amount"] * 0.02)
    expected_tax = round(expected_fee * 0.18)
    fee_tax_diff = abs((row["fee"] + row["tax"]) - (expected_fee + expected_tax))
    if fee_tax_diff >   FEE_TOLERANCE:
        return "fee_deduction_err"
    
    expected_tds = round(row["amount"] * 0.01)
    tds_diff = abs(row["tds"] - expected_tds)
    if tds_diff > TDS_TOLERANCE:
        return "tds_gst_mismatch"

    amount_diff = abs(bank_row["credit_amount"] - row["net_amount"])
    day_gap = (bank_row["value_date"] - row["settled_at"]).days

    if amount_diff > AMOUNT_TOLERANCE:
        return "partial_payment"
    if 2 < day_gap <= DATE_WINDOW_DAYS + 2:
        return "timing_gap"
    if day_gap > DATE_WINDOW_DAYS + 2:
        return "unmatched"
    return "clean_match"

def run_matching():
    settlement, bank, ledger = load_data()

    bank_by_utr = bank.set_index("utr").to_dict("index")
    ledger_by_order = ledger.set_index("order_id").to_dict("index")

    # flag duplicates: same order_id appearing >1 time in settlement report
    dup_order_ids = set(settlement["order_id"][settlement["order_id"].duplicated(keep=False)])

    results = []
    for _, row in settlement.iterrows():
        if row["order_id"] in dup_order_ids:
            status = "duplicate"
        else:
            status = classify_settlement_row(row, bank_by_utr, ledger_by_order)
        results.append({
            "order_id": row["order_id"],
            "settlement_id": row["settlement_id"],
            "utr": row["utr"],
            "status": status,
        })

    matched_orders = {r["order_id"] for r in results}

    # orphan bank rows (utr not in settlement at all)
    settlement_utrs = set(settlement["utr"])
    for _, row in bank.iterrows():
        if row["utr"] not in settlement_utrs:
            results.append({"order_id": None, "settlement_id": None, "utr": row["utr"], "status": "phantom_bank"})

    # orphan ledger rows (order_id not in settlement at all)
    settlement_orders = set(settlement["order_id"])
    for _, row in ledger.iterrows():
        if row["order_id"] not in settlement_orders:
            results.append({"order_id": row["order_id"], "settlement_id": None, "utr": None, "status": "phantom_ledger"})

    return results

def self_grade(results):
    with open(DATA_DIR / "ground_truth.json") as f:
        truth = json.load(f)

    correct, total, mismatches = 0, 0, []
    for r in results:
        key = r["order_id"] or r["utr"]
        if key not in truth:
            continue
        total += 1
        expected = truth[key]["type"]
        if r["status"] == expected:
            correct += 1
        else:
            mismatches.append((key, expected, r["status"]))

    print(f"Accuracy: {correct}/{total} = {correct/total:.1%}")
    if mismatches:
        print("Mismatches (key, expected, got):")
        for m in mismatches:
            print(" ", m)

if __name__ == "__main__":
    results = run_matching()
    self_grade(results)