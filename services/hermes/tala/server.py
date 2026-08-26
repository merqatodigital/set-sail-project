"""
TALA SERVER — Level 4 Async Agent Runtime
Matches ResortChat.tsx expected response format exactly.
Non-blocking. Cached. Tool-executing. Logged.
"""

import os
import json
import time
import logging
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from tool_schemas import TALA_TOOLS
from tools import TOOL_REGISTRY
from chat_cache import get_cached_answer

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
logger = logging.getLogger("tala.server")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
MODEL = os.environ.get("TALA_MODEL", "meta-llama/llama-3.1-8b-instruct")
SITE_URL = os.environ.get("SITE_URL", "https://marinaterrace.ph")
API_SERVER_KEY = os.environ.get("HERMES_TALA_API_KEY", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

SYSTEM_PROMPT = """You are TALA — the AI concierge and operations assistant for Marina Terrace Resort, a small beachfront resort in the El Nido area of Palawan, Philippines.

You are warm, professional, calm, and genuinely helpful. You are the first person a guest talks to when they arrive at the resort's website. You are not a chatbot. You are like a knowledgeable friend who happens to run the entire resort operations backend.

## WHO YOU ARE

- Friendly, warm, natural. Speak like a real person, not a corporate bot.
- Slightly casual but always professional. You are running a real business.
- Use at most 2 emojis per message. Only when they genuinely add warmth — never as decoration.
- Keep responses under 200 words unless you are presenting booking details. Guests read on phones.
- If the guest writes in Filipino, you reply in Filipino. If they mix languages, match them.
- You are proud of this resort. You speak about it like you care — because you do.

## WHAT YOU KNOW COLD

You have these facts memorized. Do not make up anything outside them.

- Resort name: Marina Terrace Resort
- Location: El Nido area, Palawan, Philippines (not El Nido town proper — about 10 minutes away by tricycle)
- Check-in: 2:00 PM | Check-out: 12:00 NN (noon)
- WiFi network: MarinaTerrace_Guest, password: Palawan2025!
- WiFi speed: ~30 Mbps fiber, Starlink backup for outages
- Breakfast: Included for all guests, 7:00 AM – 10:00 AM, Filipino and Continental options
- Shared kitchen: Available for guests who want to cook
- Tour desk: On-site, guests can book tours directly

Room rates (per night, subject to availability — always check with your tools before quoting):
- Garden View Room — ₱2,500 (sleeps 2)
- Sea Breeze Room — ₱3,500 (sleeps 2)
- Deluxe Terrace Suite — ₱5,000 (sleeps 3)
- Full Villa — ₱7,500 (sleeps 4)

All rooms include: daily breakfast, WiFi, hot shower, daily housekeeping.

Tours and activities:
- Island Hopping Tour A — ₱1,800 per person (min 4 pax) — Big Lagoon, Small Lagoon, Secret Lagoon, Seven Commandos. 8 AM–4 PM. Includes lunch, life vest, snorkel gear.
- Island Hopping Tour B — ₱1,600 per person — Cadugnon, Helicopter Island, Matinloc Shrine, Hidden Beach.
- Underground River Tour — ₱2,500 per person — UNESCO World Heritage Site, includes permits, lunch, van transport.
- Sunset Beach Tour — ₱2,200 per person — beach hopping with sunset views.

Payment methods: GCash, Maya, cash (PHP or USD), bank transfer (BDO/BPI), credit cards (3% processing fee).
Deposit: 50% required to confirm a booking, balance due on check-in.

Cancellation policy:
- 7+ days before check-in: Full refund
- 3–6 days before check-in: 50% refund
- 0–2 days before check-in: No refund

Airport transfer (Puerto Princesa Airport to resort):
- Private van: ₱1,500 (approx. 45 minutes)
- Shared van: ₱500 per person (scheduled times)
- Tricycle: ₱200 (budget option)

Meal add-ons (beyond included breakfast):
- Lunch: ₱350 per person
- Dinner: ₱450 per person
- Full board (3 meals): ₱700 per person per day

Dietary: Vegetarian, vegan, and halal meals accommodated — let the kitchen know in advance.

Getting here:
- From Puerto Princesa city: 4–5 hours by van
- From El Nido town proper: 10 minutes by tricycle
- From Lio Airport (ENI): 15 minutes by van

Pets: Pet-friendly with prior notice.

Emergency / medical: Nearest clinic is El Nido Municipal Hospital (approx. 10 minutes). Nearest pharmacy in El Nido town proper.

Resort facilities: Garden terrace, shared kitchen, on-site tour desk, WiFi throughout. No pool, no gym on-site.

Nearest town facilities (El Nido, 10 min by tricycle): ATMs, shops, restaurants, bars, pharmacies, massage services.

Electricity: 220V, Philippines standard outlets (Type A/B — flat parallel pins). Backup generator available.

## HOW YOU OPERATE — STEP BY STEP

1. When a guest asks something, always check if you have a direct answer from your knowledge first.
2. If the question is about rooms, tours, or availability: use your tools to get live data. Never guess availability, prices, or booking status.
3. If you use a tool, tell the guest what you found in plain language.
4. Before creating any booking or request: confirm the key details with the guest. Never assume.
5. After creating a booking request: give the guest the reference number, room, dates, total price, deposit amount, and payment methods. Tell them the resort team will confirm it.
6. If a tool fails or returns an error: apologize briefly, say you will handle it manually, and escalate if needed. Do not make the guest repeat themselves.
7. A booking request is NOT a confirmed booking. Always say so clearly: "I've sent this to our team for confirmation."
8. If the guest is asking about something that affects their stay (wrong room, broken AC, missed booking, etc.): acknowledge the problem warmly, apologize, and take action or escalate immediately. Do not just say "sorry" repeatedly.

## RULES — FOLLOW THESE EVERY TIME

- NEVER tell a guest a room is available without checking with your tools first.
- NEVER make up prices, availability, policies, or resort facts. If you do not know, say "Let me check that for you" and use your tools or escalate.
- ALWAYS confirm before creating anything: name, contact, dates, room/tour/rental, and any special requests.
- ALWAYS tell the guest a booking request is pending confirmation — not confirmed.
- Keep responses concise. Under 200 words unless showing booking details.
- If a guest is upset, angry, or reporting a problem: listen, acknowledge, apologize once meaningfully, then act. Escalate if you cannot fix it yourself.
- For anything involving safety, medical issues, serious complaints, payment disputes, or decisions you are unsure about: escalate to a human immediately. Say "Let me get our team on this right away."
- Currency is Philippine Pesos (₱). Mention it the first time you quote a price in a conversation.
- You represent Marina Terrace Resort. Every message is from the resort to the guest. Be the staff member you would want to meet when you arrive tired after a long trip.

## WHEN YOU DON'T KNOW

If you genuinely do not have the information — no tool covers it, the data isn't there — say so honestly:

"I'm not sure about that exact detail — let me find out for you."

Then either use your tools to find out, or escalate to a human. Never bluff, never make something up, never give a guess as if it were fact.

## YOUR TOOLS

You have these tools available. Use them — do not rely on memory for anything that changes:
- check_availability — live room availability for dates
- create_booking — create a booking request (pending confirmation)
- list_bookings — see current bookings
- confirm_booking — confirm a pending booking request
- get_tour_packages — list available tours
- request_tour_booking — create a tour booking request
- check_motorbike_availability — check motorbike rental availability
- request_rental — create a motorbike rental request
- dispatch_staff_task — assign a task to staff
- list_tasks — see staff tasks
- order_food — create a food order for a guest
- send_guest_message — relay a message from guest to staff
- get_guest_history — look up a guest's booking and rental history
- record_payment — record a payment against a booking
- escalate_to_human — escalate an issue to the team
- generate_report — generate daily operations report
- send_guest_email — send an email to a guest

- search_tala_knowledge — search the resort knowledge base (try this FIRST for any guest question about breakfast, WiFi, check-in, pets, etc.)
- query_supabase — read live data from a Supabase table (use only when no other tool covers it)

## EVERY INTERACTION

- Greet warmly but do not overdo it.
- If the guest is asking a question you can answer from memory, answer directly and concisely.
- If you need to check something, say what you are checking and why.
- Present results clearly. For bookings, always include: reference number, room, dates, total, deposit, payment methods, and the fact that the team will confirm.
- End with a helpful next step or an open question: "Would you like me to check availability for those dates?" "Can I help with anything else?"

Marina Terrace Resort. El Nido area, Palawan. You are TALA. Be warm, be accurate, be useful.
"""


app = FastAPI(title="Tala Agent", version="4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatPayload(BaseModel):
    message: str
    history: List[ChatMessage] = []
    session_id: Optional[str] = None


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "agent": "tala",
        "level": 4,
        "model": MODEL,
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/ready")
async def ready():
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                },
            )
            if resp.status_code == 200:
                return {"ready": True, "provider": "openrouter", "model": MODEL}
    except Exception as e:
        logger.warning(f"Ready check failed: {e}")
    return JSONResponse({"ready": False}, status_code=503)


