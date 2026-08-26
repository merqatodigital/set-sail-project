"""
TALA SHARED TOOL MODULE
Single source of truth for both tala_server.py and tala/server.py.

tala_server.py legacy import: from tools.tala_tools import ...
tala/server.py legacy import: from tool_schemas import TALA_TOOLS
                              from tools import TOOL_REGISTRY

This module is the canonical home for TOOL_REGISTRY and TOOL_SCHEMAS.
Both servers should import from here directly (or via the shim modules).
"""

from typing import Any, Callable
import json
import httpx
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

# ── Environment ────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_STAFF_CHAT_ID = os.environ.get("TELEGRAM_STAFF_CHAT_ID", "")

supabase_headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def _uid(prefix: str = "") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}" if prefix else uuid.uuid4().hex[:12]


# ─────────────────────────────────────────────────────────────────────────
#  ROOMS
# ─────────────────────────────────────────────────────────────────────────

def check_availability(check_in: str, check_out: str, num_guests: int = 2) -> dict:
    """Check which rooms are available for given dates."""
    try:
        rooms = httpx.get(
            f"{SUPABASE_URL}/rest/v1/rooms?status=eq.active&select=*",
            headers=supabase_headers,
        ).json()

        available = []
        for room in rooms:
            if room["capacity"] < num_guests:
                continue
            blocked = httpx.get(
                f"{SUPABASE_URL}/rest/v1/room_availability?"
                f"room_id=eq.{room['id']}&date=gte.{check_in}&date=lt.{check_out}"
                f"&status=in.(booked,blocked,maintenance)&select=id",
                headers=supabase_headers,
            ).json()
            if len(blocked) == 0:
                available.append({
                    "room_id": room["id"],
                    "name": room["name"],
                    "type": room["type"],
                    "capacity": room["capacity"],
                    "rate_php": room["rate_php"],
                    "amenities": room.get("amenities", []),
                })
        return {"available": len(available) > 0, "rooms": available,
                "check_in": check_in, "check_out": check_out}
    except Exception as e:
        return {"error": str(e)}


def create_booking(
    guest_name: str, guest_email: str, guest_phone: str, room_id: str,
    check_in: str, check_out: str, num_guests: int = 2, special_requests: str = "",
) -> dict:
    """Create a booking request (guest-facing tala_booking_requests table)."""
    try:
        ci = datetime.strptime(check_in, "%Y-%m-%d")
        co = datetime.strptime(check_out, "%Y-%m-%d")
        nights = (co - ci).days

        room = httpx.get(
            f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{room_id}&select=rate_php,name",
            headers=supabase_headers,
        ).json()[0]

        total_php = float(room["rate_php"]) * nights
        ref = f"MT-{datetime.now().strftime('%Y%m%d')}-{_uid()[:6].upper()}"

        httpx.post(
            f"{SUPABASE_URL}/rest/v1/guests",
            headers={**supabase_headers, "Prefer": "resolution=merge-duplicates"},
            json={"id": _uid("guest"), "name": guest_name,
                  "email": guest_email, "phone": guest_phone},
        )

        booking = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name, "guest_phone": guest_phone,
                "guest_email": guest_email, "room_type": room["name"],
                "check_in": check_in, "check_out": check_out,
                "guests": num_guests, "amount": total_php,
                "notes": special_requests, "status": "pending",
                "source": "tala_chat", "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Prepare {room['name']} for {guest_name}",
            description=f"Booking {ref}: {check_in} to {check_out}. {num_guests} guests.",
            category="housekeeping", room_id=room_id,
        )

        return {
            "success": True, "booking_reference": ref, "room": room["name"],
            "check_in": check_in, "check_out": check_out, "nights": nights,
            "total_php": total_php,
        }
    except Exception as e:
        return {"error": str(e)}


