import sqlite3
import base64
from datetime import datetime
from typing import List


class Database:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def init(self):
        with self._conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS receipts (
                    id TEXT PRIMARY KEY,
                    filename TEXT,
                    image_data TEXT,
                    date TEXT,
                    time TEXT,
                    amount REAL,
                    currency TEXT,
                    company TEXT,
                    raw_text TEXT,
                    status TEXT DEFAULT 'unmatched',
                    created_at TEXT
                );

                CREATE TABLE IF NOT EXISTS events (
                    id TEXT PRIMARY KEY,
                    calendar_name TEXT,
                    summary TEXT,
                    start_dt TEXT,
                    end_dt TEXT,
                    location TEXT,
                    description TEXT
                );

                CREATE TABLE IF NOT EXISTS receipt_matches (
                    receipt_id TEXT,
                    event_id TEXT,
                    PRIMARY KEY (receipt_id, event_id),
                    FOREIGN KEY (receipt_id) REFERENCES receipts(id),
                    FOREIGN KEY (event_id) REFERENCES events(id)
                );
            """)

    def _conn(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def save_receipt(self, receipt_id: str, filename: str, image_data: bytes, extracted: dict):
        image_b64 = base64.b64encode(image_data).decode()
        now = datetime.utcnow().isoformat()
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO receipts
                    (id, filename, image_data, date, time, amount, currency, company, raw_text, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                (
                    receipt_id,
                    filename,
                    image_b64,
                    extracted.get("date"),
                    extracted.get("time"),
                    extracted.get("amount"),
                    extracted.get("currency", "USD"),
                    extracted.get("company"),
                    extracted.get("raw_text", ""),
                    now,
                ),
            )

    def save_event(self, event: dict):
        with self._conn() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO events
                    (id, calendar_name, summary, start_dt, end_dt, location, description)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event["id"],
                    event["calendar_name"],
                    event["summary"],
                    event["start_dt"],
                    event["end_dt"],
                    event.get("location", ""),
                    event.get("description", ""),
                ),
            )

    def get_all_receipts(self) -> List[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM receipts ORDER BY date DESC, time DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_all_events(self) -> List[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM events ORDER BY start_dt"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_calendar_names(self) -> List[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT calendar_name, COUNT(*) as event_count FROM events GROUP BY calendar_name"
            ).fetchall()
            return [dict(r) for r in rows]

    def update_receipt_status(self, receipt_id: str, status: str):
        with self._conn() as conn:
            conn.execute(
                "UPDATE receipts SET status = ? WHERE id = ?", (status, receipt_id)
            )

    def clear_matches_for_receipt(self, receipt_id: str):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM receipt_matches WHERE receipt_id = ?", (receipt_id,)
            )

    def add_match(self, receipt_id: str, event_id: str):
        with self._conn() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO receipt_matches (receipt_id, event_id) VALUES (?, ?)",
                (receipt_id, event_id),
            )

    def get_receipts_with_matches(self) -> List[dict]:
        with self._conn() as conn:
            receipts = conn.execute(
                "SELECT * FROM receipts ORDER BY date DESC, time DESC"
            ).fetchall()
            result = []
            for r in receipts:
                receipt = dict(r)
                event_rows = conn.execute(
                    """
                    SELECT e.* FROM events e
                    JOIN receipt_matches rm ON e.id = rm.event_id
                    WHERE rm.receipt_id = ?
                    """,
                    (r["id"],),
                ).fetchall()
                receipt["matched_events"] = [dict(e) for e in event_rows]
                result.append(receipt)
            return result

    def delete_receipt(self, receipt_id: str):
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM receipt_matches WHERE receipt_id = ?", (receipt_id,)
            )
            conn.execute("DELETE FROM receipts WHERE id = ?", (receipt_id,))

    def delete_calendar(self, calendar_name: str):
        with self._conn() as conn:
            conn.execute(
                """
                DELETE FROM receipt_matches WHERE event_id IN (
                    SELECT id FROM events WHERE calendar_name = ?
                )
                """,
                (calendar_name,),
            )
            conn.execute(
                "DELETE FROM events WHERE calendar_name = ?", (calendar_name,)
            )

    def clear_all(self):
        with self._conn() as conn:
            conn.executescript("""
                DELETE FROM receipt_matches;
                DELETE FROM receipts;
                DELETE FROM events;
            """)
