"""
TALA TOOL DEFINITIONS
Each tool is a function Tala can call during conversation.
"""

import json
import os
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


def check_availability(check_in: str, check_out: str, num_guests: int = 2) -> dict:
    """Check which rooms are available for given dates."""
    try:
        rooms = httpx.get(
            f"{SUPABASE_URL}/rest/v1/rooms?status=eq.active&select=*",
            headers=supabase_headers,
        ).json()

        available_rooms = []
        for room in rooms:
            if room["capacity"] < num_guests:
                continue

            blocked = httpx.get(
                f"{SUPABASE_URL}/rest/v1/room_availability?"
                f"room_id=eq.{room['id']}"
                f"&date=gte.{check_in}"
                f"&date=lt.{check_out}"
                f"&status=in.(booked,blocked,maintenance)"
                f"&select=id",
                headers=supabase_headers,
            ).json()

            if len(blocked) == 0:
                available_rooms.append({
                    "room_id": room["id"],
                    "name": room["name"],
                    "type": room["type"],
                    "capacity": room["capacity"],
                    "rate_php": room["rate_php"],
                    "amenities": room["amenities"],
                })

        return {
            "available": len(available_rooms) > 0,
            "rooms": available_rooms,
            "check_in": check_in,
            "check_out": check_out,
            "num_guests": num_guests,
        }
    except Exception as e:
        return {"error": str(e)}


def create_booking(
    guest_name: str,
    guest_email: str,
    guest_phone: str,
    room_id: str,
    check_in: str,
    check_out: str,
    num_guests: int = 2,
    special_requests: str = "",
) -> dict:
    """Create a new booking and block the dates."""
    try:
        ci = datetime.strptime(check_in, "%Y-%m-%d")
        co = datetime.strptime(check_out, "%Y-%m-%d")
        nights = (co - ci).days

        room = httpx.get(
            f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{room_id}&select=rate_php,name",
            headers=supabase_headers,
        ).json()[0]

        total_php = room["rate_php"] * nights
        deposit_php = total_php * 0.5
        ref = f"MT-{datetime.now().year}-{datetime.now().strftime('%m%d')}-{os.urandom(2).hex().upper()}"

        guest_resp = httpx.post(
            f"{SUPABASE_URL}/rest/v1/guests?on_conflict=email",
            headers={**supabase_headers, "Prefer": "return=representation,resolution=merge-duplicates"},
            json={
                "email": guest_email,
                "phone": guest_phone,
                "first_name": guest_name.split()[0],
                "last_name": " ".join(guest_name.split()[1:]) or "",
            },
        ).json()[0]

        booking = httpx.post(
            f"{SUPABASE_URL}/rest/v1/bookings?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "reference": ref,
                "guest_id": guest_resp["id"],
                "room_id": room_id,
                "check_in": check_in,
                "check_out": check_out,
                "num_guests": num_guests,
                "status": "pending",
                "total_php": total_php,
                "deposit_php": deposit_php,
                "balance_php": total_php - deposit_php,
                "special_requests": special_requests,
                "source": "website",
            },
        ).json()[0]

        current = ci
        while current < co:
            httpx.post(
                f"{SUPABASE_URL}/rest/v1/room_availability",
                headers=supabase_headers,
                json={
                    "room_id": room_id,
                    "date": current.strftime("%Y-%m-%d"),
                    "status": "booked",
                    "booking_id": booking["id"],
                },
            )
            current += timedelta(days=1)

        dispatch_staff_task(
            title=f"Prepare {room['name']} for {guest_name}",
            description=f"Booking {ref}: {check_in} to {check_out}. {num_guests} guests. Requests: {special_requests}",
            category="housekeeping",
            priority="normal",
            room_id=room_id,
        )

        return {
            "success": True,
            "booking_reference": ref,
            "room": room["name"],
            "check_in": check_in,
            "check_out": check_out,
            "nights": nights,
            "total_php": total_php,
            "deposit_php": deposit_php,
            "balance_php": total_php - deposit_php,
            "guest_id": guest_resp["id"],
            "booking_id": booking["id"],
        }
    except Exception as e:
        return {"error": str(e)}


