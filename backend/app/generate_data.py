"""
Settl.ai — synthetic data generator

Produces three sources that mimic real Razorpay-style reconciliation inputs:
  1. settlement_report.csv  -- Razorpay settlement lines (real field names:
     settlement_id, payment_id, order_id, amount, fee, tax, settled_at, utr, method)
  2. bank_statement.csv     -- bank-side credits referencing UTR
  3. internal_ledger.csv    -- merchant's own invoice/order records

Deliberately seeds mismatch types so we have ground truth to self-grade the
matching engine and the Q&A agent against:
  - clean_match      : reconciles perfectly across all 3 sources
  - timing_gap       : bank credit lands >2 days after settlement (T+2 norm)
  - partial_payment  : bank credit is less than the settlement net amount
  - fee_deduction_err: settlement fee/tax doesn't net correctly against ledger
  - duplicate        : same payment appears twice in the settlement report
  - phantom          : record exists in one source with no counterpart anywhere

Run: python generate_data.py
Outputs land in backend/data/
"""

import csv
import json
import random
from datetime import datetime, timedelta

random.seed(42)  # reproducible — needed so ground truth stays valid across reruns

N_RECORDS = 85
OUT_DIR = "../data"

METHODS = ["card", "upi", "netbanking", "wallet"]
BASE_DATE = datetime(2026, 8, 1)


def rand_amount():
    # amounts in paise, like Razorpay's real API (smallest currency unit)
    return random.randint(50000, 500000)  # ₹500 – ₹5000


def gen_ids(i):
    return {
        "payment_id": f"pay_{100000 + i}{random.choice('ABCDEFGHJK')}",
        "order_id": f"order_{200000 + i}{random.choice('LMNPQRSTUV')}",
        "settlement_id": f"setl_{300000 + i}{random.choice('WXYZABCDEF')}",
    }


def make_record(i, mismatch_type):
    ids = gen_ids(i)
    created = BASE_DATE + timedelta(days=random.randint(0, 20))
    gross = rand_amount()
    fee = round(gross * 0.02)          # Razorpay MDR ~2%
    tax = round(fee * 0.18)            # 18% GST on the fee
    net = gross - fee - tax
    utr = f"{int(created.timestamp())}{random.choice('abcdxyz')}{i}"
    method = random.choice(METHODS)

    settlement_row = {
        "settlement_id": ids["settlement_id"],
        "payment_id": ids["payment_id"],
        "order_id": ids["order_id"],
        "amount": gross,
        "fee": fee,
        "tax": tax,
        "net_amount": net,
        "settled_at": created.strftime("%Y-%m-%d"),
        "utr": utr,
        "method": method,
    }

    bank_row = {
        "utr": utr,
        "credit_amount": net,
        "value_date": (created + timedelta(days=2)).strftime("%Y-%m-%d"),  # T+2 norm
        "narration": f"NEFT-RAZORPAY-{utr}",
    }

    ledger_row = {
        "order_id": ids["order_id"],
        "invoice_id": f"INV-{400000 + i}",
        "expected_amount": gross,
        "invoice_date": created.strftime("%Y-%m-%d"),
        "status": "open",
    }

    reason = None

    if mismatch_type == "timing_gap":
        # bank credit lands much later than T+2 (e.g. bank holiday backlog)
        bank_row["value_date"] = (created + timedelta(days=random.randint(6, 12))).strftime("%Y-%m-%d")
        reason = "timing_gap"

    elif mismatch_type == "partial_payment":
        shortfall = round(net * random.uniform(0.2, 0.5))
        bank_row["credit_amount"] = net - shortfall
        reason = "partial_payment"

    elif mismatch_type == "fee_deduction_err":
        # settlement report shows a fee that doesn't match the standard 2%+18% GST calc
        wrong_fee = round(gross * random.uniform(0.03, 0.05))
        settlement_row["fee"] = wrong_fee
        settlement_row["net_amount"] = gross - wrong_fee - tax
        bank_row["credit_amount"] = settlement_row["net_amount"]
        reason = "fee_deduction_err"

    elif mismatch_type == "duplicate":
        reason = "duplicate"  # handled by caller (emits the row twice)

    elif mismatch_type == "phantom_bank":
        # bank credit with no settlement/ledger counterpart at all
        reason = "phantom_bank"

    elif mismatch_type == "phantom_ledger":
        # ledger invoice raised but never paid / no settlement
        reason = "phantom_ledger"

    return settlement_row, bank_row, ledger_row, reason, ids