def list_bookings(status: str = None) -> dict:
    """List admin-managed bookings."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/bookings?order=created_at.desc&limit=50"
        if status:
            url += f"&status=eq.{status}"
        rows = httpx.get(url, headers=supabase_headers).json()
        return {"bookings": rows, "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


def confirm_booking(booking_request_id: str) -> dict:
    """Confirm a tala_booking_requests entry and create an admin booking."""
    try:
        req = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?id=eq.{booking_request_id}&select=*",
            headers=supabase_headers,
        ).json()[0]

        rooms = httpx.get(
            f"{SUPABASE_URL}/rest/v1/rooms?select=id,name,slug",
            headers=supabase_headers,
        ).json()
        room = next((r for r in rooms if r["name"] == req["room_type"]), None)

        booking_id = _uid("bk")
        httpx.post(
            f"{SUPABASE_URL}/rest/v1/bookings?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "id": booking_id, "reference": req["reference"],
                "guest_id": "", "guest_name": req["guest_name"],
                "guest_phone": req["guest_phone"],
                "room_type": req["room_type"],
                "check_in": req["check_in"], "check_out": req["check_out"],
                "guests": req["guests"], "amount": req["amount"],
                "paid_amount": 0, "status": "confirmed",
                "source": "tala_chat", "notes": req["notes"],
            },
        )

        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?id=eq.{booking_request_id}",
            headers=supabase_headers,
            json={"status": "confirmed", "confirmed_at": datetime.now().isoformat()},
        )

        ci = datetime.strptime(req["check_in"], "%Y-%m-%d")
        co = datetime.strptime(req["check_out"], "%Y-%m-%d")
        current = ci
        while current < co:
            httpx.post(
                f"{SUPABASE_URL}/rest/v1/room_availability",
                headers=supabase_headers,
                json={
                    "room_id": room["id"] if room else "",
                    "date": current.strftime("%Y-%m-%d"),
                    "status": "booked", "booking_id": booking_id,
                },
            )
            current += timedelta(days=1)

        return {"success": True, "booking_id": booking_id,
                "reference": req["reference"]}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  TOURS
# ─────────────────────────────────────────────────────────────────────────

def get_tour_packages() -> dict:
    """Get all active tour packages from tours_catalog."""
    try:
        tours = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tours_catalog?active=eq.true&select=*&order=sort_order",
            headers=supabase_headers,
        ).json()
        return {"tours": tours}
    except Exception as e:
        return {"error": str(e)}


def request_tour_booking(
    guest_name: str, guest_phone: str, tour_name: str,
    tour_date: str, num_pax: int = 2, notes: str = "",
) -> dict:
    """Create a tour booking request."""
    try:
        tours = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tours_catalog?name=eq.{tour_name}&select=price,id",
            headers=supabase_headers,
        ).json()
        tour = tours[0] if tours else None
        price = float(tour["price"]) if tour else 0
        total = price * num_pax
        ref = f"TOUR-{datetime.now().strftime('%Y%m%d')}-{_uid()[:6].upper()}"

        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_tour_requests?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name, "guest_phone": guest_phone,
                "tour_name": tour_name, "tour_date": tour_date,
                "guests": num_pax, "amount": total, "notes": notes,
                "status": "requested", "source": "tala_chat",
                "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Tour request: {tour_name} — {tour_date}",
            description=f"{num_pax} pax. ₱{total:,.0f}. Guest: {guest_name}",
            category="front_desk", priority="high",
        )

        return {"success": True, "reference": ref,
                "tour_name": tour_name, "total_php": total}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  MOTORBIKES
# ─────────────────────────────────────────────────────────────────────────

def check_motorbike_availability(start_date: str, end_date: str) -> dict:
    """Check available motorbikes for given dates."""
    try:
        bikes = httpx.get(
            f"{SUPABASE_URL}/rest/v1/motorbikes?active=eq.true&status=eq.available&select=*",
            headers=supabase_headers,
        ).json()
        return {"available_bikes": bikes, "count": len(bikes)}
    except Exception as e:
        return {"error": str(e)}


def request_rental(
    guest_name: str, guest_phone: str, bike_name: str,
    start_date: str, end_date: str, notes: str = "",
) -> dict:
    """Create a motorbike rental request."""
    try:
        ci = datetime.strptime(start_date, "%Y-%m-%d")
        co = datetime.strptime(end_date, "%Y-%m-%d")
        days = (co - ci).days
        ref = f"RENT-{datetime.now().strftime('%Y%m%d')}-{_uid()[:6].upper()}"

        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_rental_requests?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name, "guest_phone": guest_phone,
                "bike_name": bike_name, "start_date": start_date,
                "end_date": end_date, "days": days, "notes": notes,
                "status": "requested", "source": "tala_chat",
                "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Rental request: {bike_name} — {start_date} to {end_date}",
            description=f"Guest: {guest_name}. {days} days.",
            category="front_desk", priority="high",
        )

        return {"success": True, "reference": ref,
                "bike": bike_name, "days": days}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  STAFF TASKS
# ─────────────────────────────────────────────────────────────────────────

def dispatch_staff_task(
    title: str, description: str = "", category: str = "housekeeping",
    priority: str = "normal", room_id: str = None, booking_id: str = None,
    due_at: str = None,
) -> dict:
    """Create a task and notify staff via Telegram."""
    try:
        task = httpx.post(
            f"{SUPABASE_URL}/rest/v1/staff_tasks?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "title": title, "description": description,
                "category": category, "priority": priority,
                "room_id": room_id, "booking_id": booking_id,
                "due_at": due_at, "created_by": "tala",
            },
        ).json()[0]

        if TELEGRAM_BOT_TOKEN and TELEGRAM_STAFF_CHAT_ID:
            emoji = {"urgent": "🚨", "high": "⚠️",
                     "normal": "📋", "low": "📝"}.get(priority, "📋")
            msg = (f"{emoji} *{title}*\n{category} | {priority}\n"
                   f"{description}\n\n_Task {task['id'][:16]}_")
            httpx.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_STAFF_CHAT_ID,
                      "text": msg, "parse_mode": "Markdown"},
            )

        return {"success": True, "task_id": task["id"]}
    except Exception as e:
        return {"error": str(e)}


def list_tasks(status: str = None, category: str = None) -> dict:
    """List staff tasks."""
    try:
        url = f"{SUPABASE_URL}/rest/v1/staff_tasks?order=created_at.desc&limit=50"
        if status:
            url += f"&status=eq.{status}"
        if category:
            url += f"&category=eq.{category}"
        rows = httpx.get(url, headers=supabase_headers).json()
        return {"tasks": rows, "count": len(rows)}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  FOOD ORDERS
# ─────────────────────────────────────────────────────────────────────────

def order_food(guest_name: str, guest_phone: str, items: list, notes: str = "") -> dict:
    """Create a food order."""
    try:
        total = sum(item.get("price", 0) * item.get("qty", 1) for item in items)
        ref = f"FOOD-{datetime.now().strftime('%Y%m%d')}-{_uid()[:6].upper()}"
        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_food_orders?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "reference": ref, "guest_name": guest_name,
                "guest_phone": guest_phone, "items": items,
                "total": total, "status": "pending", "notes": notes,
                "source": "tala_chat",
            },
        ).json()[0]
        dispatch_staff_task(
            title=f"Food order: {ref}",
            description=f"{len(items)} items, ₱{total:,.0f}. {guest_name}",
            category="kitchen", priority="high",
        )
        return {"success": True, "reference": ref, "total": total}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  GUEST MESSAGES
# ─────────────────────────────────────────────────────────────────────────

def send_guest_message(guest_name: str, guest_phone: str, message: str) -> dict:
    """Log a guest message to staff."""
    try:
        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_guest_messages?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name, "guest_phone": guest_phone,
                "message": message, "status": "unread",
                "source": "tala_chat",
            },
        ).json()[0]
        return {"success": True, "message_id": result["id"]}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  GUEST HISTORY
# ─────────────────────────────────────────────────────────────────────────

def get_guest_history(email: str = None, phone: str = None) -> dict:
    """Get guest's booking and rental history."""
    try:
        if email:
            guests = httpx.get(
                f"{SUPABASE_URL}/rest/v1/guests?email=eq.{email}&select=*",
                headers=supabase_headers,
            ).json()
        elif phone:
            guests = httpx.get(
                f"{SUPABASE_URL}/rest/v1/guests?phone=eq.{phone}&select=*",
                headers=supabase_headers,
            ).json()
        else:
            return {"found": False, "error": "Provide email or phone"}
        if not guests:
            return {"found": False}
        guest = guests[0]
        bookings = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?guest_name=eq.{guest['name']}"
            f"&order=created_at.desc&limit=10",
            headers=supabase_headers,
        ).json()
        rentals = httpx.get(
            f"{SUPABASE_URL}/rest/v1/motorbike_rentals?guest_name=eq.{guest['name']}"
            f"&order=created_at.desc&limit=10",
            headers=supabase_headers,
        ).json()
        return {"found": True, "guest": guest,
                "bookings": bookings, "rentals": rentals}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  EMAIL
