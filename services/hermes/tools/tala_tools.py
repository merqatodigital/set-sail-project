"""
TALA TOOL DEFINITIONS
Each tool is a function Tala can call during conversation.
Matches existing TEXT-ID Supabase schema.
"""

import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional

import httpx

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


# ── ROOMS (new TEXT-ID table) ──────────────────────────────────────

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
                    "amenities": room["amenities"],
                })
        return {"available": len(available) > 0, "rooms": available, "check_in": check_in, "check_out": check_out}
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

        # Insert guest record if new
        httpx.post(
            f"{SUPABASE_URL}/rest/v1/guests",
            headers={**supabase_headers, "Prefer": "resolution=merge-duplicates"},
            json={"id": _uid("guest"), "name": guest_name, "email": guest_email, "phone": guest_phone},
        )

        booking = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name,
                "guest_phone": guest_phone,
                "guest_email": guest_email,
                "room_type": room["name"],
                "check_in": check_in,
                "check_out": check_out,
                "guests": num_guests,
                "amount": total_php,
                "notes": special_requests,
                "status": "pending",
                "source": "tala_chat",
                "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Prepare {room['name']} for {guest_name}",
            description=f"Booking {ref}: {check_in} to {check_out}. {num_guests} guests.",
            category="housekeeping",
            room_id=room_id,
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

        # Look up room by name
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
                "id": booking_id,
                "reference": req["reference"],
                "guest_id": "",
                "guest_name": req["guest_name"],
                "guest_phone": req["guest_phone"],
                "room_type": req["room_type"],
                "check_in": req["check_in"],
                "check_out": req["check_out"],
                "guests": req["guests"],
                "amount": req["amount"],
                "paid_amount": 0,
                "status": "confirmed",
                "source": "tala_chat",
                "notes": req["notes"],
            },
        )

        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?id=eq.{booking_request_id}",
            headers=supabase_headers,
            json={"status": "confirmed", "confirmed_at": datetime.now().isoformat()},
        )

        # Block room dates
        ci = datetime.strptime(req["check_in"], "%Y-%m-%d")
        co = datetime.strptime(req["check_out"], "%Y-%m-%d")
        current = ci
        while current < co:
            httpx.post(
                f"{SUPABASE_URL}/rest/v1/room_availability",
                headers=supabase_headers,
                json={"room_id": room["id"] if room else "", "date": current.strftime("%Y-%m-%d"), "status": "booked", "booking_id": booking_id},
            )
            current += timedelta(days=1)

        return {"success": True, "booking_id": booking_id, "reference": req["reference"]}
    except Exception as e:
        return {"error": str(e)}


# ── TOURS (uses existing tours_catalog) ─────────────────────────────

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
                "guest_name": guest_name,
                "guest_phone": guest_phone,
                "tour_name": tour_name,
                "tour_date": tour_date,
                "guests": num_pax,
                "amount": total,
                "notes": notes,
                "status": "requested",
                "source": "tala_chat",
                "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Tour request: {tour_name} — {tour_date}",
            description=f"{num_pax} pax. ₱{total:,.0f}. Guest: {guest_name}",
            category="front_desk",
            priority="high",
        )

        return {"success": True, "reference": ref, "tour_name": tour_name, "total_php": total}
    except Exception as e:
        return {"error": str(e)}


# ── MOTORBIKES (uses existing motorbikes + tala_rental_requests) ────

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
                "guest_name": guest_name,
                "guest_phone": guest_phone,
                "bike_name": bike_name,
                "start_date": start_date,
                "end_date": end_date,
                "days": days,
                "notes": notes,
                "status": "requested",
                "source": "tala_chat",
                "reference": ref,
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Rental request: {bike_name} — {start_date} to {end_date}",
            description=f"Guest: {guest_name}. {days} days.",
            category="front_desk",
            priority="high",
        )

        return {"success": True, "reference": ref, "bike": bike_name, "days": days}
    except Exception as e:
        return {"error": str(e)}


# ── STAFF TASKS (new TEXT-ID table) ─────────────────────────────────

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
                "title": title, "description": description, "category": category,
                "priority": priority, "room_id": room_id, "booking_id": booking_id,
                "due_at": due_at, "created_by": "tala",
            },
        ).json()[0]

        if TELEGRAM_BOT_TOKEN and TELEGRAM_STAFF_CHAT_ID:
            emoji = {"urgent": "🚨", "high": "⚠️", "normal": "📋", "low": "📝"}.get(priority, "📋")
            msg = f"{emoji} *{title}*\n{category} | {priority}\n{description}\n\n_Task {task['id'][:16]}_"
            httpx.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_STAFF_CHAT_ID, "text": msg, "parse_mode": "Markdown"},
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


# ── FOOD ORDERS (uses tala_food_orders) ─────────────────────────────

