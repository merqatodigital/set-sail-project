"""Narrow Supabase MCP bridge used by Hermes/TALA."""
from __future__ import annotations
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime
from typing import Any
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("tala-resort")
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
CMS_KEY = os.environ.get("RESORT_CMS_KEY", "marina_terrace_payload")

def _request(method: str, path: str, payload: Any | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}", data=data, method=method,
        headers={"apikey": SERVICE_KEY, "authorization": f"Bearer {SERVICE_KEY}",
                 "content-type": "application/json", "prefer": "return=representation"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode()
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:1000]
        raise RuntimeError(f"Resort data request failed ({exc.code}): {detail}") from exc

def _cms() -> dict[str, Any]:
    key = urllib.parse.quote(CMS_KEY, safe="")
    rows = _request("GET", f"cms_data?key=eq.{key}&select=value&limit=1") or []
    return rows[0].get("value", {}) if rows else {}

def _ops(cms: dict[str, Any]) -> dict[str, Any]:
    return cms.get("operations") or {}

def _rooms(cms: dict[str, Any]) -> list[dict[str, Any]]:
    return [r for r in (cms.get("homepage") or {}).get("rooms", []) if r.get("visible", True)]

def _iso(value: str) -> date:
    return datetime.strptime(value[:10], "%Y-%m-%d").date()

@mcp.tool()
def get_resort_snapshot() -> dict[str, Any]:
    """Return public resort facts and inventory counts without guest PII."""
    cms, ops = _cms(), _ops(_cms())
    return {
        "site_name": (cms.get("settings") or {}).get("siteName"),
        "rooms": [{"name": r.get("name"), "capacity": r.get("capacity"), "price": r.get("price")} for r in _rooms(cms)],
        "active_tours": sum(1 for t in ops.get("tours", []) if t.get("active")),
        "available_motorbikes": sum(1 for b in ops.get("motorbikes", []) if b.get("status") == "available"),
    }

@mcp.tool()
def check_room_availability(check_in: str, check_out: str, room_name: str | None = None) -> dict[str, Any]:
    """Check live room availability for an ISO date range."""
    start, end = _iso(check_in), _iso(check_out)
    if end <= start:
        raise ValueError("check_out must be after check_in")
    cms = _cms()
    wanted = (room_name or "").strip().lower()
    rooms = [r for r in _rooms(cms) if not wanted or wanted in str(r.get("name", "")).lower()]
    blocking = {"pending", "confirmed", "checked_in"}
    bookings = _ops(cms).get("bookings", [])
    result = []
    for room in rooms:
        name, conflict = str(room.get("name", "")), False
        for booking in bookings:
            if booking.get("status") not in blocking or name.lower() not in str(booking.get("roomType", "")).lower():
                continue
            try:
                conflict = _iso(str(booking["checkIn"])) < end and _iso(str(booking["checkOut"])) > start
            except (KeyError, TypeError, ValueError):
                conflict = False
            if conflict:
                break
        result.append({"name": name, "capacity": room.get("capacity"), "price": room.get("price"), "available": not conflict})
    return {"check_in": check_in, "check_out": check_out, "rooms": result}

@mcp.tool()
def list_tours() -> list[dict[str, Any]]:
    """List active resort tours without internal fields."""
    return [{"name": t.get("name"), "description": t.get("description"), "duration": t.get("duration"),
             "price": t.get("price"), "capacity": t.get("capacity")}
            for t in _ops(_cms()).get("tours", []) if t.get("active")]

@mcp.tool()
def create_booking_request(guest_name: str, room_type: str, check_in: str, check_out: str,
                           guest_phone: str = "", guests: int = 1, notes: str = "") -> dict[str, Any]:
    """Create a pending booking request for human confirmation."""
    if _iso(check_out) <= _iso(check_in):
        raise ValueError("check_out must be after check_in")
    row = {"guest_name": guest_name.strip()[:200], "guest_phone": guest_phone.strip()[:50],
           "room_type": room_type.strip()[:200], "check_in": check_in[:10], "check_out": check_out[:10],
           "guests": max(1, min(int(guests), 20)), "notes": notes.strip()[:1000],
           "source": "tala_hermes", "status": "pending"}
    created = _request("POST", "tala_booking_requests", row)
    return {"success": True, "status": "pending", "request": created[0] if created else row}

@mcp.tool()
def create_guest_request(guest_name: str, request: str, department: str = "guest_relations",
                         guest_phone: str = "", urgency: str = "normal") -> dict[str, Any]:
    """Create a pending guest service request."""
    departments = {"guest_relations", "front_desk", "housekeeping", "maintenance", "finance"}
    urgencies = {"low", "normal", "high", "urgent"}
    row = {"guest_name": guest_name.strip()[:200], "guest_phone": guest_phone.strip()[:50],
           "request": request.strip()[:1500], "department": department if department in departments else "guest_relations",
           "urgency": urgency if urgency in urgencies else "normal", "status": "pending", "source": "tala_hermes"}
    created = _request("POST", "tala_guest_requests", row)
    return {"success": True, "request": created[0] if created else row}

@mcp.tool()
def create_staff_task(title: str, category: str = "general", due_date: str | None = None,
                      notes: str = "") -> dict[str, Any]:
    """Create a pending staff task; completion remains human-controlled."""
    row = {"title": title.strip()[:300], "category": category.strip()[:80],
           "due_date": due_date[:10] if due_date else None, "notes": notes.strip()[:1500],
           "status": "pending", "source": "tala_hermes"}
    created = _request("POST", "tala_staff_tasks", row)
    return {"success": True, "task": created[0] if created else row}

if __name__ == "__main__":
    mcp.run(transport="stdio")