# ─────────────────────────────────────────────────────────────────────────

def send_guest_email(to: str, subject: str, body: str) -> dict:
    """Send email via Resend."""
    try:
        if not RESEND_API_KEY:
            return {"success": False,
                    "error": "No email service configured"}
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": "Marina Terrace <hello@marinaterrace.palawan.ph>",
                "to": [to], "subject": subject, "text": body,
            },
        )
        return {"success": resp.status_code == 200}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  ESCALATION
# ─────────────────────────────────────────────────────────────────────────

def escalate_to_human(reason: str, guest_message: str = "",
                      guest_email: str = "") -> dict:
    """Escalate to a human team member."""
    try:
        if TELEGRAM_BOT_TOKEN and TELEGRAM_STAFF_CHAT_ID:
            httpx.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": TELEGRAM_STAFF_CHAT_ID,
                    "text": (f"🆘 *ESCALATION*\nReason: {reason}\n"
                             f"Guest: {guest_message}\n"
                             f"Email: {guest_email or 'N/A'}"),
                    "parse_mode": "Markdown",
                },
            )
        return {"success": True,
                "message": "A team member will respond shortly."}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  PAYMENTS
# ─────────────────────────────────────────────────────────────────────────

def record_payment(booking_request_id: str, amount: float,
                   method: str = "cash") -> dict:
    """Record a payment against a booking request."""
    try:
        req = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests"
            f"?id=eq.{booking_request_id}&select=*",
            headers=supabase_headers,
        ).json()[0]

        new_paid = float(req.get("paid_amount", 0)) + amount
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests"
            f"?id=eq.{booking_request_id}",
            headers=supabase_headers,
            json={
                "paid_amount": new_paid,
                "paid_at": datetime.now().isoformat(),
            },
        )

        httpx.post(
            f"{SUPABASE_URL}/rest/v1/payments",
            headers=supabase_headers,
            json={
                "reference": req["reference"],
                "date": datetime.now().strftime("%Y-%m-%d"),
                "category": "room", "direction": "in",
                "amount": amount, "method": method,
                "related_id": booking_request_id,
                "description": f"Payment for {req['reference']}",
            },
        )

        return {"success": True, "amount": amount,
                "total_paid": new_paid}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  REPORTS
