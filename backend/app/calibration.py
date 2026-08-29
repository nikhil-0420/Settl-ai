"""
Settl.ai confidence severity-tracking validation.

Standard "calibration curve" (predicted confidence vs. empirical accuracy)
doesn't apply here — the matcher is 100% accurate against ground truth, so
every confidence bucket would trivially show 100% accuracy and prove
nothing.

What compute_confidence() actually claims (per its own docstring) is:
"further from the tolerance boundary = more unambiguous = higher confidence."
That claim IS checkable, using the real seeded deviation magnitude computed
directly from the raw data (not a synthetic label) as ground truth.

For each status type with a graduated severity dimension, this script:
  1. Recomputes the real deviation magnitude behind each record (e.g. how
     far the fee is off from the correct 2%, how many days late a bank
     credit landed) directly from the source CSVs — not from a stored label.
  2. Checks Spearman rank correlation between that real deviation and the
     record's confidence score.
  3. Reports whether the correlation direction matches what the formula
     claims to do (partial_payment/fee_deduction_err/tds_gst_mismatch:
     bigger deviation -> higher confidence, since it's less ambiguous;
     timing_gap: bigger day gap -> lower confidence, since it's closer to
     tipping into "unmatched").

Also renders a scatter plot (deviation magnitude vs. confidence, one panel
per status) as a visual for the writeup.

Run: python app/calibration.py
"""
import json
import math
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent.parent / "data"

EXPECTED_DIRECTION = {
    "partial_payment": "positive",
    "fee_deduction_err": "positive",
    "tds_gst_mismatch": "positive",
    "timing_gap": "negative",
}


def spearman_correlation(x, y):
    """Pure-python Spearman rank correlation — avoids adding scipy as a
    dependency for one check."""
    n = len(x)
    if n < 2:
        return None

    def rank(values):
        sorted_idx = sorted(range(len(values)), key=lambda i: values[i])
        ranks = [0] * len(values)
        i = 0
        while i < len(sorted_idx):
            j = i
            while j + 1 < len(sorted_idx) and values[sorted_idx[j + 1]] == values[sorted_idx[i]]:
                j += 1
            avg_rank = (i + j) / 2 + 1
            for k in range(i, j + 1):
                ranks[sorted_idx[k]] = avg_rank
            i = j + 1
        return ranks

    rx, ry = rank(x), rank(y)
    mean_rx, mean_ry = sum(rx) / n, sum(ry) / n
    cov = sum((rx[i] - mean_rx) * (ry[i] - mean_ry) for i in range(n))
    std_x = math.sqrt(sum((r - mean_rx) ** 2 for r in rx))
    std_y = math.sqrt(sum((r - mean_ry) ** 2 for r in ry))
    if std_x == 0 or std_y == 0:
        return None
    return cov / (std_x * std_y)


def load_records():
    with open(DATA_DIR / "reconciliation_summary.json") as f:
        return json.load(f)["records"]


def compute_deviation(record, settlement_by_id, bank_by_utr):
    status = record["status"]
    row = settlement_by_id.get(record.get("settlement_id"))
    if row is None:
        return None

    if status == "partial_payment":
        bank_row = bank_by_utr.get(row["utr"])
        return abs(bank_row["credit_amount"] - row["net_amount"]) if bank_row else None

    if status == "fee_deduction_err":
        expected_fee = round(row["amount"] * 0.02)
        expected_tax = round(expected_fee * 0.18)
        return abs((row["fee"] + row["tax"]) - (expected_fee + expected_tax))

    if status == "tds_gst_mismatch":
        expected_tds = round(row["amount"] * 0.01)
        return abs(row["tds"] - expected_tds)

    if status == "timing_gap":
        bank_row = bank_by_utr.get(row["utr"])
        if bank_row is None:
            return None
        return (pd.Timestamp(bank_row["value_date"]) - pd.Timestamp(row["settled_at"])).days

    return None


def run_validation():
    records = load_records()
    settlement = pd.read_csv(DATA_DIR / "settlement_report.csv")
    bank = pd.read_csv(DATA_DIR / "bank_statement.csv")
    settlement_by_id = settlement.set_index("settlement_id").to_dict("index")
    bank_by_utr = bank.set_index("utr").to_dict("index")

    results, plot_data = {}, {}

    for status, expected_dir in EXPECTED_DIRECTION.items():
        status_records = [r for r in records if r["status"] == status]
        deviations, confidences, order_ids = [], [], []
        for r in status_records:
            dev = compute_deviation(r, settlement_by_id, bank_by_utr)
            if dev is not None:
                deviations.append(dev)
                confidences.append(r["confidence"])
                order_ids.append(r.get("order_id") or r.get("utr") or "unknown")

        if len(deviations) < 2:
            results[status] = {"n": len(deviations), "correlation": None, "note": "not enough records to check"}
            continue

        corr = spearman_correlation(deviations, confidences)
        matches_expected = (
            (expected_dir == "positive" and corr is not None and corr > 0) or
            (expected_dir == "negative" and corr is not None and corr < 0)
        )
        results[status] = {
            "n": len(deviations),
            "correlation": round(corr, 3) if corr is not None else None,
            "expected_direction": expected_dir,
            "matches_expected": matches_expected,
            "plot": [
                {"deviation": d, "confidence": c, "order_id": oid}
                for d, c, oid in zip(deviations, confidences, order_ids)
            ],

        }
        plot_data[status] = (deviations, confidences)

    return results, plot_data


def print_report(results):
    print("\n" + "=" * 70)
    print("SETTL.AI CONFIDENCE SEVERITY-TRACKING VALIDATION")
    print("=" * 70)
    for status, r in results.items():
        print(f"\n{status} (n={r['n']}):")
        if r.get("correlation") is None:
            print(f"  {r.get('note', 'no correlation computed')}")
            continue
        direction_word = "higher" if r["expected_direction"] == "positive" else "lower"
        print(f"  Spearman correlation (deviation vs confidence): {r['correlation']}")
        print(f"  Expected: bigger deviation -> {direction_word} confidence")
        print(f"  Matches expected direction: {r['matches_expected']}")
    print("=" * 70)


def plot_results(plot_data, out_path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    n = len(plot_data)
    fig, axes = plt.subplots(1, n, figsize=(5 * n, 4))
    if n == 1:
        axes = [axes]

    for ax, (status, (deviations, confidences)) in zip(axes, plot_data.items()):
        ax.scatter(deviations, confidences, alpha=0.7)
        ax.set_title(status)
        ax.set_xlabel("deviation magnitude")
        ax.set_ylabel("confidence")

    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    print(f"\nPlot saved to {out_path}")


if __name__ == "__main__":
    results, plot_data = run_validation()
    print_report(results)
    out_path = DATA_DIR / "confidence_severity_validation.png"
    plot_results(plot_data, out_path)
    with open(DATA_DIR / "confidence_severity_validation.json", "w") as f:
        json.dump(results, f, indent=2)
