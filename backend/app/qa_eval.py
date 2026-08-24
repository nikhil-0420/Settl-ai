"""
Settl.ai Q&A agent eval harness — full-scale (n≈120), not a sample.

Question generation:
  - one single-order question per non-clean-match record (scales with n)
  - a few phrasing variants per status for set-based questions
  - a broader unanswerable set

Checkpointed: results are saved after every question, and a rerun skips
questions already answered — a mid-run API failure doesn't cost the batch.

Three tracked metrics:
  1. ID accuracy        — cited order_id(s) match ground truth
  2. Claim accuracy      — stated reason matches the cited record's real status
  3. Refusal correctness — refused exactly when it should have

Run from backend/:  python app/qa_eval.py
"""
import json
import time
from collections import defaultdict
from pathlib import Path

from qa_agent import ask

DATA_DIR = Path(__file__).parent.parent / "data"
CHECKPOINT_PATH = DATA_DIR / "qa_eval_results.json"
SLEEP_BETWEEN_CALLS = 4.5  # seconds — stay under free-tier rate limits

STATUS_KEYWORDS = {
    "clean_match": ["reconciled", "no issues", "clean"],
    "timing_gap": ["timing", "later", "delay", "window"],
    "partial_payment": ["partial", "less than", "shortfall", "short"],
    "fee_deduction_err": ["fee", "2%", "gst"],
    "tds_gst_mismatch": ["tds", "1%", "deduction"],
    "duplicate": ["duplicate", "more than once", "twice"],
    "phantom_bank": ["phantom", "no matching settlement", "no matching ledger"],
    "phantom_ledger": ["phantom", "no matching settlement", "ledger invoice"],
    "unmatched": ["unmatched", "could not be reconciled", "no bank record"],
}

SINGLE_ORDER_TEMPLATES = [
    "Why didn't {oid} reconcile cleanly?",
    "What's the issue with {oid}?",
    "Explain the reconciliation status of {oid}.",
]

SET_BASED_TEMPLATES = {
    "fee_deduction_err": ["Which orders have fee deduction errors?", "List orders with incorrect settlement fees."],
    "tds_gst_mismatch": ["Which orders have TDS mismatches?", "List orders with incorrect TDS deductions."],
    "timing_gap": ["Which orders had a timing gap in settlement?", "List orders that settled late."],
    "partial_payment": ["Which orders were only partially paid?", "List orders with a payment shortfall."],
    "duplicate": ["Which orders were settled more than once?"],
    "phantom_bank": ["Which orders have a bank credit with no matching settlement?"],
    "phantom_ledger": ["Which orders have a ledger entry with no matching settlement?"],
    "unmatched": ["Which orders could not be reconciled at all?"],
}

UNANSWERABLE_QUESTIONS = [
    "What's the capital of France?",
    "What was Settl.ai's revenue last quarter?",
    "Who is the CEO of Razorpay?",
    "What's the weather in Bangalore today?",
    "How many employees does Razorpay have?",
    "What's the stock price of Razorpay?",
    "Summarize Settl.ai's Series A funding round.",
    "What programming language is the frontend written in?",
    "Who won the buildathon last year?",
    "What's the refund policy for failed transactions?",
]


def load_ground_truth():
    with open(DATA_DIR / "reconciliation_summary.json") as f:
        summary = json.load(f)
    records = {r["order_id"]: r for r in summary["records"] if r.get("order_id")}
    by_status = defaultdict(set)
    for oid, r in records.items():
        by_status[r["status"]].add(oid)
    return records, by_status


def check_claim_accuracy(answer_text, expected_status):
    keywords = STATUS_KEYWORDS.get(expected_status, [])
    answer_lower = answer_text.lower()
    return any(kw in answer_lower for kw in keywords)


def build_test_set(records, by_status):
    tests = []

    # single-order — ALL phrasing templates per non-clean-match record,
    # to test answer consistency across phrasing, not just one question each
    non_clean = [(oid, r["status"]) for oid, r in records.items() if r["status"] != "clean_match"]
    for oid, status in non_clean:
        for t_idx, template in enumerate(SINGLE_ORDER_TEMPLATES):
            tests.append({
                "id": f"single_{oid}_t{t_idx}",
                "type": "single_order",
                "question": template.format(oid=oid),
                "expected_ids": {oid},
                "expected_status": status,
                "expect_refusal": False,
            })

    # set-based — every phrasing variant per status that has records
    for status, templates in SET_BASED_TEMPLATES.items():
        if not by_status.get(status):
            continue
        for j, q in enumerate(templates):
            tests.append({
                "id": f"set_{status}_{j}",
                "type": "set_based",
                "question": q,
                "expected_ids": by_status[status],
                "expected_status": status,
                "expect_refusal": False,
            })

    # unanswerable
    for k, q in enumerate(UNANSWERABLE_QUESTIONS):
        tests.append({
            "id": f"unanswerable_{k}",
            "type": "unanswerable",
            "question": q,
            "expected_ids": set(),
            "expected_status": None,
            "expect_refusal": True,
        })

    return tests


