---
name: receipt-checker
---

# Receipt Checker

Process receipt images with AI and match them to calendar events. Use the MCP tools below to manage receipts and calendars directly in chat — no web browser needed.

## Tools available

| Tool | What it does |
|------|-------------|
| `process_receipt(image_path)` | Extract date, time, amount, company from a receipt image and auto-match to calendar events |
| `import_calendar(ics_path)` | Import a `.ics` calendar file; re-runs matching automatically |
| `list_receipts()` | Show all receipts with status and matched events |
| `list_calendars()` | Show imported calendars and event counts |
| `rematch(buffer_hours=2)` | Re-run matching — use a larger buffer if receipts aren't matching |
| `export_excel(output_path?)` | Export colour-coded spreadsheet (green/yellow/red) |
| `delete_receipt(id)` | Remove a receipt (use the 8-char ID from list_receipts) |
| `delete_calendar(name)` | Remove a calendar and its events |

## Match status meanings

| Status | Colour in Excel | Meaning |
|--------|----------------|---------|
| matched | Green | One calendar event found within the time window |
| ambiguous | Yellow | Multiple events found — flag for manual review |
| unmatched | Red | No event found within the time window |

## Common workflows

**Process a batch of receipts:**
> "Process all the receipts in ~/Downloads/receipts/ and then export to Excel"

**Import a calendar and re-match:**
> "Import ~/Downloads/work-calendar.ics and show me which receipts are still unmatched"

**Adjust the matching window:**
> "Re-match with a 4-hour buffer and show the results"

**Quick export:**
> "Export the receipts spreadsheet to my Desktop"

## Web UI

The full web interface (with image thumbnails and drag-and-drop upload) is also available. Run `./start.sh` from the project root, then open http://localhost:8000. Both the web UI and these MCP tools share the same database.