@app.post("/api/chat")
async def handle_chat(payload: ChatPayload):
    start_time = time.time()
    message = payload.message.strip()
    session_id = payload.session_id or "anonymous"

    if not message:
        return JSONResponse({
            "response": "How can I help you today?",
            "cache_hit": False,
            "response_time_ms": 0,
        })

    cached_answer = get_cached_answer(message)
    if cached_answer:
        elapsed = int((time.time() - start_time) * 1000)
        logger.info(f"[CACHE HIT] {elapsed}ms | {message[:50]}")
        await log_chat(session_id, "user", message, cache_hit=True)
        await log_chat(session_id, "assistant", cached_answer, cache_hit=True)
        return JSONResponse({
            "response": cached_answer,
            "cache_hit": True,
            "response_time_ms": elapsed,
        })

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for msg in payload.history[-8:]:
        if msg.role in ("user", "assistant") and msg.content.strip():
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": message})

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": SITE_URL,
                    "X-Title": "Marina Terrace",
                },
                json={
                    "model": MODEL,
                    "messages": messages,
                    "tools": TALA_TOOLS,
                    "tool_choice": "auto",
                    "max_tokens": 600,
                    "temperature": 0.7,
                },
            )

            if resp.status_code == 429:
                logger.warning("[429] Rate limited by OpenRouter")
                return JSONResponse({
                    "response": "I'm helping several guests right now. Please try again in a moment!",
                    "cache_hit": False,
                    "response_time_ms": int((time.time() - start_time) * 1000),
                    "rate_limited": True,
                })

            if resp.status_code != 200:
                logger.error(f"[OpenRouter Error] {resp.status_code}: {resp.text[:200]}")
                return JSONResponse({
                    "response": "I'm having a brief technical hiccup. Please try again in a few seconds.",
                    "cache_hit": False,
                    "response_time_ms": int((time.time() - start_time) * 1000),
                })

            data = resp.json()
            choice = data["choices"][0]["message"]

    except httpx.TimeoutException:
        logger.error("[Timeout] OpenRouter request timed out (30s)")
        return JSONResponse({
            "response": "That took a bit too long. Could you try asking again?",
            "cache_hit": False,
            "response_time_ms": int((time.time() - start_time) * 1000),
        })
    except Exception as e:
        logger.error(f"[LLM Error] {e}")
        return JSONResponse({
            "response": "I'm having connectivity issues. Please try again shortly.",
            "cache_hit": False,
            "response_time_ms": int((time.time() - start_time) * 1000),
        })

    tool_used = None

    if choice.get("tool_calls"):
        tool_call = choice["tool_calls"][0]
        func_name = tool_call["function"]["name"]
        tool_used = func_name

        try:
            func_args = json.loads(tool_call["function"]["arguments"] or "{}")
        except json.JSONDecodeError:
            func_args = {}

        logger.info(f"[Tool Call] {func_name}({json.dumps(func_args)[:100]})")

        tool_fn = TOOL_REGISTRY.get(func_name)
        if tool_fn:
            try:
                tool_result = await tool_fn(**func_args)
            except Exception as e:
                logger.error(f"[Tool Error] {func_name}: {e}")
                tool_result = {"success": False, "error": str(e)}
        else:
            tool_result = {"success": False, "error": f"Tool '{func_name}' not found"}

        logger.info(f"[Tool Result] {func_name}: {json.dumps(tool_result)[:200]}")

        messages.append(choice)
        messages.append({
            "role": "tool",
            "tool_call_id": tool_call.get("id", "call_0"),
            "content": json.dumps(tool_result),
        })

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                follow_up_resp = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_KEY}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": SITE_URL,
                        "X-Title": "Marina Terrace",
                    },
                    json={
                        "model": MODEL,
                        "messages": messages,
                        "max_tokens": 400,
                        "temperature": 0.7,
                    },
                )

                if follow_up_resp.status_code == 200:
                    final_text = follow_up_resp.json()["choices"][0]["message"]["content"]
                else:
                    final_text = format_tool_result_fallback(func_name, tool_result)

        except Exception:
            final_text = format_tool_result_fallback(func_name, tool_result)

    else:
        final_text = choice.get("content", "I'm not sure about that. Let me connect you with our team!")

    elapsed = int((time.time() - start_time) * 1000)
    logger.info(f"[LLM] {elapsed}ms | tool={tool_used} | {message[:50]}")

    await log_chat(session_id, "user", message, tool_called=tool_used)
    await log_chat(session_id, "assistant", final_text, tool_called=tool_used)

    return JSONResponse({
        "response": final_text,
        "cache_hit": False,
        "tool_used": tool_used,
        "response_time_ms": elapsed,
    })


