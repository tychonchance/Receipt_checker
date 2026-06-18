from datetime import datetime, timedelta
from typing import List, Tuple

DEFAULT_BUFFER_HOURS = 2


def _parse_receipt_dt(date_str: str, time_str: str) -> datetime:
    if not date_str:
        return None
    try:
        if time_str:
            return datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        return datetime.strptime(date_str, "%Y-%m-%d")
    except Exception:
        return None


def _parse_event_dt(dt_str: str) -> datetime:
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None


def match_receipt(receipt: dict, events: List[dict], buffer_hours: int = DEFAULT_BUFFER_HOURS) -> Tuple[List[dict], str]:
    receipt_dt = _parse_receipt_dt(receipt.get("date"), receipt.get("time"))
    if receipt_dt is None:
        return [], "unmatched"

    matches = []
    for event in events:
        start_dt = _parse_event_dt(event.get("start_dt"))
        end_dt = _parse_event_dt(event.get("end_dt"))

        if start_dt is None:
            continue
        if end_dt is None:
            end_dt = start_dt + timedelta(hours=1)

        window_start = start_dt - timedelta(hours=buffer_hours)
        window_end = end_dt + timedelta(hours=buffer_hours)

        if window_start <= receipt_dt <= window_end:
            matches.append(event)

    if len(matches) == 0:
        status = "unmatched"
    elif len(matches) == 1:
        status = "matched"
    else:
        status = "ambiguous"

    return matches, status


def match_all_receipts(db, buffer_hours: int = DEFAULT_BUFFER_HOURS) -> int:
    receipts = db.get_all_receipts()
    events = db.get_all_events()

    for receipt in receipts:
        matches, status = match_receipt(receipt, events, buffer_hours)
        db.clear_matches_for_receipt(receipt["id"])
        db.update_receipt_status(receipt["id"], status)
        for event in matches:
            db.add_match(receipt["id"], event["id"])

    return len(receipts)
