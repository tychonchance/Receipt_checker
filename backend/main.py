import io
import os
import uuid
from typing import List

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from ai import process_receipt_image
from calendar_utils import parse_ics_file
from db import Database
from exporter import export_to_excel
from matcher import match_all_receipts

app = FastAPI(title="Receipt Checker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.environ.get("DB_PATH", "receipts.db")
db = Database(DB_PATH)


@app.on_event("startup")
async def startup():
    db.init()


# ── Receipts ──────────────────────────────────────────────────────────────────

@app.post("/api/receipts")
async def upload_receipts(files: List[UploadFile] = File(...)):
    ids = []
    for file in files:
        data = await file.read()
        extracted = await process_receipt_image(data, file.filename)
        rid = str(uuid.uuid4())
        db.save_receipt(rid, file.filename, data, extracted)
        ids.append(rid)
    match_all_receipts(db)
    return {"uploaded": len(ids), "ids": ids}


@app.get("/api/receipts")
async def list_receipts():
    receipts = db.get_receipts_with_matches()
    # Strip image_data from list response to keep payload small
    for r in receipts:
        r.pop("image_data", None)
    return receipts


@app.get("/api/receipts/{receipt_id}/image")
async def get_receipt_image(receipt_id: str):
    receipts = db.get_all_receipts()
    receipt = next((r for r in receipts if r["id"] == receipt_id), None)
    if not receipt:
        raise HTTPException(404, "Receipt not found")
    import base64
    img_bytes = base64.b64decode(receipt["image_data"])
    return StreamingResponse(io.BytesIO(img_bytes), media_type="image/jpeg")


@app.delete("/api/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str):
    db.delete_receipt(receipt_id)
    return {"deleted": receipt_id}


# ── Calendars ─────────────────────────────────────────────────────────────────

@app.post("/api/calendars")
async def upload_calendars(files: List[UploadFile] = File(...)):
    total_events = 0
    calendars = []
    for file in files:
        content = await file.read()
        events = parse_ics_file(content, file.filename)
        for event in events:
            db.save_event(event)
        total_events += len(events)
        calendars.append({"name": file.filename.rsplit(".", 1)[0], "events": len(events)})
    match_all_receipts(db)
    return {"calendars": calendars, "total_events": total_events}


@app.get("/api/calendars")
async def list_calendars():
    return db.get_calendar_names()


@app.get("/api/events")
async def list_events():
    return db.get_all_events()


@app.delete("/api/calendars/{calendar_name}")
async def delete_calendar(calendar_name: str):
    db.delete_calendar(calendar_name)
    match_all_receipts(db)
    return {"deleted": calendar_name}


# ── Matching ──────────────────────────────────────────────────────────────────

@app.post("/api/rematch")
async def rematch(buffer_hours: int = 2):
    count = match_all_receipts(db, buffer_hours=buffer_hours)
    return {"receipts_processed": count}


# ── Export ────────────────────────────────────────────────────────────────────

@app.get("/api/export/excel")
async def export_excel():
    receipts = db.get_receipts_with_matches()
    excel_bytes = export_to_excel(receipts)
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=receipts.xlsx"},
    )


# ── Static frontend (production) ──────────────────────────────────────────────

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