def order_food(guest_name: str, guest_phone: str, items: list, notes: str = "") -> dict:
    """Create a food order."""
    try:
        total = sum(item.get("price", 0) * item.get("qty", 1) for item in items)
        ref = f"FOOD-{datetime.now().strftime('%Y%m%d')}-{_uid()[:6].upper()}"
        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_food_orders?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "reference": ref, "guest_name": guest_name, "guest_phone": guest_phone,
                "items": items, "total": total, "status": "pending", "notes": notes,
                "source": "tala_chat",
            },
        ).json()[0]
        dispatch_staff_task(
            title=f"Food order: {ref}", description=f"{len(items)} items, ₱{total:,.0f}. {guest_name}",
            category="kitchen", priority="high",
        )
        return {"success": True, "reference": ref, "total": total}
    except Exception as e:
        return {"error": str(e)}


# ── GUEST MESSAGES (uses tala_guest_messages) ──────────────────────

def send_guest_message(guest_name: str, guest_phone: str, message: str) -> dict:
    """Log a guest message to staff."""
    try:
        result = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tala_guest_messages?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_name": guest_name, "guest_phone": guest_phone,
                "message": message, "status": "unread", "source": "tala_chat",
            },
        ).json()[0]
        return {"success": True, "message_id": result["id"]}
    except Exception as e:
        return {"error": str(e)}


# ── GUEST HISTORY ──────────────────────────────────────────────────

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
            f"{SUPABASE_URL}/rest/v1/bookings?guest_name=eq.{guest['name']}&order=created_at.desc&limit=10",
            headers=supabase_headers,
        ).json()
        rentals = httpx.get(
            f"{SUPABASE_URL}/rest/v1/motorbike_rentals?guest_name=eq.{guest['name']}&order=created_at.desc&limit=10",
            headers=supabase_headers,
        ).json()
        return {"found": True, "guest": guest, "bookings": bookings, "rentals": rentals}
    except Exception as e:
        return {"error": str(e)}


# ── EMAIL ──────────────────────────────────────────────────────────

def send_guest_email(to: str, subject: str, body: str) -> dict:
    """Send email via Resend."""
    try:
        if not RESEND_API_KEY:
            return {"success": False, "error": "No email service configured"}
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": "Marina Terrace <hello@marinaterrace.palawan.ph>", "to": [to], "subject": subject, "text": body},
        )
        return {"success": resp.status_code == 200}
    except Exception as e:
        return {"error": str(e)}


# ── ESCALATION ─────────────────────────────────────────────────────

def escalate_to_human(reason: str, guest_message: str = "", guest_email: str = "") -> dict:
    """Escalate to a human team member."""
    try:
        if TELEGRAM_BOT_TOKEN and TELEGRAM_STAFF_CHAT_ID:
            httpx.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={
                    "chat_id": TELEGRAM_STAFF_CHAT_ID,
                    "text": f"🆘 *ESCALATION*\nReason: {reason}\nGuest: {guest_message}\nEmail: {guest_email or 'N/A'}",
                    "parse_mode": "Markdown",
                },
            )
        return {"success": True, "message": "A team member will respond shortly."}
    except Exception as e:
        return {"error": str(e)}


# ── PAYMENTS ───────────────────────────────────────────────────────

def record_payment(booking_request_id: str, amount: float, method: str = "cash") -> dict:
    """Record a payment against a booking request."""
    try:
        req = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?id=eq.{booking_request_id}&select=*",
            headers=supabase_headers,
        ).json()[0]

        new_paid = float(req.get("paid_amount", 0)) + amount
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?id=eq.{booking_request_id}",
            headers=supabase_headers,
            json={
                "paid_amount": new_paid,
                "paid_at": datetime.now().isoformat(),
            },
        )

        # Also log in payments table
        httpx.post(
            f"{SUPABASE_URL}/rest/v1/payments",
            headers=supabase_headers,
            json={
                "reference": req["reference"],
                "date": datetime.now().strftime("%Y-%m-%d"),
                "category": "room",
                "direction": "in",
                "amount": amount,
                "method": method,
                "related_id": booking_request_id,
                "description": f"Payment for {req['reference']}",
            },
        )

        return {"success": True, "amount": amount, "total_paid": new_paid}
    except Exception as e:
        return {"error": str(e)}


# ── REPORTS ────────────────────────────────────────────────────────

def generate_report(report_type: str = "daily") -> dict:
    """Generate daily operations report."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")

        # Today's bookings
        today_bookings = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?check_in=eq.{today}&select=id,reference,guest_name,room_type",
            headers=supabase_headers,
        ).json()

        # Pending tasks
        pending_tasks = httpx.get(
            f"{SUPABASE_URL}/rest/v1/staff_tasks?status=eq.pending&select=title,priority,category",
            headers=supabase_headers,
        ).json()

        # Pending booking requests
        pending_requests = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_booking_requests?status=eq.pending&select=id,guest_name,room_type,check_in",
            headers=supabase_headers,
        ).json()

        # Pending tour requests
        pending_tours = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_tour_requests?status=eq.requested&select=id,guest_name,tour_name,tour_date",
            headers=supabase_headers,
        ).json()

        # Unread messages
        unread = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tala_guest_messages?status=eq.unread&select=id",
            headers=supabase_headers,
        ).json()

        # Motorbike availability
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
            "motorbikes_available": len([b for b in bikes if b["status"] == "available"]),
            "motorbikes_total": len(bikes),
        }
    except Exception as e:
        return {"error": str(e)}
