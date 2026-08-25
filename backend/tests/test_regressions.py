"""
Regression tests — each one encodes a real bug from the build's broke log,
so it can't silently recur.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "app"))

import pandas as pd
from matcher import classify_settlement_row, AMOUNT_TOLERANCE, FEE_TOLERANCE, TDS_TOLERANCE
from generate_data import OUT_DIR

def test_data_dir_resolves_regardless_of_cwd():
    """Broke log #1: OUT_DIR used to be a plain string relative to the shell's
    cwd, which crashed when the script was run from a different directory
    than expected. OUT_DIR must now be an absolute, __file__-anchored path."""
    assert OUT_DIR.is_absolute(), "OUT_DIR must be anchored to the script file, not the shell's cwd"


def _base_row(utr="utr_test", amount=100000):
    """A settlement row with mathematically correct fee/tax/tds for its amount."""
    fee = round(amount * 0.02)
    tax = round(fee * 0.18)
    tds = round(amount * 0.01)
    net = amount - fee - tax - tds
    return pd.Series({
        "settlement_id": "setl_test",
        "payment_id": "pay_test",
        "order_id": "order_test",
        "amount": amount,
        "fee": fee,
        "tax": tax,
        "tds": tds,
        "net_amount": net,
        "settled_at": pd.Timestamp("2026-08-01"),
        "utr": utr,
        "method": "upi",
    })


def test_fee_error_detected_even_when_amount_matches():
    """Broke log #2: a wrong fee that was silently baked into net_amount used to
    pass as clean_match because the fee-check only ran inside the
    amount-match branch. A record whose bank credit matches its (wrong)
    net_amount exactly must still be caught as fee_deduction_err."""
    row = _base_row(amount=100000)
    wrong_fee = round(100000 * 0.04)  # should be 2000 (2%), this is 4000
    row["fee"] = wrong_fee
    row["net_amount"] = 100000 - wrong_fee - row["tax"] - row["tds"]

    bank_by_utr = {row["utr"]: {"credit_amount": row["net_amount"], "value_date": pd.Timestamp("2026-08-03")}}

    status = classify_settlement_row(row, bank_by_utr, {})
    assert status == "fee_deduction_err"


def test_fee_tolerance_is_tighter_than_amount_tolerance():
    """Broke log #3: fee correctness and amount correctness used to share one
    tolerance constant, which let a small-but-real fee error slip under the
    looser amount tolerance. FEE_TOLERANCE must remain strictly tighter than
    AMOUNT_TOLERANCE so this can't happen again."""
    assert FEE_TOLERANCE < AMOUNT_TOLERANCE
    assert TDS_TOLERANCE < AMOUNT_TOLERANCE


def test_small_percentage_shortfall_still_exceeds_flat_tolerance():
    """Broke log #5: a percentage-based shortfall (e.g. 3.5%) could fall under
    a flat-rupee AMOUNT_TOLERANCE for small transactions, making a real
    mismatch invisible. At the smallest realistic transaction size, even the
    lowest seeded severity tier must still exceed the flat tolerance."""
    smallest_gross = 50000  # ₹500, matches rand_amount()'s floor
    lowest_severity_fraction = 0.12  # matches SEVERITY_LEVELS["partial_payment"][0]
    shortfall = round(smallest_gross * lowest_severity_fraction)
    assert shortfall > AMOUNT_TOLERANCE, (
        "lowest severity tier must produce a shortfall bigger than the flat "
        "tolerance even at the smallest transaction size"
    )