def main():
    settlement_rows, bank_rows, ledger_rows = [], [], []
    ground_truth = {}

    # decide mismatch plan: majority clean, rest spread across mismatch types
    n_mismatch = max(8, round(N_RECORDS * 0.22))
    mismatch_types = (
        ["timing_gap"] * 3
        + ["partial_payment"] * 3
        + ["fee_deduction_err"] * 3
        + ["duplicate"] * 2
        + ["phantom_bank"] * 2
        + ["phantom_ledger"] * 2
    )
    random.shuffle(mismatch_types)
    mismatch_types = mismatch_types[:n_mismatch]
    plan = ["clean"] * (N_RECORDS - n_mismatch) + mismatch_types
    random.shuffle(plan)

    for i, mtype in enumerate(plan):
        if mtype == "phantom_bank":
            # only a bank row, no settlement/ledger
            ids = gen_ids(i)
            created = BASE_DATE + timedelta(days=random.randint(0, 20))
            amt = rand_amount()
            utr = f"{int(created.timestamp())}orphan{i}"
            bank_rows.append({
                "utr": utr,
                "credit_amount": amt,
                "value_date": (created + timedelta(days=2)).strftime("%Y-%m-%d"),
                "narration": f"NEFT-UNKNOWN-{utr}",
            })
            ground_truth[utr] = {"type": "phantom_bank", "order_id": None}
            continue

        if mtype == "phantom_ledger":
            ids = gen_ids(i)
            created = BASE_DATE + timedelta(days=random.randint(0, 20))
            ledger_rows.append({
                "order_id": ids["order_id"],
                "invoice_id": f"INV-{400000 + i}",
                "expected_amount": rand_amount(),
                "invoice_date": created.strftime("%Y-%m-%d"),
                "status": "open",
            })
            ground_truth[ids["order_id"]] = {"type": "phantom_ledger", "order_id": ids["order_id"]}
            continue

        settlement_row, bank_row, ledger_row, reason, ids = make_record(i, mtype if mtype != "clean" else None)
        settlement_rows.append(settlement_row)
        bank_rows.append(bank_row)
        ledger_rows.append(ledger_row)

        if mtype == "duplicate":
            # emit the settlement row a second time with a new settlement_id (real-world dup scenario)
            dup = dict(settlement_row)
            dup["settlement_id"] = f"setl_{500000 + i}DUP"
            settlement_rows.append(dup)

        ground_truth[ids["order_id"]] = {
            "type": reason or "clean_match",
            "order_id": ids["order_id"],
            "utr": bank_row["utr"],
        }

    with open(f"{OUT_DIR}/settlement_report.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(settlement_rows[0].keys()))
        w.writeheader()
        w.writerows(settlement_rows)

    with open(f"{OUT_DIR}/bank_statement.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(bank_rows[0].keys()))
        w.writeheader()
        w.writerows(bank_rows)

    with open(f"{OUT_DIR}/internal_ledger.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(ledger_rows[0].keys()))
        w.writeheader()
        w.writerows(ledger_rows)

    with open(f"{OUT_DIR}/ground_truth.json", "w") as f:
        json.dump(ground_truth, f, indent=2)

    print(f"settlement_report.csv : {len(settlement_rows)} rows")
    print(f"bank_statement.csv    : {len(bank_rows)} rows")
    print(f"internal_ledger.csv   : {len(ledger_rows)} rows")
    print(f"ground_truth.json     : {len(ground_truth)} keys")
    from collections import Counter
    print("Mismatch type breakdown:", Counter(v["type"] for v in ground_truth.values()))


if __name__ == "__main__":
    main()
