"""
TALA AGENT — Full Site Operator
FastAPI server with tool-calling via OpenRouter
"""

import json
import os
import time
from datetime import datetime

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import httpx

from tools.tala_tools import (
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

TOOLS = {
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
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check which rooms are available for specific dates",
            "parameters": {
                "type": "object",
                "properties": {
                    "check_in": {"type": "string", "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string", "description": "YYYY-MM-DD"},
                    "num_guests": {"type": "integer"},
                },
                "required": ["check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": "Create a room booking request for a guest",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_email": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "room_id": {"type": "string"},
                    "check_in": {"type": "string", "description": "YYYY-MM-DD"},
                    "check_out": {"type": "string", "description": "YYYY-MM-DD"},
                    "num_guests": {"type": "integer"},
                    "special_requests": {"type": "string"},
                },
                "required": ["guest_name", "guest_email", "guest_phone", "room_id", "check_in", "check_out"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_bookings",
            "description": "List current bookings, optionally filtered by status",
            "parameters": {
                "type": "object",
                "properties": {
                    "status": {"type": "string", "description": "Filter by status: pending, confirmed, checked_in, checked_out, cancelled"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "confirm_booking",
            "description": "Confirm a pending booking request and create an official booking",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_request_id": {"type": "string", "description": "The tala_booking_requests UUID"},
                },
                "required": ["booking_request_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_tour_packages",
            "description": "Get all available tour packages",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "request_tour_booking",
            "description": "Create a tour booking request for a guest",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "tour_name": {"type": "string"},
                    "tour_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "num_pax": {"type": "integer"},
                    "notes": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone", "tour_name", "tour_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_motorbike_availability",
            "description": "Check available motorbikes for rental",
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
            "description": "Create a motorbike rental request",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "bike_name": {"type": "string"},
                    "start_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "YYYY-MM-DD"},
                    "notes": {"type": "string"},
                },
                "required": ["guest_name", "guest_phone", "bike_name", "start_date", "end_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "dispatch_staff_task",
            "description": "Create a task for staff and optionally notify via Telegram",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "category": {"type": "string", "enum": ["housekeeping", "kitchen", "maintenance", "front_desk", "grounds"]},
                    "priority": {"type": "string", "enum": ["urgent", "high", "normal", "low"]},
                },
                "required": ["title", "category"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_tasks",
            "description": "List staff tasks, optionally filtered by status or category",
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
            "description": "Create a food order for a guest",
            "parameters": {
                "type": "object",
                "properties": {
                    "guest_name": {"type": "string"},
                    "guest_phone": {"type": "string"},
                    "items": {"type": "array", "items": {"type": "object"}},
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
            "description": "Log a message from guest to staff",
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
            "description": "Look up a guest's booking and rental history",
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
            "description": "Record a payment against a booking",
            "parameters": {
                "type": "object",
                "properties": {
                    "booking_request_id": {"type": "string"},
                    "amount": {"type": "number"},
                    "method": {"type": "string", "enum": ["gcash", "maya", "cash", "bank_transfer"]},
                },
                "required": ["booking_request_id", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Escalate to a human team member",
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
            "description": "Generate daily operations report",
            "parameters": {
                "type": "object",
                "properties": {
                    "report_type": {"type": "string", "enum": ["daily", "weekly"]},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_guest_email",
            "description": "Send an email to a guest via Resend",
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
]


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

                tool_fn = TOOLS.get(tool_name)
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
