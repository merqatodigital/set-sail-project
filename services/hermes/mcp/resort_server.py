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

def _in_range(value: Any, start: date | None, end: date | None) -> bool:
    if not value:
        return start is None and end is None
    try:
        current = _iso(str(value))
    except (TypeError, ValueError):
        return False
    return (start is None or current >= start) and (end is None or current <= end)

def _number(value: Any) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0

@mcp.tool()
def get_resort_snapshot() -> dict[str, Any]:
    """Return public resort facts and inventory counts without guest PII."""
    cms = _cms()
    ops = _ops(cms)
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
def check_motorbike(bike_name: str | None = None) -> list[dict[str, Any]]:
    """List active motorbikes and their live availability."""
    wanted = (bike_name or "").strip().lower()
    bikes = _ops(_cms()).get("motorbikes", [])
    return [
        {
            "name": bike.get("name"),
            "model": bike.get("model"),
            "daily_rate": bike.get("dailyRate"),
            "status": bike.get("status"),
            "available": bike.get("status") == "available",
        }
        for bike in bikes
        if bike.get("active", True) and (not wanted or wanted in str(bike.get("name", "")).lower())
    ]

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
def get_daily_operations(operations_date: str | None = None) -> dict[str, Any]:
    """Return arrivals, departures, tours, rentals, food orders, messages, and pending internal tasks for a day."""
    target = _iso(operations_date or date.today().isoformat())
    ops = _ops(_cms())
    bookings = ops.get("bookings", [])
    tours = ops.get("tourBookings", [])
    rentals = ops.get("motorbikeRentals", [])
    food = ops.get("foodOrders", [])
    messages = ops.get("guestMessages", [])
    tasks = _request(
        "GET",
        "tala_tasks?status=eq.pending&select=id,title,due,status,category,created_at&order=created_at.desc&limit=100",
    ) or []
    return {
        "date": target.isoformat(),
        "arrivals": [b for b in bookings if str(b.get("checkIn", ""))[:10] == target.isoformat() and b.get("status") != "cancelled"],
        "departures": [b for b in bookings if str(b.get("checkOut", ""))[:10] == target.isoformat() and b.get("status") != "cancelled"],
        "tours": [t for t in tours if str(t.get("date", ""))[:10] == target.isoformat() and t.get("status") != "cancelled"],
        "active_rentals": [r for r in rentals if r.get("status") == "active"],
        "open_food_orders": [o for o in food if o.get("status") not in {"delivered", "cancelled"}],
        "unread_messages": [m for m in messages if m.get("status") == "unread"],
        "pending_tasks": tasks,
    }

@mcp.tool()
def get_financial_snapshot(start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
    """Analyze resort revenue, recorded cash movement, direct costs, payroll, occupancy, and profit without changing records."""
    start = _iso(start_date) if start_date else None
    end = _iso(end_date) if end_date else None
    cms = _cms()
    ops = _ops(cms)
    bookings = [b for b in ops.get("bookings", []) if b.get("status") != "cancelled" and _in_range(b.get("createdAt"), start, end)]
    tours = [t for t in ops.get("tourBookings", []) if t.get("status") != "cancelled" and _in_range(t.get("createdAt"), start, end)]
    rentals = [r for r in ops.get("motorbikeRentals", []) if r.get("status") != "cancelled" and _in_range(r.get("createdAt"), start, end)]
    food = [o for o in ops.get("foodOrders", []) if o.get("status") != "cancelled" and _in_range(o.get("createdAt"), start, end)]
    payments = [p for p in ops.get("payments", []) if _in_range(p.get("date"), start, end)]
    payroll = [p for p in ops.get("payRecords", []) if _in_range(p.get("periodEnd"), start, end)]

    accommodation_revenue = sum(_number(item.get("amount")) for item in bookings)
    tour_revenue = sum(_number(item.get("amount")) for item in tours)
    rental_revenue = sum(_number(item.get("amount")) for item in rentals)
    food_revenue = sum(_number(item.get("total")) for item in food)
    gross_revenue = accommodation_revenue + tour_revenue + rental_revenue + food_revenue
    direct_costs = sum(_number(item.get("cost")) for item in tours) + sum(_number(item.get("totalCost")) for item in food)
    recorded_expenses = sum(_number(item.get("amount")) for item in payments if item.get("direction") == "out")
    paid_payroll = sum(_number(item.get("amount")) for item in payroll if item.get("paid"))
    net_before_fixed_costs = gross_revenue - direct_costs - recorded_expenses

    nights = 0
    for booking in bookings:
        try:
            nights += max(1, (_iso(str(booking.get("checkOut"))) - _iso(str(booking.get("checkIn")))).days)
        except (TypeError, ValueError):
            continue

    return {
        "period": {"start": start_date, "end": end_date},
        "currency": "PHP",
        "revenue": {
            "accommodation": accommodation_revenue,
            "tours": tour_revenue,
            "rentals": rental_revenue,
            "food": food_revenue,
            "total": gross_revenue,
        },
        "costs": {
            "direct": direct_costs,
            "recorded_expenses": recorded_expenses,
            "paid_payroll": paid_payroll,
        },
        "net_before_unrecorded_fixed_costs": net_before_fixed_costs,
        "booked_room_nights": nights,
        "booking_count": len(bookings),
        "payment_records": len(payments),
        "warning": "This is an operational management snapshot, not audited accounting advice.",
    }

@mcp.tool()
def list_leads(limit: int = 50) -> list[dict[str, Any]]:
    """List the newest captured resort leads for authorized back-office follow-up."""
    safe_limit = max(1, min(int(limit), 200))
    return _request(
        "GET",
        f"tala_leads?select=id,name,contact,note,source,source_url,created_at&order=created_at.desc&limit={safe_limit}",
    ) or []

@mcp.tool()
def create_lead(name: str, contact: str, note: str, source: str = "hermes_workforce", source_url: str = "") -> dict[str, Any]:
    """Save a qualified lead with source attribution; this does not send outreach."""
    row = {
        "name": name.strip()[:200],
        "contact": contact.strip()[:300],
        "note": note.strip()[:2000],
        "source": source.strip()[:100] or "hermes_workforce",
        "source_url": source_url.strip()[:1000] or None,
    }
    created = _request("POST", "tala_leads", row)
    return {"success": True, "lead": created[0] if created else row}

@mcp.tool()
def list_guest_messages(status: str = "unread") -> list[dict[str, Any]]:
    """List guest messages from the Resort OS for the Email or Operations Agent."""
    allowed = {"unread", "read", "replied", "all"}
    wanted = status if status in allowed else "unread"
    messages = _ops(_cms()).get("guestMessages", [])
    if wanted != "all":
        messages = [message for message in messages if message.get("status") == wanted]
    return messages[:200]

@mcp.tool()
def create_internal_task(title: str, category: str = "general", due: str = "") -> dict[str, Any]:
    """Create a pending internal resort task. This does not message guests or mark work completed."""
    allowed = {"general", "booking", "tour", "staff", "maintenance"}
    row = {
        "title": title.strip()[:300],
        "due": due.strip()[:10],
        "status": "pending",
        "category": category if category in allowed else "general",
    }
    created = _request("POST", "tala_tasks", row)
    return {"success": True, "task": created[0] if created else row}

if __name__ == "__main__":
    mcp.run(transport="stdio")