@app.get("/report")
async def get_report(request: Request):
    if not verify_auth(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    from tools import generate_report
    return JSONResponse(await generate_report())


@app.get("/tasks")
async def get_tasks(request: Request, status: str = "pending"):
    if not verify_auth(request):
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/rest/v1/staff_tasks",
                params={"status": f"eq.{status}", "select": "*", "order": "created_at.desc", "limit": "50"},
                headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
            )
            return JSONResponse(resp.json())
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


def verify_auth(request: Request) -> bool:
    auth_header = request.headers.get("Authorization", "")
    return auth_header == f"Bearer {API_SERVER_KEY}"


def format_tool_result_fallback(func_name: str, result: dict) -> str:
    if func_name == "check_room_availability":
        if result.get("available"):
            rooms = result.get("rooms", [])
            lines = [f"Good news! {len(rooms)} room(s) available:\n"]
            for r in rooms:
                lines.append(f"- {r.get('name', 'Room')} - PHP {r.get('rate_php', '?'):,.0f}/night")
            return "\n".join(lines)
        return "Sorry, no rooms available for those dates. Would you like to try different dates?"

    elif func_name == "create_resort_booking":
        if result.get("success"):
            return (
                f"Booking confirmed!\n"
                f"Reference: {result.get('booking_reference')}\n"
                f"Room: {result.get('room')}\n"
                f"Dates: {result.get('check_in')} to {result.get('check_out')}\n"
                f"Total: PHP {result.get('total_php', 0):,.0f}\n"
                f"Deposit due: PHP {result.get('deposit_php', 0):,.0f}\n\n"
                f"I'll send payment details to your email shortly!"
            )
        return f"Booking failed: {result.get('error', 'Unknown error')}. Let me try to help manually."

    elif func_name == "get_tour_packages":
        tours = result.get("tours", [])
        if tours:
            lines = ["Available Tours:\n"]
            for t in tours:
                lines.append(f"- {t.get('name')} - PHP {t.get('price_php', '?'):,.0f}/pax ({t.get('duration', '')})")
            return "\n".join(lines)
        return "No tours available right now. Please check back later!"

    elif func_name == "search_tala_knowledge":
        if result.get("found") and result.get("results"):
            lines = []
            for r in result["results"]:
                lines.append(f"{r.get('label', 'Knowledge')}: {r.get('body', '')}")
            return "\n".join(lines)
        return "I checked our knowledge base but couldn't find that specific info. Let me check with the team!"

    elif func_name == "query_supabase":
        rows = result.get("rows", [])
        if rows:
            if len(rows) == 1:
                return json.dumps(rows[0], indent=2)
            lines = [f"Found {len(rows)} entries:"]
            for r in rows[:10]:
                lines.append(f"- {json.dumps(r)}")
            if len(rows) > 10:
                lines.append(f"... and {len(rows) - 10} more")
            return "\n".join(lines)
        return "No results found."

    else:
        return json.dumps(result, indent=2)


async def log_chat(session_id: str, role: str, content: str, tool_called: str = None, cache_hit: bool = False):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(
                f"{SUPABASE_URL}/rest/v1/chat_logs",
                headers={
                    "apikey": SUPABASE_KEY,
                    "Authorization": f"Bearer {SUPABASE_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "session_id": session_id,
                    "role": role,
                    "content": content[:2000],
                    "tool_called": tool_called,
                    "cache_hit": cache_hit,
                },
            )
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8650, log_level="info")
