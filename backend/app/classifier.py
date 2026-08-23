import json
from collections import defaultdict
from pathlib import Path
from matcher import run_matching, load_data, AMOUNT_TOLERANCE, FEE_TOLERANCE

DATA_DIR = Path(__file__).parent.parent / "data"

def compute_confidence(status, row, bank_by_utr):
    """Confidence = how decisively the evidence supports this classification.
    100 = dead-on match / obviously wrong. Lower = closer to a tolerance boundary,
    i.e. a human should double check it."""
    if status == "clean_match":
        bank_row = bank_by_utr.get(row["utr"])
        if not bank_row:
            return 50
        amount_diff = abs(bank_row["credit_amount"] - row["net_amount"])
        # closer to 0 diff = higher confidence; closer to tolerance edge = lower
        ratio = amount_diff / AMOUNT_TOLERANCE if AMOUNT_TOLERANCE else 0
        return round(max(60, 100 - ratio * 40))

    if status in ("fee_deduction_err", "partial_payment", "unmatched"):
        return 90  # these fired because the mismatch clearly exceeded tolerance

    if status == "timing_gap":
        return 75  # plausible but worth a human glance

    if status == "duplicate":
        return 95  # duplicates are structurally obvious, not a judgment call

    return 50  # phantom_bank / phantom_ledger — always flag for review

def build_summary():
    settlement, bank, ledger = load_data()
    bank_by_utr = bank.set_index("utr").to_dict("index")
    results = run_matching()

    for r in results:
        row = settlement[settlement["settlement_id"] == r.get("settlement_id")]
        if not row.empty:
            r["confidence"] = compute_confidence(r["status"], row.iloc[0], bank_by_utr)
        else:
            r["confidence"] = compute_confidence(r["status"], {}, bank_by_utr)

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

    with open(DATA_DIR / "reconciliation_summary.json", "w") as f:
        json.dump(summary, f, indent=2, default=str)

    print(f"Match rate: {summary['match_rate']:.1%}")
    print("Breakdown:", {k: v["count"] for k, v in summary["breakdown"].items()})
    return summary

if __name__ == "__main__":
    build_summary()