"""
Settl.ai — synthetic multi-cycle trend data generator.

Generates 4 historical settlement cycles as aggregate-only records (no raw
settlement/bank/ledger rows) purely to power the trend view. The 5th, current
cycle is NOT generated here — the backend reads it live from
reconciliation_summary.json, so the most recent point on the trend always
reflects real matcher output, not synthetic data.

Cycle 3 seeds a deliberate TDS/GST mismatch spike (as if a Section 194-O
rate change landed and settlement processing hadn't caught up yet), tapering
back down in Cycle 4 — a realistic, explainable anomaly rather than a smooth
invented trend line.
"""
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

OUT_PATH = Path(__file__).parent.parent / "data" / "cycle_history.json"

BASELINE = {
    "clean_match": 67,
    "duplicate": 4,
    "tds_gst_mismatch": 3,
    "timing_gap": 3,
    "partial_payment": 3,
    "fee_deduction_err": 3,
    "phantom_bank": 2,
    "phantom_ledger": 2,
}


def jitter(count, spread=1):
    return max(0, count + random.randint(-spread, spread))


def build_cycle(label, date, breakdown):
    total = sum(breakdown.values())
    clean = breakdown.get("clean_match", 0)
    return {
        "cycle": label,
        "date": date,
        "total_records": total,
        "match_rate": round(clean / total, 4),
        "breakdown": breakdown,
    }


def main():
    today = datetime.now()
    cycles = []

    for i in range(1, 5):  # cycles 1-4; cycle 5 is the live current cycle
        breakdown = {k: jitter(v) for k, v in BASELINE.items()}

        if i == 3:
            breakdown["tds_gst_mismatch"] = BASELINE["tds_gst_mismatch"] + 6
            breakdown["clean_match"] -= 6
        elif i == 4:
            breakdown["tds_gst_mismatch"] = BASELINE["tds_gst_mismatch"] + 2
            breakdown["clean_match"] -= 2

        breakdown["clean_match"] = max(breakdown["clean_match"], 1)
        date = (today - timedelta(days=7 * (5 - i))).strftime("%Y-%m-%d")
        cycles.append(build_cycle(f"Cycle {i}", date, breakdown))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(cycles, f, indent=2)

    print(f"Wrote {len(cycles)} historical cycles to {OUT_PATH}")


if __name__ == "__main__":
    main()