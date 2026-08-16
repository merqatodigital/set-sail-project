"""
Server-side chat cache for instant answers to common questions.
"""

from functools import lru_cache
from typing import Optional


def get_cached_answer(message: str) -> Optional[str]:
    """Try to match a message against cached answers. Returns None if no match."""
    lower = message.lower()

    cache = {
        ("wifi", "wi-fi", "internet", "password"): (
            "📶 Our WiFi network:\n\n"
            "• Network: MarinaTerrace_Guest\n"
            "• Password: Palawan2025!\n\n"
            "Speed: ~30Mbps (fiber). Good for video calls and remote work. "
            "We also have a Starlink backup for outages."
        ),
        ("check-in", "check in", "arrival"): (
            "🏨 Check-in is from 2:00 PM.\n\n"
            "Early check-in is possible if the room is ready (subject to availability). "
            "Just message us your arrival time and we'll do our best!"
        ),
        ("check-out", "check out", "departure"): (
            "🏨 Check-out is at 12:00 noon.\n\n"
            "Late check-out until 2:00 PM is complimentary if we don't have incoming guests. "
            "Beyond that, it's 50% of the room rate."
        ),
        ("airport", "transfer", "pickup", "van", "transport"): (
            "🚐 Airport Transfer Options:\n\n"
            "• Puerto Princesa Airport → Resort: ₱1,500 (private van, ~45 min)\n"
            "• Shared van: ₱500/person (scheduled times)\n"
            "• Tricycle: ₱200 (budget option, ~30 min)\n\n"
            "We'll arrange it for you! Just tell us your flight number and arrival time."
        ),
        ("payment", "pay", "gcash", "cash", "card", "credit"): (
            "💳 Payment Methods:\n\n"
            "• GCash ✅\n• Maya ✅\n• Cash (PHP/USD) ✅\n"
            "• Bank transfer (BDO/BPI) ✅\n• Credit cards (3% fee) ✅\n\n"
            "We require 50% deposit to confirm booking, balance on check-in."
        ),
        ("island hopping", "tour", "elnido", "coron", "lagoon"): (
            "🚤 Tour Packages:\n\n"
            "**Island Hopping Tour A** — ₱1,800/person (min 4 pax)\n"
            "Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos\n"
            "Includes lunch, life vest, snorkel gear. 8AM-4PM\n\n"
            "**Tour B** — ₱1,600/person\n"
            "Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach\n\n"
            "**Underground River** — ₱2,500/person\n"
            "UNESCO site, includes permits, lunch, van\n\n"
            "Want me to check availability for specific dates?"
        ),
        ("room", "rate", "price", "cost", "how much", "booking"): (
            "🏨 Room Rates (per night):\n\n"
            "• **Garden View Room** — ₱2,500\n"
            "• **Sea Breeze Room** — ₱3,500\n"
            "• **Deluxe Terrace Suite** — ₱5,000\n"
            "• **Full Villa (4 pax)** — ₱7,500\n\n"
            "All rooms include: breakfast, WiFi, hot shower, daily housekeeping.\n\n"
            "Which dates are you looking at? I can check availability for you."
        ),
        ("breakfast", "food", "meal", "restaurant", "eat"): (
            "🍳 Meal Options:\n\n"
            "**Included:** Breakfast (7-10 AM) — Filipino + Continental\n\n"
            "**Add-on Meals:**\n• Lunch: ₱350/person\n• Dinner: ₱450/person\n"
            "• Full board (3 meals): ₱700/person/day\n\n"
            "**Dietary:** We accommodate vegetarian, vegan, and halal.\n"
            "We also have a shared kitchen for guests who prefer to cook."
        ),
        ("location", "where", "address", "directions"): (
            "📍 Marina Terrace is located in El Nido area, Palawan.\n\n"
            "**Getting here:**\n"
            "• From Puerto Princesa: 4-5 hrs by van\n"
            "• From El Nido town proper: 10 min by tricycle\n"
            "• From Lio Airport: 15 min by van\n\n"
            "We'll send you a pin location once your booking is confirmed!"
        ),
        ("cancel", "refund", "cancellation"): (
            "📋 Cancellation Policy:\n\n"
            "• 7+ days before check-in: Full refund\n"
            "• 3-6 days before: 50% refund\n"
            "• 0-2 days before: No refund\n\n"
            "To cancel, just reply here with your booking reference."
        ),
    }

    for keywords, answer in cache.items():
        if any(kw in lower for kw in keywords):
            return answer

    return None