def send_payment_link(booking_id: str, amount_php: float, method: str = "gcash") -> dict:
    """Generate and send payment instructions."""
    try:
        booking = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?id=eq.{booking_id}&select=*,guests(email,first_name)",
            headers=supabase_headers,
        ).json()[0]

        guest = booking["guests"]
        instructions = {
            "gcash": f"Send ₱{amount_php:,.0f} to GCash. Reference: {booking['reference']}",
            "maya": f"Send ₱{amount_php:,.0f} via Maya. Reference: {booking['reference']}",
            "bank_transfer": f"Transfer ₱{amount_php:,.0f} to BDO. Reference: {booking['reference']}",
        }

        httpx.post(
            f"{SUPABASE_URL}/rest/v1/payments",
            headers=supabase_headers,
            json={
                "booking_id": booking_id,
                "guest_id": booking["guest_id"],
                "amount_php": amount_php,
                "method": method,
                "type": "charge",
                "status": "pending",
            },
        )

        if RESEND_API_KEY and guest.get("email"):
            send_guest_email(
                to=guest["email"],
                subject=f"Payment Instructions — {booking['reference']}",
                body=f"Hi {guest['first_name']},\n\nPlease pay ₱{amount_php:,.0f} via {method.upper()}.\nReference: {booking['reference']}\n\nMarina Terrace Team",
            )

        return {
            "success": True,
            "method": method,
            "amount_php": amount_php,
            "instructions": instructions.get(method, instructions["gcash"]),
        }
    except Exception as e:
        return {"error": str(e)}


def dispatch_staff_task(
    title: str,
    description: str = "",
    category: str = "housekeeping",
    priority: str = "normal",
    room_id: str = None,
    booking_id: str = None,
    due_at: str = None,
) -> dict:
    """Create a task and notify staff via Telegram."""
    try:
        task = httpx.post(
            f"{SUPABASE_URL}/rest/v1/staff_tasks?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "title": title,
                "description": description,
                "category": category,
                "priority": priority,
                "room_id": room_id,
                "booking_id": booking_id,
                "due_at": due_at,
                "created_by": "tala",
            },
        ).json()[0]

        if TELEGRAM_BOT_TOKEN and TELEGRAM_STAFF_CHAT_ID:
            priority_emoji = {"urgent": "🚨", "high": "⚠️", "normal": "📋", "low": "📝"}
            emoji = priority_emoji.get(priority, "📋")
            msg = f"{emoji} *{title}*\n{category} | {priority}\n{description}\n\n_Task {task['id'][:8]}_"
            httpx.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                json={"chat_id": TELEGRAM_STAFF_CHAT_ID, "text": msg, "parse_mode": "Markdown"},
            )

        return {"success": True, "task_id": task["id"]}
    except Exception as e:
        return {"error": str(e)}


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


def update_room_status(room_id: str, status: str) -> dict:
    """Update room status."""
    try:
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/rooms?id=eq.{room_id}",
            headers=supabase_headers,
            json={"status": status, "updated_at": datetime.now().isoformat()},
        )
        return {"success": True, "room_id": room_id, "new_status": status}
    except Exception as e:
        return {"error": str(e)}


def get_tour_packages() -> dict:
    """Get all active tour packages."""
    try:
        tours = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tours?is_active=eq.true&select=*",
            headers=supabase_headers,
        ).json()
        return {"tours": tours}
    except Exception as e:
        return {"error": str(e)}


def book_tour(tour_id: str, guest_id: str, date: str, num_pax: int, booking_id: str = None) -> dict:
    """Book a tour for a guest."""
    try:
        tour = httpx.get(
            f"{SUPABASE_URL}/rest/v1/tours?id=eq.{tour_id}&select=*",
            headers=supabase_headers,
        ).json()[0]

        total = tour["price_php"] * num_pax
        tour_booking = httpx.post(
            f"{SUPABASE_URL}/rest/v1/tour_bookings?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "tour_id": tour_id,
                "guest_id": guest_id,
                "booking_id": booking_id,
                "date": date,
                "num_pax": num_pax,
                "total_php": total,
                "status": "pending",
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Tour: {tour['name']} — {date}",
            description=f"{num_pax} pax. ₱{total:,.0f}. Operator: {tour.get('operator_name', 'TBD')}",
            category="front_desk",
            priority="high",
        )

        return {"success": True, "tour_booking_id": tour_booking["id"], "tour_name": tour["name"], "total_php": total}
    except Exception as e:
        return {"error": str(e)}