# ─────────────────────────────────────────────────────────────────────────

def generate_report(report_type: str = "daily") -> dict:
    """Generate daily operations report."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")

        today_bookings = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?check_in=eq.{today}"
            f"&select=id,reference,guest_name,room_type",
            headers=supabase_headers,
        ).json()

        pending_tasks = httpx.get(
            f"{SUPABASE_URL}/rest/v1/staff_tasks?status=eq.pending"
            f"&select=title,priority,category",
            headers=supabase_headers,
        ).json()

        pending_requests = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests"
            f"?status=eq.pending"
            f"&select=id,guest_name,room_type,check_in",
            headers=supabase_headers,
        ).json()

        pending_tours = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_tour_requests"
            f"?status=eq.requested"
            f"&select=id,guest_name,tour_name,tour_date",
            headers=supabase_headers,
        ).json()

        unread = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_guest_messages"
            f"?status=eq.unread&select=id",
            headers=supabase_headers,
        ).json()

        bikes = httpx.get(
            f"{SUPABASE_URL}/rest/v1/motorbikes?active=eq.true&select=id,status",
            headers=supabase_headers,
        ).json()

        return {
            "date": today,
            "arrivals_today": today_bookings,
            "pending_booking_requests": len(pending_requests),
            "pending_tour_requests": len(pending_tours),
            "pending_tasks": len(pending_tasks),
            "unread_messages": len(unread),
            "motorbikes_available": len(
                [b for b in bikes if b["status"] == "available"]),
            "motorbikes_total": len(bikes),
        }
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────────────────────────────────
#  KNOWLEDGE / QUERY TOOLS  (resort-facing lookup)
# ─────────────────────────────────────────────────────────────────────────

def _fetch_tala_knowledge(topic: str = None, label: str = None,
                          limit: int = 50) -> list[dict]:
    """Read from the tala_knowledge Supabase table.

    The tala_knowledge table holds resort facts editable via the Admin
    'TALA Knowledge Base' page.  topic/label/body/tags/enabled/sort_order.
    """
    try:
        url = (f"{SUPABASE_URL}/rest/v1/tala_knowledge"
               f"?enabled=eq.true&order=sort_order.asc&limit={limit}")
        if topic:
            url += f"&topic=eq.{topic}"
        if label:
            url += f"&label=ilike.{label}"
        rows = httpx.get(url, headers=supabase_headers, timeout=20).json()
        return [r for r in rows if r.get("body")]
    except Exception:
        return []


def search_tala_knowledge(query: str) -> dict:
    """Search the resort knowledge base for a topic.

    Use this when a guest asks something that might be in the knowledge base:
    breakfast hours, WiFi policy, check-in time, pet policy, amenities,
    transport, payment methods, cancellation rules, etc.
    Always try this BEFORE saying 'I don't know'.
    """
    if not query or not query.strip():
        return {"found": False, "results": [], "error": "Empty query"}

    q = query.strip().lower()
    # Map common guest phrases to knowledge topics
    topic_map = {
        "breakfast": "operations",
        "breakfast time": "operations",
        "breakfast hours": "operations",
        "wifi": "operations",
        "internet": "operations",
        "wifi password": "operations",
        "check in": "operations",
        "check-in": "operations",
        "check out": "operations",
        "check-out": "operations",
        "pet": "operations",
        "pets": "operations",
        "dog": "operations",
        "cat": "operations",
        "airport": "transport",
        "transfer": "transport",
        "transport": "transport",
        "tricycle": "transport",
        "ferry": "transport",
        "boat": "transport",
        "bus": "transport",
        "taxi": "transport",
        "payment": "operations",
        "pay": "operations",
        "cash": "operations",
        "gcash": "operations",
        "maya": "operations",
        "bank": "operations",
        "cancel": "operations",
        "cancellation": "operations",
        "cancel booking": "operations",
        "cancel reservation": "operations",
        "refund": "operations",
        "child": "operations",
        "children": "operations",
        "kid": "operations",
        "infant": "operations",
        "baby": "operations",
        "baby cot": "operations",
        "crib": "operations",
        "extra bed": "operations",
        "room": "operations",
        "rooms": "operations",
        "suite": "operations",
        "beach house": "operations",
        "villa": "operations",
        "amenit": "operations",
        "pool": "operations",
        "gym": "operations",
        "hot shower": "operations",
        "aircon": "operations",
        "air conditioning": "operations",
        "outlet": "operations",
        "power": "operations",
        "electricity": "operations",
        "medical": "operations",
        "doctor": "operations",
        "clinic": "operations",
        "hospital": "operations",
        "pharmacy": "operations",
        "emergency": "operations",
        "first aid": "operations",
        "contact": "operations",
        "manage": "operations",
        "direction": "location",
        "how to get": "location",
        "where is": "location",
        "location": "location",
        "maps": "location",
        "el nido": "location",
        "palawan": "location",
        "how to reach": "location",
        "getting here": "location",
        "accommodation": "operations",
        "accommodations": "operations",
        "room types": "operations",
        "which room": "operations",
        "book": "operations",
        "booking": "operations",
        "reserve": "operations",
        "reservation": "operations",
        "rate": "operations",
        "price": "operations",
        "cost": "operations",
        "fee": "operations",
        "price list": "operations",
        "prices": "operations",
        "rates": "operations",
        "charge": "operations",
        "charges": "operations",
        "fees": "operations",
        "tour": "operations",
        "tours": "operations",
        "island hopping": "operations",
        "snorkel": "operations",
        "diving": "operations",
        "food": "operations",
        "meal": "operations",
        "meals": "operations",
        "food included": "operations",
        "food not included": "operations",
        "breakfast included": "operations",
        "lunch": "operations",
        "dinner": "operations",
        "private chef": "operations",
        "vegetarian": "operations",
        "vegan": "operations",
        "dietary": "operations",
        "gluten": "operations",
        "allergy": "operations",
        "halal": "operations",
        "near": "location",
        "distance": "location",
        "minutes": "location",
        "kms": "location",
        "km": "location",
        "kilometer": "location",
        "who": "staff",
        "manager": "staff",
        "staff": "staff",
        "team": "staff",
        "owner": "staff",
        "person": "staff",
        "phone number": "contact",
        "phone": "contact",
        "number": "contact",
        "email": "contact",
    }

    target_topic = None
    for key, topic in topic_map.items():
        if key in q:
            target_topic = topic
            break

    results = []
    if target_topic:
        rows = _fetch_tala_knowledge(topic=target_topic, limit=20)
        for r in rows:
            body_lower = r.get("body", "").lower()
            label_lower = r.get("label", "").lower()
            if (q in body_lower or q in label_lower
                    or any(word in body_lower for word in q.split()
                            if len(word) > 2)):
                results.append({
                    "topic": r.get("topic", ""),
                    "label": r.get("label", ""),
                    "body": r.get("body", ""),
                })
    else:
        rows = _fetch_tala_knowledge(topic="operations", limit=20)
        for r in rows:
            body_lower = r.get("body", "").lower()
            if any(word in body_lower for word in q.split()
                    if len(word) > 2):
                results.append({
                    "topic": r.get("topic", ""),
                    "label": r.get("label", ""),
                    "body": r.get("body", ""),
                })

    return {
        "found": len(results) > 0,
        "query": query,
        "results": results[:5],
    }


def query_supabase(table: str, query: str, *, limit: int = 10) -> dict:
    """Read rows from any Supabase table.

    Use ONLY for questions you cannot answer from your system prompt,
    chat cache, or the tala_knowledge table.
    Prefer more specific tools (search_tala_knowledge, get_tour_packages,
    check_availability, etc.) whenever they exist.

    table  — Supabase table name, e.g. 'rooms', 'tours_catalog',
             'motorbikes', 'cms_data', 'shifts'
    query  — simple English: 'available rooms', 'today's shifts',
             'active tours', 'food menu', 'staff on duty'
    """
    if not table or not table.strip():
        return {"error": "No table specified"}
    if not query or not query.strip():
        return {"error": "No query specified"}

    t = table.strip().lower()
    q = query.strip().lower()

    # Whitelist of tables TALA may read (no writes via this tool)
    allowed = {
        "rooms", "tours_catalog", "motorbikes", "cms_data",
        "shifts", "room_availability", "inventory_items",
        "guest_preferences", "resort_members",
    }
    if t not in allowed:
        return {"error": f"Table '{table}' is not in TALA's read-only whitelist."}

    try:
        if t == "rooms":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/rooms?status=eq.active"
                f"&select=id,name,type,capacity,rate_php,amenities"
                f"&order=rate_php.asc",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "tours_catalog":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/tours_catalog"
                f"?active=eq.true&select=*&order=sort_order",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "motorbikes":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/motorbikes"
                f"?active=eq.true&select=id,name,status,daily_rate"
                f"&order=daily_rate.asc",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "cms_data":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/cms_data"
                f"?select=key,value&order=key",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "shifts":
            today = datetime.now().strftime("%Y-%m-%d")
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/shifts"
                f"?date=eq.{today}&select=*&order=start_time",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "room_availability":
            today = datetime.now().strftime("%Y-%m-%d")
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/room_availability"
                f"?date=eq.{today}&select=room_id,date,status"
                f"&order=room_id",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "inventory_items":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/inventory_items"
                f"?select=*&order=item_name",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "guest_preferences":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/guest_preferences"
                f"?select=*&order=created_at.desc",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        if t == "resort_members":
            rows = httpx.get(
                f"{SUPABASE_URL}/rest/v1/resort_members"
                f"?select=id,name,role,phone&order=name",
                headers=supabase_headers, timeout=20).json()
            return {"table": t, "rows": rows, "count": len(rows)}

        rows = httpx.get(
            f"{SUPABASE_URL}/rest/v1/{t}"
            f"?select=*&limit={limit}",
            headers=supabase_headers, timeout=20).json()
        return {"table": t, "rows": rows, "count": len(rows)}

    except Exception as e:
        return {"error": str(e), "table": t}


# ─────────────────────────────────────────────────────────────────────────
#  TOOL REGISTRY  (canonical — both servers use this)
# ─────────────────────────────────────────────────────────────────────────

TOOL_REGISTRY: dict[str, Callable[..., Any]] = {
    "check_availability": check_availability,
    "create_booking": create_booking,
    "list_bookings": list_bookings,
    "confirm_booking": confirm_booking,
    "get_tour_packages": get_tour_packages,
    "request_tour_booking": request_tour_booking,
    "check_motorbike_availability": check_motorbike_availability,
    "request_rental": request_rental,
    "dispatch_staff_task": dispatch_staff_task,
    "list_tasks": list_tasks,
    "order_food": order_food,
    "send_guest_message": send_guest_message,
    "get_guest_history": get_guest_history,
    "record_payment": record_payment,
    "escalate_to_human": escalate_to_human,
    "generate_report": generate_report,
    "send_guest_email": send_guest_email,
    "search_tala_knowledge": search_tala_knowledge,
    "query_supabase": query_supabase,
}

# ─────────────────────────────────────────────────────────────────────────
#  TOOL SCHEMAS  (canonical — both servers use this)
# ─────────────────────────────────────────────────────────────────────────

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": (
                "Check which rooms are available for specific dates. "
                "Always call this before telling a guest a room is free."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "check_in": {"type": "string",
                                 "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string",
                                  "description": "YYYY-MM-DD"},
                    "num_guests": {"type": "integer",
                                   "description": "Number of guests"},
                },
                "required": ["check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": (
                "Create a room booking request for a guest. "
                "This creates a pending request — it is NOT a confirmed booking. "
                "Always confirm with the guest before calling."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_email": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "room_id": {"type": "string"},
                    "check_in": {"type": "string",
                                 "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string",
                                  "description": "YYYY-MM-DD"},
                    "num_guests": {"type": "integer"},
                    "special_requests": {"type": "string"},
                },
                "required": ["guest_name", "guest_email",
                             "guest_phone", "room_id",
                             "check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_bookings",
            "description": (
                "List current bookings, optionally filtered by status. "
                "Use for answering guest questions about their stay."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string",
                               "description": (
                                   "Filter: pending, confirmed, "
                                   "checked_in, checked_out, cancelled")},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "confirm_booking",
            "description": (
                "Confirm a pending booking request and create an official booking. "
                "Use the tala_booking_requests UUID as the booking_request_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_request_id": {"type": "string",
                                           "description": (
                                               "The tala_booking_requests UUID")},
                },
                "required": ["booking_request_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tour_packages",
            "description": "Get all available tour packages.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_tour_booking",
            "description": (
                "Create a tour booking request for a guest. "
                "Creates a pending request — requires staff confirmation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "tour_name": {"type": "string"},
                    "tour_date": {"type": "string",
                                  "description": "YYYY-MM-DD"},
                    "num_pax": {"type": "integer"},
                    "notes": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone",
                             "tour_name", "tour_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_motorbike_availability",
            "description": "Check available motorbikes for rental.",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                },
                "required": ["start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_rental",
            "description": (
                "Create a motorbike rental request for a guest. "
                "Creates a pending request — requires staff confirmation."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "bike_name": {"type": "string"},
                    "start_date": {"type": "string",
                                   "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string",
                                 "description": "YYYY-MM-DD"},
                    "notes": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone",
                             "bike_name", "start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "dispatch_staff_task",
            "description": (
                "Create a task for staff and optionally notify via Telegram. "
                "Categories: housekeeping, kitchen, maintenance, front_desk, grounds. "
                "Priorities: urgent, high, normal, low."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "category": {"type": "string",
                                 "enum": ["housekeeping", "kitchen",
                                          "maintenance", "front_desk",
                                          "grounds"]},
                    "priority": {"type": "string",
                                 "enum": ["urgent", "high",
                                          "normal", "low"]},
                },
                "required": ["title", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": (
                "List staff tasks, optionally filtered by status or category."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "category": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "order_food",
            "description": "Create a food order for a guest.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "items": {"type": "array",
                              "items": {"type": "object"}},
                    "notes": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone", "items"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_guest_message",
            "description": "Log a message from guest to staff.",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "message": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone", "message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_guest_history",
            "description": (
                "Look up a guest's booking and rental history by email or phone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "email": {"type": "string"},
                    "phone": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "record_payment",
            "description": "Record a payment against a booking.",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_request_id": {"type": "string"},
                    "amount": {"type": "number"},
                    "method": {"type": "string",
                               "enum": ["gcash", "maya", "cash",
                                        "bank_transfer"]},
                },
                "required": ["booking_request_id", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": (
                "Escalate to a human team member. "
                "Use for issues you cannot handle: complaints, safety, "
                "payment disputes, decisions you're unsure about."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string"},
                    "guest_message": {"type": "string"},
                    "guest_email": {"type": "string"},
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Generate daily operations report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "report_type": {"type": "string",
                                    "enum": ["daily", "weekly"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_guest_email",
            "description": "Send an email to a guest via Resend.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to": {"type": "string"},
                    "subject": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["to", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_tala_knowledge",
            "description": (
                "Search the resort knowledge base for a topic. "
                "Use this FIRST for any guest question about breakfast, "
                "WiFi, check-in/out, pets, payment, cancellation, transport, "
                "amenities, location, staff, contact info, room types, rates, "
                "tours, food, dietary, medical, or anything resort-operational. "
                "Always try this before saying 'I don't know' — it has the "
                "resort's curated answers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "Guest's question in plain English, e.g. "
                            "'what time is breakfast', 'is there wifi', "
                            "'can I bring my dog', 'how do I get here', "
                            "'what are the room rates', 'do you have a pool'. "
                            "Keep it short.")
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_supabase",
            "description": (
                "Read rows from a Supabase table when you need live data "
                "not covered by other tools or the knowledge base. "
                "Whitelisted read-only tables: rooms, tours_catalog, "
                "motorbikes, cms_data, shifts, room_availability, "
                "inventory_items, guest_preferences, resort_members. "
                "Always prefer a more specific tool if one exists "
                "(search_tala_knowledge, get_tour_packages, "
                "check_availability, etc.)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "table": {
                        "type": "string",
                        "description": (
                            "Supabase table name. One of: rooms, "
                            "tours_catalog, motorbikes, cms_data, "
                            "shifts, room_availability, inventory_items, "
                            "guest_preferences, resort_members.")
                    },
                    "query": {
                        "type": "string",
                        "description": (
                            "What you're looking for in plain English, "
                            "e.g. 'available rooms', 'today's shifts', "
                            "all tours', 'food menu'. This is a hint — "
                            "the tool returns the full table.")
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max rows to return (default 10)."
                    },
                },
                "required": ["table", "query"],
            },
        },
    },
]
