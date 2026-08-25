import json
from datetime import datetime, timezone
from pathlib import Path

RESOLUTIONS_PATH = Path(__file__).parent.parent / "data" / "resolutions.json"


def load_all():
    if not RESOLUTIONS_PATH.exists():
        return {}
    with open(RESOLUTIONS_PATH) as f:
        return json.load(f)


def get_resolution(order_id):
    return load_all().get(order_id)


def resolve_order(order_id, note):
    data = load_all()
    entry = {
        "note": note,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }
    data[order_id] = entry
    RESOLUTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RESOLUTIONS_PATH, "w") as f:
        json.dump(data, f, indent=2)
    return entry