def arrange_transport(
    guest_id: str,
    transport_type: str,
    date: str,
    time: str = "",
    pickup: str = "",
    dropoff: str = "",
    num_pax: int = 1,
    booking_id: str = None,
) -> dict:
    """Arrange transportation for a guest."""
    try:
        transport = httpx.post(
            f"{SUPABASE_URL}/rest/v1/transport_bookings?select=*",
            headers={**supabase_headers, "Prefer": "return=representation"},
            json={
                "guest_id": guest_id,
                "booking_id": booking_id,
                "type": transport_type,
                "date": date,
                "time": time,
                "pickup_location": pickup,
                "dropoff_location": dropoff,
                "num_pax": num_pax,
                "status": "pending",
            },
        ).json()[0]

        dispatch_staff_task(
            title=f"Transport: {transport_type} on {date}",
            description=f"{pickup or 'TBD'} → {dropoff or 'TBD'}. {num_pax} pax. {time or 'TBD'}",
            category="front_desk",
            priority="high",
        )

        return {"success": True, "transport_id": transport["id"], "type": transport_type, "status": "pending"}
    except Exception as e:
        return {"error": str(e)}


def get_guest_history(email: str) -> dict:
    """Get a guest's booking history."""
    try:
        guest = httpx.get(
            f"{SUPABASE_URL}/rest/v1/guests?email=eq.{email}&select=*",
            headers=supabase_headers,
        ).json()
        if not guest:
            return {"found": False}
        guest = guest[0]
        bookings = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?guest_id=eq.{guest['id']}&select=*,rooms(name)&order=created_at.desc",
            headers=supabase_headers,
        ).json()
        return {"found": True, "guest": guest, "bookings": bookings, "total_stays": guest["total_stays"], "is_vip": guest["is_vip"]}
    except Exception as e:
        return {"error": str(e)}


def apply_discount(booking_id: str, discount_percent: float, reason: str) -> dict:
    """Apply a discount to a booking."""
    try:
        booking = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?id=eq.{booking_id}&select=*",
            headers=supabase_headers,
        ).json()[0]
        discount_amount = booking["total_php"] * (discount_percent / 100)
        new_total = booking["total_php"] - discount_amount
        httpx.patch(
            f"{SUPABASE_URL}/rest/v1/bookings?id=eq.{booking_id}",
            headers=supabase_headers,
            json={"total_php": new_total, "balance_php": new_total - booking["deposit_php"]},
        )
        return {"success": True, "original_total": booking["total_php"], "discount_amount": discount_amount, "new_total": new_total}
    except Exception as e:
        return {"error": str(e)}


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


def generate_report(report_type: str = "daily") -> dict:
    """Generate occupancy/revenue report."""
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        check_ins = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?check_in=eq.{today}&status=in.(confirmed,checked_in)&select=*,rooms(name),guests(first_name,last_name)",
            headers=supabase_headers,
        ).json()
        check_outs = httpx.get(
            f"{SUPABASE_URL}/rest/v1/bookings?check_out=eq.{today}&status=eq.checked_in&select=*,rooms(name),guests(first_name,last_name)",
            headers=supabase_headers,
        ).json()
        total_rooms = httpx.get(f"{SUPABASE_URL}/rest/v1/rooms?status=eq.active&select=id", headers=supabase_headers).json()
        booked_today = httpx.get(f"{SUPABASE_URL}/rest/v1/room_availability?date=eq.{today}&status=eq.booked&select=id", headers=supabase_headers).json()
        occupancy = (len(booked_today) / max(len(total_rooms), 1)) * 100
        pending_tasks = httpx.get(f"{SUPABASE_URL}/rest/v1/staff_tasks?status=eq.pending&select=title,priority,category", headers=supabase_headers).json()

        return {
            "date": today,
            "occupancy_percent": round(occupancy, 1),
            "rooms_booked": len(booked_today),
            "total_rooms": len(total_rooms),
            "check_ins_today": len(check_ins),
            "check_outs_today": len(check_outs),
            "pending_tasks": len(pending_tasks),
        }
    except Exception as e:
        return {"error": str(e)}
