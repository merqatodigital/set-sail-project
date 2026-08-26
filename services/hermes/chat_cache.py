"""
Chat cache — instant answers to common guest questions.
No LLM call needed. Updated to cover the full range of questions
guests ask before and during their stay.
"""


def get_cached_answer(message: str) -> str | None:
    """Return a cached response if the message matches a known pattern.
    Returns None if no match — fall through to the LLM."""
    lower = message.lower()

    cache: dict[tuple[str, ...], str] = {
        # ── Greetings ────────────────────────────────────────────────
        (
            "hi", "hello", "hey", "good morning", "good afternoon",
            "good evening", "greetings", "mabuhay", "howdy",
        ): (
            "Hi there! 👋 Welcome to Marina Terrace Resort, Palawan. "
            "I'm TALA, your AI concierge. I can help you with:\n\n"
            "• Checking room availability and booking\n"
            "• Tour packages and activities\n"
            "• Airport transfers\n"
            "• Restaurant and meal info\n"
            "• Resort amenities and facilities\n"
            "• Anything else about your stay\n\n"
            "What can I help you with today?"
        ),
        (
            "how are you", "how're you", "how do you do", "how do you doing",
        ): (
            "I'm doing well, thank you! 😊 Ready to help you with your "
            "Marina Terrace Resort plans. What can I do for you?"
        ),

        # ── Room rates and availability ──────────────────────────────
        (
            "how much", "how much is", "price", "prices", "rate", "rates",
            "cost", "costs", "fee", "fees", "expensive", "cheap", "affordable",
            "room rate", "room prices", "room rate", "how much for",
        ): (
            "Here are our room rates (per night):\n\n"
            "• Garden View Room — ₱2,500 (sleeps 2)\n"
            "• Sea Breeze Room — ₱3,500 (sleeps 2)\n"
            "• Deluxe Terrace Suite — ₱5,000 (sleeps 3)\n"
            "• Full Villa — ₱7,500 (sleeps 4)\n\n"
            "All rooms include breakfast, WiFi, hot shower, and daily housekeeping. "
            "Rates are subject to availability — want me to check if we have "
            "rooms free for your dates?"
        ),
        (
            "which room", "room types", "room type", "what room", "rooms",
            "room options", "different rooms", "room category", "room categories",
        ): (
            "We have four room types:\n\n"
            "• **Garden View Room** (₱2,500/night) — cozy room overlooking "
            "our garden, sleeps 2\n"
            "• **Sea Breeze Room** (₱3,500/night) — sea-view room, sleeps 2\n"
            "• **Deluxe Terrace Suite** (₱5,000/night) — larger suite with "
            "terrace, sleeps 3\n"
            "• **Full Villa** (₱7,500/night) — our largest option, sleeps 4, "
            "great for families or groups\n\n"
            "All include breakfast, WiFi, hot shower, and daily housekeeping. "
            "Want me to check availability for your dates?"
        ),
        (
            "check availability", "available", "availability", "free rooms",
            "open rooms", "room available", "are there rooms", "do you have rooms",
            "any rooms left", "rooms free", "book a room", "reserve a room",
            "make a reservation", "i want to book", "i'd like to book",
            "book now", "reserve now", "i want to stay", "i want to reserve",
        ): (
            "I'd love to help you book! 🎉 I just need a few details:\n\n"
            "1. Which room you're interested in (Garden View, Sea Breeze, "
            "Deluxe Terrace Suite, or Full Villa)\n"
            "2. Your check-in and check-out dates\n"
            "3. How many guests\n"
            "4. Your name and phone number (so we can confirm)\n\n"
            "Which room catches your eye?"
        ),

        # ── Tours ─────────────────────────────────────────────────────
        (
            "tour", "tours", "island hopping", "island hopping tour", "elnido tour",
            "underground river", "sunset beach", "boat tour", "boat trips",
            "what tours", "tour packages", "tour options", "trips", "activities",
            "things to do", "snorkel", "snorkeling", "diving", "dive",
        ): (
            "We offer four great tour options:\n\n"
            "• **Island Hopping Tour A** — ₱1,800/person (min 4 pax) — "
            "Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos. "
            "8 AM–4 PM. Includes lunch, life vest, snorkel gear.\n"
            "• **Island Hopping Tour B** — ₱1,600/person — "
            "Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach.\n"
            "• **Underground River Tour** — ₱2,500/person — "
            "UNESCO site, includes permits, lunch, van transport.\n"
            "• **Sunset Beach Tour** — ₱2,200/person — "
            "Beach hopping with beautiful sunset views.\n\n"
            "Want me to check availability for your dates?"
        ),

        # ── Food and meals ────────────────────────────────────────────
        (
            "food", "eat", "restaurant", "dining", "menu", "meal", "meals",
            "breakfast", "lunch", "dinner", "food options", "food available",
            "where to eat", "what to eat", "halal", "vegetarian", "vegan",
            "dietary", "allergy", "cook", "kitchen", "cook ourselves",
            "self cook", "shared kitchen", "cooking",
        ): (
            "Great questions about food! 🍳\n\n"
            "**Breakfast** is included for all guests, served 7:00 AM–10:00 AM. "
            "We offer both Filipino and Continental options.\n\n"
            "**Meal add-ons** (beyond breakfast):\n"
            "• Lunch: ₱350/person\n"
            "• Dinner: ₱450/person\n"
            "• Full board (3 meals/day): ₱700/person/day\n\n"
            "**Dietary needs:** We accommodate vegetarian, vegan, and halal — "
            "just let the kitchen know in advance.\n\n"
            "We also have a **shared kitchen** if you prefer to cook yourself. "
            "Want to order a meal or arrange something?"
        ),

        # ── WiFi and connectivity ─────────────────────────────────────
        (
            "wifi", "wi-fi", "wi fi", "internet", "connected", "connection",
            "network", "password", "passwords", "login", "hotspot", "signal",
            "online", "work", "remote work", "video call", "zoom", "teams",
            "stable", "fast", "speed", "Mbps",
        ): (
            "Our WiFi is ready for you! 📶\n\n"
            "• **Network:** MarinaTerrace_Guest\n"
            "• **Password:** Palawan2025!\n"
            "• **Speed:** About 30 Mbps fiber, with Starlink backup for "
            "any outages\n\n"
            "Good for video calls, streaming, and remote work. "
            "If you ever have issues, just let us know and we'll help."
        ),

        # ── Transportation and transfers ──────────────────────────────
        (
            "airport", "transfer", "transport", "van", "pickup", "drop off",
            "airport transfer", "puerto princesa", "how to get here",
            "getting here", "getting to", "arrive", "arrival", "flight",
            "taxi", "tricycle", "car", "ride", "ride from",
        ): (
            "Here are your transfer options from Puerto Princesa Airport "
            "to the resort:\n\n"
            "• **Private van** — ₱1,500 (approx. 45 minutes, door to door)\n"
            "• **Shared van** — ₱500/person (scheduled times)\n"
            "• **Tricycle** — ₱200 (budget option)\n\n"
            "We can arrange the transfer for you — just let me know your "
            "flight details and arrival time. Also, from El Nido town proper "
            "it's only a 10-minute tricycle ride, and from Lio Airport (ENI) "
            "about 15 minutes by van."
        ),

        # ── Check-in / Check-out ──────────────────────────────────────
        (
            "check in", "checkin", "check-in", "arrival time", "early check in",
            "early checkin", "late check out", "late checkout", "check out late",
            "can i check in", "what time", "what time is check",
            "when can i", "when do i",
        ): (
            "**Check-in:** from 2:00 PM\n"
            "**Check-out:** at 12:00 noon\n\n"
            "Early check-in is possible if the room is ready — just let us "
            "know your arrival time and we'll do our best. Late check-out "
            "until 2:00 PM is complimentary if we don't have incoming guests. "
            "Beyond that, it's 50% of the room rate for the extra time."
        ),

        # ── Payment ───────────────────────────────────────────────────
        (
            "pay", "payment", "paypal", "gcash", "maya", "cash", "credit card",
            "debit card", "bank", "transfer", "deposit", "down payment",
            "balance", "pay now", "payment method", "how to pay",
        ): (
            "We accept several payment methods:\n\n"
            "• **GCash** ✅\n"
            "• **Maya** ✅\n"
            "• **Cash** (PHP or USD) ✅\n"
            "• **Bank transfer** (BDO/BPI) ✅\n"
            "• **Credit cards** ✅ (3% processing fee)\n\n"
            "We require a **50% deposit** to confirm your booking, and the "
            "balance is due on check-in. Want me to help you with a booking?"
        ),

        # ── Cancellation and refunds ──────────────────────────────────
        (
            "cancel", "cancellation", "refund", "cancel booking", "cancel reservation",
            "change booking", "modify booking", "cancel my", "cancel the",
            "refund policy", "cancellation policy", "cancel my booking",
            "cancel reservation",
        ): (
            "Here's our cancellation policy:\n\n"
            "• **7+ days before check-in:** Full refund\n"
            "• **3–6 days before check-in:** 50% refund\n"
            "• **0–2 days before check-in:** No refund\n\n"
            "If you need to cancel or change your booking, just let me know "
            "your booking reference and I'll take care of it. Want me to "
            "look up your booking?"
        ),

        # ── Pets ──────────────────────────────────────────────────────
        (
            "pet", "pets", "dog", "dogs", "cat", "cats", "animal", "animals",
            "bring my dog", "bring my cat", "bringing a pet", "pet friendly",
            "pets allowed", "are pets",
        ): (
            "Yes, we're pet-friendly! 🐾 Just let us know in advance what "
            "kind of pet you're bringing and we'll make sure everything is "
            "ready for your furry friend. We just ask for prior notice so we "
            "can prepare."
        ),

        # ── Location and directions ───────────────────────────────────
        (
            "where", "location", "address", "directions", "location", "map",
            "google maps", "how to find", "how to get to", "nearest airport",
            "nearest town", "el nido", "elnido", "palawan", "manila",
        ): (
            "Marina Terrace Resort is in the **El Nido area, Palawan, "
            "Philippines** — about 10 minutes by tricycle from El Nido town "
            "proper.\n\n"
            "Getting here:\n"
            "• From Puerto Princesa city: 4–5 hours by van\n"
            "• From El Nido town: 10 minutes by tricycle\n"
            "• From Lio Airport (ENI): 15 minutes by van\n\n"
            "We'll send you a Google Maps pin once your booking is confirmed. "
            "Need help with transfers?"
        ),

        # ── Facilities and amenities ──────────────────────────────────
        (
            "pool", "swimming pool", "pool?", "gym", "fitness", "spa", "massage",
            "facilities", "amenities", "amenity", "what do you have", "what's on site",
            "on site", "on-site", "beach", "beaches", "sea", "ocean", "coast",
            "garden", "terrace", "view", "scenery", "scenic",
        ): (
            "Here's what we have on site:\n\n"
            "• **Garden terrace** with ocean views\n"
            "• **Shared kitchen** for guests who want to cook\n"
            "• **Tour desk** to book tours right here\n"
            "• **WiFi** throughout the property\n\n"
            "We don't have a swimming pool or gym on-site, but we're just "
            "10 minutes from El Nido town where you'll find beaches, ATMs, "
            "restaurants, shops, pharmacies, and massage services. "
            "The beautiful lagoons and beaches of El Nido are a short trip away."
        ),

        # ── Electricity and practicalities ────────────────────────────
        (
            "power", "electricity", "voltage", "outlet", "plug", "adapter",
            "220", "110", "type a", "type b", "type c", "outlets", "charging",
            "charger", "generator", "outage", "brownout", "power cut",
            "water", "shower", "hot water", "toilet", "bathroom",
        ): (
            "Practical info for your stay:\n\n"
            "• **Electricity:** 220V, Philippines standard. Outlets are "
            "Type A/B (flat parallel pins, like US style). We have a backup "
            "generator for any outages.\n"
            "• **Water:** Clean running water, hot showers in all rooms.\n"
            "• **Mosquitoes:** We provide mosquito nets and repellent — "
            "Palawan is tropical, so bring your own repellent if you're "
            "sensitive.\n"
            "• **Sun:** Strong tropical sun — bring sunscreen. We have some "
            "available at the front desk.\n\n"
            "Anything else you're wondering about?"
        ),

        # ── Emergency and safety ──────────────────────────────────────
        (
            "emergency", "emergency contact", "emergency number", "hospital",
            "clinic", "doctor", "medical", "sick", "ill", "illness", "medicine",
            "pharmacy", "first aid", "safety", "urgent", "help", "police",
            "ambulance", "911", "999", "emergency",
        ): (
            "**Emergency and medical info:**\n\n"
            "• **Nearest clinic/hospital:** El Nido Municipal Hospital "
            "(approx. 10 minutes by tricycle)\n"
            "• **Nearest pharmacy:** El Nido town proper\n"
            "• **Resort first aid:** Available at the front desk\n\n"
            "For urgent issues at any hour, message us here and we'll respond "
            "as fast as we can. In a life-threatening emergency, call local "
            "emergency services first, then let us know so we can help. "
            "We're here for you."
        ),

        # ── Staff and contact ─────────────────────────────────────────
        (
            "contact", "phone number", "phone", "email", "whatsapp", "contact us",
            "get in touch", "manager", "owner", "who runs", "staff", "human",
            "talk to a person", "speak to someone", "real person", "call",
        ): (
            "You're already talking to the resort's AI concierge — TALA! 😊\n\n"
            "I can help with most things directly. For anything I can't handle, "
            "I'll connect you with our team.\n\n"
            "You can also reach us by:\n"
            "• **WhatsApp** — message us on the number you used to reach us\n"
            "• **Email** — hello@marinaterrace.palawan.ph\n\n"
            "For urgent issues at any hour, just message here and we'll respond "
            "as fast as we can. We're a small team — if we're asleep, we'll "
            "see your message when we wake up and get right back to you."
        ),

        # ── Booking status and confirmations ──────────────────────────
        (
            "my booking", "my reservation", "booking reference", "reservation number",
            "my booking reference", "where is my booking", "booking status",
            "reservation status", "can you check my booking", "check my booking",
            "my booking status", "where is my reservation",
        ): (
            "I can check on your booking! Could you share your booking reference "
            "number or the email address you used when booking? That way I can "
            "look up your reservation and tell you exactly what's going on."
        ),
        (
            "confirm", "confirmation", "booking confirmed", "reservation confirmed",
            "confirmed booking", "is my booking confirmed", "did you confirm",
            "has my booking been confirmed",
        ): (
            "Let me check on that for you! If you have a booking reference, "
            "share it and I'll look up the status. If you haven't received "
            "confirmation yet, it usually means our team is still reviewing "
            "your request — I can follow up on it right now if you'd like."
        ),

        # ── General resort info ────────────────────────────────────────
        (
            "about", "tell me about", "what is", "what's", "tell me more",
            "more info", "info", "information", "about the resort", "about marina",
            "about marina terrace", "resort info", "tell me",
        ): (
            "Marina Terrace Resort is a small, friendly beachfront resort in "
            "the El Nido area of Palawan, Philippines. We're about 10 minutes "
            "by tricycle from El Nido town proper.\n\n"
            "We have four room types (Garden View, Sea Breeze, Deluxe Terrace "
            "Suite, and Full Villa), all with breakfast, WiFi, hot shower, and "
            "daily housekeeping included.\n\n"
            "We're pet-friendly, we have a shared kitchen, an on-site tour desk, "
            "and we can arrange airport transfers for you.\n\n"
            "What would you like to know specifically?"
        ),
    }

    for keywords, answer in cache.items():
        if any(kw in lower for kw in keywords):
            return answer

    return None