def score_single_order(result, test):
    cited = set(result["cited_ids"])
    id_correct = cited == test["expected_ids"]
    claim_correct = check_claim_accuracy(result["answer"], test["expected_status"]) if id_correct else False
    return id_correct, claim_correct


def score_set_based(result, test):
    cited = set(result["cited_ids"])
    expected = test["expected_ids"]
    if not cited and not expected:
        precision = recall = 1.0
    elif not cited:
        precision, recall = 0.0, 0.0
    else:
        tp = len(cited & expected)
        precision = tp / len(cited)
        recall = tp / len(expected) if expected else 0.0
    id_correct = precision >= 0.5 and recall >= 0.5
    claim_correct = check_claim_accuracy(result["answer"], test["expected_status"]) if id_correct else False
    return id_correct, claim_correct, precision, recall


def load_checkpoint():
    if CHECKPOINT_PATH.exists():
        with open(CHECKPOINT_PATH) as f:
            data = json.load(f)
        return {r["id"]: r for r in data}
    return {}


def save_checkpoint(results_by_id):
    with open(CHECKPOINT_PATH, "w") as f:
        json.dump(list(results_by_id.values()), f, indent=2)


def run_eval():
    records, by_status = load_ground_truth()
    tests = build_test_set(records, by_status)
    done = load_checkpoint()

    print(f"Total questions: {len(tests)} | Already completed: {len(done)}")

    for i, test in enumerate(tests):
        if test["id"] in done:
            continue

        result = ask(test["question"])
        row = {
            "id": test["id"],
            "type": test["type"],
            "question": test["question"],
            "answer": result["answer"],
            "cited_ids": result["cited_ids"],
            "expected_ids": sorted(test["expected_ids"]),
            "is_refusal": result["is_refusal"],
            "expect_refusal": test["expect_refusal"],
            "refusal_correct": result["is_refusal"] == test["expect_refusal"],
        }

        if test["expect_refusal"]:
            row["id_correct"] = None
            row["claim_correct"] = None
        elif result["is_refusal"]:
            row["id_correct"] = False
            row["claim_correct"] = False
        elif test["type"] == "single_order":
            id_correct, claim_correct = score_single_order(result, test)
            row["id_correct"] = id_correct
            row["claim_correct"] = claim_correct
        elif test["type"] == "set_based":
            id_correct, claim_correct, precision, recall = score_set_based(result, test)
            row["id_correct"] = id_correct
            row["claim_correct"] = claim_correct
            row["precision"] = round(precision, 2)
            row["recall"] = round(recall, 2)

        done[test["id"]] = row
        save_checkpoint(done)  # persist after every single question
        print(f"[{i+1}/{len(tests)}] {test['id']} -> refusal_correct={row['refusal_correct']}"
              f"{', id_correct=' + str(row.get('id_correct')) if row.get('id_correct') is not None else ''}")

        time.sleep(SLEEP_BETWEEN_CALLS)

    print_report(list(done.values()))
    return list(done.values())


def print_report(results):
    print("\n" + "=" * 70)
    print("SETTL.AI Q&A EVAL REPORT (n={})".format(len(results)))
    print("=" * 70)

    refusal_scores = [r["refusal_correct"] for r in results]
    id_scores = [r["id_correct"] for r in results if r["id_correct"] is not None]
    claim_scores = [r["claim_correct"] for r in results if r["claim_correct"] is not None]

    by_type = defaultdict(list)
    for r in results:
        by_type[r["type"]].append(r)

    for t, rows in by_type.items():
        print(f"\n{t} (n={len(rows)}):")
        ref = [r["refusal_correct"] for r in rows]
        print(f"  Refusal correct: {sum(ref)}/{len(ref)} ({100*sum(ref)/len(ref):.1f}%)")
        idc = [r["id_correct"] for r in rows if r["id_correct"] is not None]
        if idc:
            print(f"  ID accuracy:    {sum(idc)}/{len(idc)} ({100*sum(idc)/len(idc):.1f}%)")
        clc = [r["claim_correct"] for r in rows if r["claim_correct"] is not None]
        if clc:
            print(f"  Claim accuracy: {sum(clc)}/{len(clc)} ({100*sum(clc)/len(clc):.1f}%)")

    print("\n" + "-" * 70)
    print("OVERALL")
    print("-" * 70)
    print(f"Refusal precision/recall: {sum(refusal_scores)}/{len(refusal_scores)} "
          f"({100*sum(refusal_scores)/len(refusal_scores):.1f}%)")
    if id_scores:
        print(f"ID accuracy:    {sum(id_scores)}/{len(id_scores)} "
              f"({100*sum(id_scores)/len(id_scores):.1f}%)")
    if claim_scores:
        print(f"Claim accuracy: {sum(claim_scores)}/{len(claim_scores)} "
              f"({100*sum(claim_scores)/len(claim_scores):.1f}%)")
    print("=" * 70)


if __name__ == "__main__":
    results = run_eval()
    print(f"\nResults saved to {CHECKPOINT_PATH}")