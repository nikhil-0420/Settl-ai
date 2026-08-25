# backend/app/audit.py
import json
from datetime import datetime, timezone
from pathlib import Path

AUDIT_LOG_PATH = Path(__file__).parent.parent / "data" / "audit_log.jsonl"


def log_decision(event_type, detail, question=None, answer=None, cited_ids=None, is_refusal=None):
    """Append one audit entry. Uses JSONL (one JSON object per line) so it's
    append-only and safe to write from concurrent requests without re-parsing
    the whole file each time."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,   # "answered" | "refused" | "escalated" | "outage_fallback"
        "detail": detail,
        "question": question,
        "answer": answer,
        "cited_ids": cited_ids,
        "is_refusal": is_refusal,
    }
    with open(AUDIT_LOG_PATH, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return entry


def read_audit_log(limit=50):
    if not AUDIT_LOG_PATH.exists():
        return []
    with open(AUDIT_LOG_PATH) as f:
        lines = f.readlines()
    entries = [json.loads(line) for line in lines[-limit:]]
    return list(reversed(entries))  # most recent first