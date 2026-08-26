"""
TALA AGENT — Full Site Operator
FastAPI server with tool-calling via OpenRouter

Uses the canonical shared tool module (tala.tools) so both servers
(tala_server.py and tala/server.py) share one set of tools and schemas.
"""
import json
import os
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from tala.tools import (
    check_availability,
    create_booking,
    list_bookings,
    confirm_booking,
    get_tour_packages,
    request_tour_booking,
    check_motorbike_availability,
    request_rental,
    dispatch_staff_task,
    list_tasks,
    order_food,
    send_guest_message,
    get_guest_history,
    record_payment,
    escalate_to_human,
    generate_report,
    send_guest_email,
)
from tala.tools import TOOL_REGISTRY, TOOL_SCHEMAS
from prompts.tala_system import TALA_SYSTEM_PROMPT
from chat_cache import get_cached_answer

app = FastAPI(title="Tala Agent — Marina Terrace")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = os.environ.get("HERMES_MODEL", "meta-llama/llama-3.1-8b-instruct")


@app.get("/health")
async def health():
    return {"status": "healthy", "agent": "tala", "timestamp": datetime.now().isoformat()}


@app.post("/chat")
async def chat(request: Request):
    start = time.time()
    body = await request.json()
    message = body.get("message", "").strip()
    history = body.get("history", [])
    session_id = body.get("session_id", "anonymous")

    if not message:
        return JSONResponse({"error": "Empty message"}, status_code=400)

    # Check cache first
    cached = get_cached_answer(message)
    if cached:
        elapsed = round((time.time() - start) * 1000)
        return JSONResponse({
            "response": cached,
            "cached": True,
            "response_time_ms": elapsed,
        })

    # Build messages for LLM
    messages = [{"role": "system", "content": TALA_SYSTEM_PROMPT}]
    for msg in history[-8:]:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
    messages.append({"role": "user", "content": message})

    # Call OpenRouter with tool-calling
    max_tool_rounds = 3
    for _round in range(max_tool_rounds):
        try:
            llm_response = httpx.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://marinaterrace.palawan.ph",
                    "X-Title": "Tala Agent",
                },
                json={
                    "model": OPENROUTER_MODEL,
                    "messages": messages,
                    "tools": TOOL_SCHEMAS,
                    "max_tokens": 500,
                    "temperature": 0.7,
                },
                timeout=30,
            )

            if llm_response.status_code == 429:
                return JSONResponse({
                    "response": "I'm handling a lot of requests right now. Give me a moment and try again!",
                    "cached": False,
                    "response_time_ms": round((time.time() - start) * 1000),
                })

            data = llm_response.json()
            choice = data.get("choices", [{}])[0]
            message_obj = choice.get("message", {})
            tool_calls = message_obj.get("tool_calls", [])
            content = message_obj.get("content", "")

            # If no tool calls, return the text response
            if not tool_calls:
                elapsed = round((time.time() - start) * 1000)
                return JSONResponse({
                    "response": content or "I'm not sure about that. Let me check with the team!",
                    "cached": False,
                    "response_time_ms": elapsed,
                })

            # Execute tool calls
            messages.append(message_obj)
            for tc in tool_calls:
                fn = tc.get("function", {})
                tool_name = fn.get("name", "")
                tool_args = json.loads(fn.get("arguments", "{}"))

                tool_fn = TOOL_REGISTRY.get(tool_name)
                if tool_fn:
                    result = tool_fn(**tool_args)
                else:
                    result = {"error": f"Unknown tool: {tool_name}"}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": json.dumps(result),
                })

        except httpx.TimeoutException:
            return JSONResponse({
                "response": "I'm taking a bit longer than usual. Please try again!",
                "cached": False,
                "response_time_ms": round((time.time() - start) * 1000),
            })
        except Exception:
            return JSONResponse({
                "response": "I'm having a technical moment. Please try again!",
                "cached": False,
                "response_time_ms": round((time.time() - start) * 1000),
            })

    # After max tool rounds, get final text response
    elapsed = round((time.time() - start) * 1000)
    return JSONResponse({
        "response": content or "I've processed your request. Let me know if you need anything else!",
        "cached": False,
        "response_time_ms": elapsed,
    })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8650)
