"""Hermes-compatible OpenAI-format gateway for this Ubuntu instance.

Exposes:
  GET  /v1/health  → 200 OK
  GET  /v1/models  → list of available models (Bearer auth)
  POST /v1/chat/completions → run task on this instance (Bearer auth)
  POST /v1/browse  → run a browser-use agent task (Bearer auth)

Backend priority:
  1. MINIMAX_API_KEY   — MiniMax M1 via api.minimaxi.chat
  2. GOOGLE_API_KEY    — Gemini via generativelanguage.googleapis.com (free tier)
  3. ANTHROPIC_API_KEY — Claude via Anthropic API
  4. (none)            — bash execution fallback
"""

import asyncio
import os
import time
import uuid
from pathlib import Path

# Load ~/.hermes/.env before reading any env vars
_env_file = Path.home() / ".hermes" / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _, _v = _line.partition("=")
        os.environ.setdefault(_k.strip(), _v.strip())

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

API_KEY = os.environ.get("API_SERVER_KEY", "")
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY", "")
MINIMAX_MODEL = os.environ.get("MINIMAX_MODEL", "MiniMax-Text-01")
MINIMAX_BASE_URL = os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.io/v1")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL_ID = "hermes-agent"

app = FastAPI(title="Hermes Gateway")


def _check_auth(request: Request) -> None:
    if not API_KEY:
        return
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = MODEL_ID
    messages: list[ChatMessage]
    stream: bool = False


@app.get("/v1/health")
async def health():
    if MINIMAX_API_KEY:
        backend = f"minimax:{MINIMAX_MODEL}"
    elif GOOGLE_API_KEY:
        backend = f"gemini:{GEMINI_MODEL}"
    elif ANTHROPIC_API_KEY:
        backend = "claude"
    else:
        backend = "bash"
    return {"status": "ok", "backend": backend}


@app.get("/v1/models")
async def models(request: Request):
    _check_auth(request)
    return {
        "object": "list",
        "data": [
            {"id": MODEL_ID, "object": "model", "created": int(time.time()), "owned_by": "hermes"}
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request, body: ChatRequest):
    _check_auth(request)

    prompt = ""
    for msg in body.messages:
        if msg.role == "user":
            prompt = msg.content

    if not prompt:
        raise HTTPException(status_code=400, detail="No user message found")

    if MINIMAX_API_KEY:
        result = await _run_via_minimax(body.messages)
        if result.startswith("MiniMax error:") and GOOGLE_API_KEY:
            result = await _run_via_gemini(prompt, body.messages)
        elif result.startswith("MiniMax error:") and ANTHROPIC_API_KEY:
            result = await _run_via_claude(prompt, body.messages)
    elif GOOGLE_API_KEY:
        result = await _run_via_gemini(prompt, body.messages)
    elif ANTHROPIC_API_KEY:
        result = await _run_via_claude(prompt, body.messages)
    else:
        result = await _run_bash(prompt)

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL_ID,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


async def _run_via_minimax(messages: list[ChatMessage]) -> str:
    """Forward the request to MiniMax API (OpenAI-compatible format)."""
    api_messages = [
        {"role": m.role, "content": m.content}
        for m in messages
        if m.role in ("user", "assistant", "system")
    ]
    payload = {
        "model": MINIMAX_MODEL,
        "messages": api_messages,
        "stream": False,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{MINIMAX_BASE_URL}/chat/completions",
                json=payload,
                headers=headers,
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        return f"MiniMax error: {exc}"


async def _run_via_gemini(prompt: str, messages: list[ChatMessage]) -> str:
    """Forward the request to Google Gemini (generativelanguage.googleapis.com)."""
    try:
        contents = []
        for m in messages:
            if m.role == "user":
                contents.append({"role": "user", "parts": [{"text": m.content}]})
            elif m.role == "assistant":
                contents.append({"role": "model", "parts": [{"text": m.content}]})

        payload = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": (
                    "You are Hermes, an AI assistant with full access to a Linux Ubuntu instance. "
                    "Help the user with tasks, commands, and anything they need on this system."
                )}]
            },
            "generationConfig": {"maxOutputTokens": 4096},
        }
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={GOOGLE_API_KEY}"
        )
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as exc:
        return f"Gemini error: {exc}"


async def _run_bash(command: str) -> str:
    """Execute a bash command and return its output."""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd="/home/user",
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=120)
        output = stdout.decode("utf-8", errors="replace").strip()
        rc = proc.returncode
        if rc != 0:
            return f"Exit code {rc}:\n{output}"
        return output or "(command completed with no output)"
    except asyncio.TimeoutError:
        return "Command timed out after 120 seconds"
    except Exception as exc:
        return f"Error running command: {exc}"


async def _run_via_claude(prompt: str, messages: list[ChatMessage]) -> str:
    """Forward the request to Claude via the Anthropic API."""
    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        api_messages = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        response = await client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=(
                "You are Hermes, an AI assistant with full access to a Linux Ubuntu instance. "
                "Help the user with tasks, commands, and anything they need on this system."
            ),
            messages=api_messages,
        )
        return response.content[0].text
    except Exception as exc:
        return f"Claude API error: {exc}"


CHROMIUM_PATH = os.environ.get(
    "CHROMIUM_PATH",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
)
GATEWAY_PORT = int(os.environ.get("GATEWAY_PORT", "8642"))
GATEWAY_API_KEY = os.environ.get("API_SERVER_KEY", "")


class BrowseRequest(BaseModel):
    task: str
    max_steps: int = 20


@app.post("/v1/browse")
async def browse(request: Request, body: BrowseRequest):
    _check_auth(request)
    result = await asyncio.get_event_loop().run_in_executor(
        None, _run_browser_task, body.task, body.max_steps
    )
    return {"task": body.task, "result": result}


def _run_browser_task(task: str, max_steps: int) -> str:
    """Run a browser-use agent task synchronously in a thread."""
    try:
        import asyncio as _asyncio
        from browser_use import Agent
        from browser_use.llm.openai.chat import ChatOpenAI as BUChatOpenAI
        from browser_use.browser import BrowserProfile

        llm = BUChatOpenAI(
            model=MODEL_ID,
            base_url=f"http://127.0.0.1:{GATEWAY_PORT}/v1",
            api_key=GATEWAY_API_KEY or "no-key",
        )

        profile = BrowserProfile(
            executable_path=CHROMIUM_PATH,
            headless=True,
            user_data_dir="/tmp/hermes-browser-profile",
            chromium_sandbox=False,
            disable_security=True,
            enable_default_extensions=False,
        )

        async def _run():
            agent = Agent(
                task=task,
                llm=llm,
                browser_profile=profile,
                max_steps=max_steps,
                use_vision=False,
            )
            result = await agent.run()
            return str(result)

        loop = _asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_run())
        finally:
            loop.close()

    except Exception as exc:
        return f"Browser-use error: {exc}"


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("GATEWAY_PORT", "8642"))
    host = os.environ.get("GATEWAY_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port, log_level="info")
