#!/usr/bin/env python3
"""MCP server exposing receipt-checker tools to Claude Code."""

import os
import sys
import uuid

# The plugin sets PYTHONPATH to the project's backend directory.
# As a fallback, walk up from this file to find it.
_backend = os.environ.get("PYTHONPATH", "").split(os.pathsep)[0]
if _backend and os.path.isdir(_backend):
    if _backend not in sys.path:
        sys.path.insert(0, _backend)
else:
    # Heuristic: this file lives at <project>/.claude/skills/receipt-checker/server/
    _here = os.path.dirname(os.path.abspath(__file__))
    _guess = os.path.normpath(os.path.join(_here, "..", "..", "..", "..", "backend"))
    if os.path.isdir(_guess) and _guess not in sys.path:
        sys.path.insert(0, _guess)

from mcp.server.fastmcp import FastMCP

from ai import process_receipt_image
from calendar_utils import parse_ics_file
from db import Database
from exporter import export_to_excel
from matcher import match_all_receipts

_project_dir = os.environ.get("CLAUDE_PROJECT_DIR", "")
_db_path = os.path.join(_project_dir, "backend", "receipts.db") if _project_dir else "receipts.db"
_db = Database(_db_path)
_db.init()

mcp = FastMCP("Receipt Checker")


@mcp.tool()
async def process_receipt(image_path: str) -> str:
    """
    Process a receipt image file using Claude Vision to extract date, time,
    amount, and company name. Automatically matches the receipt against any
    imported calendar events. Supports JPG, PNG, WebP, GIF.
    """
    image_path = os.path.expanduser(image_path)
    if not os.path.isfile(image_path):
        return f"Error: file not found: {image_path}"

    with open(image_path, "rb") as f:
        image_data = f.read()

    filename = os.path.basename(image_path)
    extracted = await process_receipt_image(image_data, filename)

    rid = str(uuid.uuid4())
    _db.save_receipt(rid, filename, image_data, extracted)
    match_all_receipts(_db)

    receipts = _db.get_receipts_with_matches()
    r = next((x for x in receipts if x["id"] == rid), {})
    status = r.get("status", "unmatched")
    matched_events = r.get("matched_events", [])

    lines = [
        f"Processed: {filename}",
        f"  Company:  {extracted.get('company') or '(not found)'}",
        f"  Date:     {extracted.get('date') or '—'}",
        f"  Time:     {extracted.get('time') or '—'}",
        f"  Amount:   {extracted.get('amount')} {extracted.get('currency', 'USD')}",
        f"  Status:   {status}",
    ]
    if matched_events:
        names = ", ".join(e["summary"] for e in matched_events)
        lines.append(f"  Events:   {names}")
    if extracted.get("raw_text"):
        lines.append(f"  Notes:    {extracted['raw_text']}")

    return "\n".join(lines)


@mcp.tool()
def import_calendar(ics_path: str) -> str:
    """
    Import a calendar .ics file (Google Calendar, Outlook, Apple Calendar, etc.).
    Imported events are used for matching receipts by date and time.
    Re-runs receipt matching automatically after import.
    """
    ics_path = os.path.expanduser(ics_path)
    if not os.path.isfile(ics_path):
        return f"Error: file not found: {ics_path}"

    with open(ics_path, "rb") as f:
        content = f.read()

    filename = os.path.basename(ics_path)
    events = parse_ics_file(content, filename)
    for event in events:
        _db.save_event(event)
    match_all_receipts(_db)

    return f"Imported {len(events)} events from '{filename}'. Receipt matching updated."


@mcp.tool()
def list_receipts() -> str:
    """
    List all receipts with their extracted data and calendar match status.
    Status is one of: matched (one event), ambiguous (multiple events), unmatched (none).
    """
    receipts = _db.get_receipts_with_matches()
    if not receipts:
        return "No receipts in the database yet."

    header = f"{'ID':8}  {'Company':24}  {'Date':10}  {'Time':5}  {'Amount':>9}  {'Status':10}  Matched event(s)"
    sep = "-" * 100
    rows = [header, sep]

    for r in receipts:
        rid = r["id"][:8]
        company = (r.get("company") or "Unknown")[:23]
        date = r.get("date") or "—"
        time = r.get("time") or "—"
        amount = f"{r['amount']:.2f}" if r.get("amount") is not None else "—"
        status = r.get("status", "unmatched")
        events = ", ".join(e["summary"] for e in r.get("matched_events", []))
        rows.append(f"{rid:8}  {company:24}  {date:10}  {time:5}  {amount:>9}  {status:10}  {events}")

    return "\n".join(rows)


@mcp.tool()
def list_calendars() -> str:
    """List all imported calendars with their event counts."""
    cals = _db.get_calendar_names()
    if not cals:
        return "No calendars imported yet."

    rows = [f"{'Calendar':40}  Events", "-" * 50]
    for c in cals:
        rows.append(f"{c['calendar_name']:40}  {c['event_count']}")
    return "\n".join(rows)


@mcp.tool()
def rematch(buffer_hours: int = 2) -> str:
    """
    Re-run matching of all receipts against imported calendar events.
    buffer_hours controls the window around each event (default: ±2 hours).
    A receipt matches if its timestamp falls within event_start-buffer to event_end+buffer.
    """
    count = match_all_receipts(_db, buffer_hours=buffer_hours)
    receipts = _db.get_receipts_with_matches()
    matched = sum(1 for r in receipts if r["status"] == "matched")
    ambiguous = sum(1 for r in receipts if r["status"] == "ambiguous")
    unmatched = sum(1 for r in receipts if r["status"] == "unmatched")
    return (
        f"Re-matched {count} receipts (buffer: ±{buffer_hours}h)\n"
        f"  Matched:   {matched}\n"
        f"  Ambiguous: {ambiguous}\n"
        f"  Unmatched: {unmatched}"
    )


@mcp.tool()
def export_excel(output_path: str = "") -> str:
    """
    Export all receipts to a colour-coded Excel (.xlsx) file.
    Green = matched to one event, Yellow = ambiguous, Red = unmatched.
    Defaults to receipts.xlsx in the project root.
    """
    receipts = _db.get_receipts_with_matches()
    if not receipts:
        return "No receipts to export."

    if not output_path:
        output_path = os.path.join(_project_dir or ".", "receipts.xlsx")
    output_path = os.path.expanduser(output_path)

    excel_bytes = export_to_excel(receipts)
    with open(output_path, "wb") as f:
        f.write(excel_bytes)

    return f"Exported {len(receipts)} receipts to: {output_path}"


@mcp.tool()
def delete_receipt(receipt_id: str) -> str:
    """
    Delete a receipt by its ID (the full UUID or the first 8 characters shown in list_receipts).
    """
    receipts = _db.get_all_receipts()
    match = next((r for r in receipts if r["id"].startswith(receipt_id)), None)
    if not match:
        return f"No receipt found with ID starting with '{receipt_id}'."
    _db.delete_receipt(match["id"])
    label = match.get("company") or match.get("filename") or match["id"]
    return f"Deleted: {label} ({match.get('date') or 'no date'})"


@mcp.tool()
def delete_calendar(calendar_name: str) -> str:
    """
    Remove a calendar and all its events. Receipt matching is re-run automatically.
    """
    _db.delete_calendar(calendar_name)
    match_all_receipts(_db)
    return f"Removed calendar '{calendar_name}' and updated receipt matching."


if __name__ == "__main__":
    mcp.run()
