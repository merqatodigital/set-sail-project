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

SYSTEM_PROMPT = """You are Tala, the AI operations coordinator for Marina Terrace Resort in El Nido, Palawan, Philippines.

You are NOT a generic chatbot. You run this resort. You have tools to:
- Check real room availability (NEVER guess — always call the tool)
- Create bookings
- Dispatch tasks to staff
- Send emails to guests
- Get tour packages
- Escalate issues to humans

BEHAVIORAL RULES:
1. NEVER tell a guest a room is available without calling check_room_availability first.
2. Before creating a booking, confirm: name, email, room type, dates. Ask if missing.
3. After creating a booking, tell the guest: reference number, total, deposit amount, payment method.
4. Keep responses under 150 words unless presenting booking details.
5. Be warm, professional, slightly casual. Like a friendly resort manager.
6. Use at most 2 emojis per message.
7. If guest speaks Filipino, respond in Filipino.
8. If you cannot resolve something, call escalate_to_human.
9. Currency is Philippine Pesos.
10. If a tool fails, apologize and say you will handle it manually.

ROOM RATES (reference only — always verify with tool):
- Garden View: 2500 PHP/night (2 pax)
- Sea Breeze: 3500 PHP/night (2 pax)
- Deluxe Terrace Suite: 5000 PHP/night (3 pax)
- Full Villa: 7500 PHP/night (4 pax)

All rates include breakfast, WiFi, hot shower, daily housekeeping.
Check-in: 2:00 PM | Check-out: 12:00 NN
Payment: GCash, Maya, bank transfer, cash, cards (3 percent fee)
Deposit: 50 percent to confirm, balance on check-in.
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
