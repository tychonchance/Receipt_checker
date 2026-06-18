import uuid
from datetime import datetime, date, timedelta
from typing import List

import pytz
from icalendar import Calendar


def parse_ics_file(content: bytes, filename: str) -> List[dict]:
    calendar_name = filename.rsplit(".", 1)[0] if "." in filename else filename
    events = []

    try:
        cal = Calendar.from_ical(content)
        for component in cal.walk():
            if component.name != "VEVENT":
                continue

            dtstart = component.get("DTSTART")
            if dtstart is None:
                continue

            start_dt = _normalize_dt(dtstart.dt)
            if start_dt is None:
                continue

            dtend = component.get("DTEND")
            if dtend:
                end_dt = _normalize_dt(dtend.dt)
            else:
                # All-day events without DTEND last one day; timed events default 1 hour
                if isinstance(dtstart.dt, date) and not isinstance(dtstart.dt, datetime):
                    end_dt = start_dt + timedelta(days=1)
                else:
                    end_dt = start_dt + timedelta(hours=1)

            event_id = str(component.get("UID", uuid.uuid4()))
            summary = str(component.get("SUMMARY", "Unnamed Event"))
            location = str(component.get("LOCATION", ""))
            description = str(component.get("DESCRIPTION", ""))[:500]

            events.append(
                {
                    "id": event_id,
                    "calendar_name": calendar_name,
                    "summary": summary,
                    "start_dt": start_dt.isoformat(),
                    "end_dt": end_dt.isoformat() if end_dt else None,
                    "location": location,
                    "description": description,
                }
            )
    except Exception as exc:
        print(f"Calendar parse error for {filename}: {exc}")

    return events


def _normalize_dt(dt_value) -> datetime:
    if isinstance(dt_value, datetime):
        if dt_value.tzinfo is not None:
            return dt_value.astimezone(pytz.UTC).replace(tzinfo=None)
        return dt_value
    if isinstance(dt_value, date):
        return datetime(dt_value.year, dt_value.month, dt_value.day)
    return None
