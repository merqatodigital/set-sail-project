"""Small authenticated control plane for the packaged Hermes runtime.

The resort admin supplies provider connections at runtime. Secrets are written
only to the private Hermes data volume, then the real Hermes gateway is
restarted so its native agent, memory, skills, delegation, and MCP tools use
the new configuration.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOME = Path(os.environ.get("HERMES_HOME", "/data/hermes"))
ROLE = os.environ.get("HERMES_ROLE", "workforce")
MANAGER_KEY = os.environ.get("HERMES_MANAGER_KEY") or os.environ.get("API_SERVER_KEY", "")
PORT = int(os.environ.get("HERMES_MANAGER_PORT", "8650"))
GATEWAY_PORT = 8642
ENV_PATH = HOME / ".env"
CONFIG_PATH = HOME / "config.yaml"
LOCK = threading.RLock()
GATEWAY: subprocess.Popen[str] | None = None

ALLOWED_SETTINGS = {
    "OPENROUTER_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESORT_CMS_KEY",
    "GITHUB_TOKEN",
    "TALA_GITHUB_REPOSITORY",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "HERMES_MODEL",
}
SECRET_SETTINGS = {
    "OPENROUTER_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GITHUB_TOKEN",
    "RESEND_API_KEY",
}

ROLE_PROMPTS = {
    "supervisor": "You are the Hermes Workforce Supervisor for this resort. Use the workforce-supervisor skill. Break work into clear tasks, delegate specialist work, use verified resort tools, and never claim an action succeeded unless a tool returned success.",
    "finance": "You are the resort Financial Agent. Use the resort-finance skill and live resort tools. Analyze revenue, expenses, occupancy, payroll, margin, and cash flow. Never move money, change prices, or issue refunds without owner approval.",
    "leads": "You are the resort Lead Generation Agent. Use the lead-generation skill. Review and qualify leads and prepare personalized follow-up. Do not send unsolicited outreach or expose guest information.",
    "email": "You are the resort Email Agent. Use the email-operations skill. Classify communication and prepare accurate replies. Draft only unless an approved email connection and explicit send approval are present.",
    "developer": "You are the resort Developer Agent. Use the developer-agent skill. Inspect code, reproduce issues, run tests, and prepare fixes. Never push to main, merge, deploy, delete data, or expose credentials without approval.",
    "operations": "You are the resort Operations Agent. Use the resort-operations skill and live resort tools. Coordinate bookings, tours, rentals, food, messages, staff tasks, and daily briefings. Protected changes require owner approval.",
}


def _read_env() -> dict[str, str]:
    result: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
            if not line or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key in ALLOWED_SETTINGS:
                result[key] = value
    for key in ALLOWED_SETTINGS:
        if os.environ.get(key) and key not in result:
            result[key] = os.environ[key]
    return result


def _write_env(values: dict[str, str]) -> None:
    HOME.mkdir(parents=True, exist_ok=True)
    clean = {key: str(value).replace("\n", "").replace("\r", "") for key, value in values.items() if key in ALLOWED_SETTINGS}
    ENV_PATH.write_text("".join(f"{key}={clean[key]}\n" for key in sorted(clean)), encoding="utf-8")
    ENV_PATH.chmod(0o600)


def _configured(values: dict[str, str]) -> bool:
    return all(values.get(key) for key in ("OPENROUTER_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"))


def _write_config(values: dict[str, str]) -> None:
    model = values.get("HERMES_MODEL", "openai/gpt-oss-20b")
    common = f"""model:
  provider: openrouter
  default: {model}
toolsets:
  - hermes-api-server
memory:
  memory_enabled: true
  user_profile_enabled: true
  write_approval: true
delegation:
  max_concurrent_children: 3
  max_spawn_depth: 1
  orchestrator_enabled: true
  subagent_auto_approve: false
approvals:
  mode: manual
