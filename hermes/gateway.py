"""Hermes-compatible OpenAI-format gateway for this Ubuntu instance.

Exposes:
  GET  /v1/health  → 200 OK
  GET  /v1/models  → list of available models (Bearer auth)
  POST /v1/chat/completions → run task on this instance (Bearer auth)

Backend priority:
  1. Ollama (localhost:11434) — local Qwen model via `ollama pull qwen2.5:3b`
  2. GOOGLE_API_KEY           — Gemini via Google AI Studio API (free tier)
  3. ANTHROPIC_API_KEY        — Claude via Anthropic API
  4. (none)                   — bash execution fallback
"""

import asyncio
import os
import time
import uuid

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

API_KEY = os.environ.get("API_SERVER_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")
MODEL_ID = "hermes-agent"

app = FastAPI(title="Hermes Gateway")


def _check_auth(request: Request) -> None:
    if not API_KEY:
        return
    auth = request.headers.get("Authorization", "")
    token = auth.removeprefix("Bearer ").strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


async def _ollama_available() -> bool:
    """Return True if Ollama is running and the model is available."""
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{OLLAMA_HOST}/api/tags")
            if r.status_code != 200:
                return False
            models = [m["name"] for m in r.json().get("models", [])]
            return any(OLLAMA_MODEL in m for m in models)
    except Exception:
        return False


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    model: str = MODEL_ID
    messages: list[ChatMessage]
    stream: bool = False


@app.get("/v1/health")
async def health():
    if await _ollama_available():
        backend = f"ollama:{OLLAMA_MODEL}"
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

    if await _ollama_available():
        result = await _run_via_ollama(body.messages)
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


async def _run_via_ollama(messages: list[ChatMessage]) -> str:
    """Forward the request to a local Ollama model."""
    api_messages = [
        {"role": m.role, "content": m.content}
        for m in messages
        if m.role in ("user", "assistant", "system")
    ]
    payload = {
        "model": OLLAMA_MODEL,
        "messages": api_messages,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
            r.raise_for_status()
            return r.json()["message"]["content"]
    except Exception as exc:
        return f"Ollama error: {exc}"


async def _run_via_gemini(prompt: str, messages: list[ChatMessage]) -> str:
    """Forward the request to Google Gemini via generativelanguage.googleapis.com."""
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


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("GATEWAY_PORT", "8642"))
    host = os.environ.get("GATEWAY_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port, log_level="info")
