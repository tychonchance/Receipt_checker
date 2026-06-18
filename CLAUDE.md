# Receipt Checker

A web app that extracts receipt data from images using Claude Vision, imports calendar events from `.ics` files, and automatically matches receipts to events.

## Prerequisites

- Python 3.10+
- Node.js 18+
- An Anthropic API key

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Running the app

### One-command start (production mode)

Builds the React frontend and serves everything from the FastAPI backend on port 8000:

```bash
./start.sh
```

Then open http://localhost:8000.

### Development mode (hot-reload)

Run backend and frontend in separate terminals:

```bash
# Terminal 1 — backend (port 8000, auto-reloads on save)
cd backend
pip install -r requirements.txt
python main.py

# Terminal 2 — frontend (port 5173, proxies /api to backend)
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173.

## Project structure

```
backend/
  main.py           # FastAPI app + all API routes
  db.py             # SQLite helpers (receipts, events, matches)
  ai.py             # Claude Vision receipt extraction
  calendar_utils.py # ICS calendar parsing
  matcher.py        # Receipt-to-event matching logic
  exporter.py       # Excel export (openpyxl)
  requirements.txt

frontend/
  src/
    App.jsx                        # Root layout + data fetching
    components/
      ReceiptUploader.jsx          # Drag-drop image upload
      CalendarPanel.jsx            # ICS file upload + calendar list
      ReceiptTable.jsx             # Colour-coded table + image modal
      DropZone.jsx                 # Reusable drag-drop zone
  vite.config.js                  # Proxies /api → localhost:8000

start.sh            # Builds frontend then starts backend
```

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/receipts` | Upload receipt images (multipart) |
| GET | `/api/receipts` | List all receipts with matches |
| GET | `/api/receipts/{id}/image` | Raw image for thumbnail/modal |
| DELETE | `/api/receipts/{id}` | Delete a receipt |
| POST | `/api/calendars` | Upload `.ics` calendar files |
| GET | `/api/calendars` | List calendars with event counts |
| DELETE | `/api/calendars/{name}` | Remove a calendar and its events |
| POST | `/api/rematch?buffer_hours=2` | Re-run matching with new buffer |
| GET | `/api/export/excel` | Download colour-coded `.xlsx` |

## Matching logic

A receipt matches a calendar event when the receipt timestamp falls within the event's time window **± buffer_hours** (default: 2 hours).

| Status | Colour | Meaning |
|--------|--------|---------|
| matched | Green | Matched to exactly one event |
| ambiguous | Yellow | Matched to two or more events |
| unmatched | Red | No event found within the window |

## Database

SQLite at `backend/receipts.db` — created automatically on first run. Delete the file to reset all data.