mcp_servers:
  resort:
    command: python
    args: [\"/opt/tala/mcp/resort_server.py\"]
    env:
      SUPABASE_URL: \"{values.get('SUPABASE_URL', '')}\"
      SUPABASE_SERVICE_ROLE_KEY: \"{values.get('SUPABASE_SERVICE_ROLE_KEY', '')}\"
      RESORT_CMS_KEY: \"{values.get('RESORT_CMS_KEY', 'marina_terrace_payload')}\"
    tools:
      include:
"""
    guest = ["get_resort_snapshot", "check_room_availability", "list_tours", "check_motorbike", "create_booking_request"]
    workforce = guest + ["get_daily_operations", "get_financial_snapshot", "list_leads", "create_lead", "list_guest_messages", "create_internal_task"]
    tools = guest if ROLE == "tala" else workforce
    CONFIG_PATH.write_text(common + "".join(f"        - {name}\n" for name in tools), encoding="utf-8")


def _gateway_alive() -> bool:
    return GATEWAY is not None and GATEWAY.poll() is None


def _stop_gateway() -> None:
    global GATEWAY
    if not GATEWAY or GATEWAY.poll() is not None:
        GATEWAY = None
        return
    GATEWAY.terminate()
    try:
        GATEWAY.wait(timeout=10)
    except subprocess.TimeoutExpired:
        GATEWAY.kill()
        GATEWAY.wait(timeout=5)
    GATEWAY = None


def _start_gateway() -> bool:
    global GATEWAY
    values = _read_env()
    if not _configured(values):
        return False
    _write_config(values)
    child_env = os.environ.copy()
    child_env.update(values)
    child_env.update({
        "HERMES_HOME": str(HOME),
        "API_SERVER_ENABLED": "true",
        "API_SERVER_HOST": "127.0.0.1",
        "API_SERVER_PORT": str(GATEWAY_PORT),
        "API_SERVER_KEY": MANAGER_KEY,
        "API_SERVER_MODEL_NAME": "tala" if ROLE == "tala" else "hermes-workforce",
    })
    GATEWAY = subprocess.Popen(["hermes", "gateway"], env=child_env, text=True)
    return True


def _restart_gateway() -> bool:
    with LOCK:
        _stop_gateway()
        return _start_gateway()


def _proxy_chat(payload: dict[str, Any], agent: str | None = None) -> tuple[int, dict[str, Any]]:
    if not _gateway_alive():
        return 503, {"error": "Hermes is not configured or running. Open Settings and save the required connections."}
    messages = payload.get("messages") if isinstance(payload.get("messages"), list) else []
    if agent:
        prompt = ROLE_PROMPTS.get(agent)
        if not prompt:
            return 400, {"error": "Unknown workforce agent."}
        messages = [{"role": "system", "content": prompt}, *messages]
    body = json.dumps({
        "model": "tala" if ROLE == "tala" else "hermes-workforce",
        "messages": messages,
        "stream": False,
    }).encode()
    request = urllib.request.Request(
        f"http://127.0.0.1:{GATEWAY_PORT}/v1/chat/completions",
        data=body,
        method="POST",
        headers={
            "authorization": f"Bearer {MANAGER_KEY}",
            "content-type": "application/json",
            "x-hermes-session-key": str(payload.get("session") or "admin")[:200],
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=125) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            detail = json.loads(exc.read().decode())
        except Exception:
            detail = {"error": "Hermes request failed."}
        return exc.code, detail
    except Exception:
        return 502, {"error": "Hermes gateway is temporarily unavailable."}


class Handler(BaseHTTPRequestHandler):
    server_version = "TalaHermesManager/1.0"

    def _origin(self) -> str:
        return self.headers.get("origin", "*")

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.send_header("cache-control", "no-store")
        self.send_header("access-control-allow-origin", self._origin())
        self.send_header("vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        supplied = self.headers.get("authorization", "").removeprefix("Bearer ")
        return bool(MANAGER_KEY and supplied and len(supplied) == len(MANAGER_KEY) and all(ord(a) ^ ord(b) == 0 for a, b in zip(supplied, MANAGER_KEY)))

    def _json(self) -> dict[str, Any]:
        length = min(int(self.headers.get("content-length", "0") or 0), 250_000)
        return json.loads(self.rfile.read(length) or b"{}")

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("access-control-allow-origin", self._origin())
        self.send_header("access-control-allow-methods", "GET, POST, OPTIONS")
        self.send_header("access-control-allow-headers", "authorization, content-type")
        self.send_header("vary", "Origin")
        self.end_headers()

    def do_GET(self) -> None:
        if self.path == "/health":
            self._send(200, {"ok": True, "configured": _configured(_read_env()), "gateway": _gateway_alive(), "role": ROLE})
            return
        if self.path == "/status":
            if not self._authorized():
                self._send(401, {"error": "Invalid Hermes server access key."})
                return
            values = _read_env()
            self._send(200, {
                "configured": _configured(values),
                "gateway": _gateway_alive(),
                "connections": {
                    "hermes": _gateway_alive(),
                    "openrouter": bool(values.get("OPENROUTER_API_KEY")),
                    "supabase": bool(values.get("SUPABASE_URL") and values.get("SUPABASE_SERVICE_ROLE_KEY")),
                    "email": bool(values.get("RESEND_API_KEY")),
                    "github": bool(values.get("GITHUB_TOKEN")),
                },
                "settings": {key: ("" if key in SECRET_SETTINGS else values.get(key, "")) for key in ALLOWED_SETTINGS},
                "secretsSet": {key: bool(values.get(key)) for key in SECRET_SETTINGS},
            })
            return
        self._send(404, {"error": "Not found."})

    def do_POST(self) -> None:
        if not self._authorized():
            self._send(401, {"error": "Invalid Hermes server access key."})
            return
        try:
            payload = self._json()
        except Exception:
            self._send(400, {"error": "Invalid JSON."})
            return
        if self.path == "/configure":
            current = _read_env()
            incoming = payload.get("settings") if isinstance(payload.get("settings"), dict) else {}
            for key in ALLOWED_SETTINGS:
                if key not in incoming:
                    continue
                value = str(incoming[key] or "").strip()
                if value:
                    current[key] = value
                elif key not in SECRET_SETTINGS:
                    current.pop(key, None)
            _write_env(current)
            started = _restart_gateway()
            self._send(200, {"ok": True, "configured": _configured(current), "gatewayStarting": started})
            return
        if self.path == "/workforce":
            status, result = _proxy_chat(payload, str(payload.get("agent") or ""))
            self._send(status, result)
            return
        if self.path == "/v1/chat/completions":
            status, result = _proxy_chat(payload)
            self._send(status, result)
            return
        self._send(404, {"error": "Not found."})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[manager] {self.address_string()} {format % args}")


def _shutdown(*_: Any) -> None:
    with LOCK:
        _stop_gateway()
    raise SystemExit(0)


if __name__ == "__main__":
    if not MANAGER_KEY:
        raise SystemExit("HERMES_MANAGER_KEY or API_SERVER_KEY is required")
    HOME.mkdir(parents=True, exist_ok=True)
    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)
    _start_gateway()
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
