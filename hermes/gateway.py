"""Hermes-compatible OpenAI-format gateway for this Ubuntu instance.

Exposes:
  GET  /v1/health  → 200 OK
  GET  /v1/models  → list of available models (Bearer auth)
  POST /v1/chat/completions → run task on this instance (Bearer auth)

Priority order for AI backend:
  1. GOOGLE_API_KEY / GEMINI_API_KEY → Gemma 4 via Google AI Studio
  2. ANTHROPIC_API_KEY               → Claude via Anthropic API
  3. (none)                          → bash execution fallback
"""

import asyncio
import os
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

API_KEY = os.environ.get("API_SERVER_KEY", "")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GEMMA_MODEL = os.environ.get("GEMMA_MODEL", "gemma-4-27b-it")
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
    backend = "gemma4" if GOOGLE_API_KEY else ("claude" if ANTHROPIC_API_KEY else "bash")
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

    if GOOGLE_API_KEY:
        result = await _run_via_gemma(prompt, body.messages)
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


async def _run_via_gemma(prompt: str, messages: list[ChatMessage]) -> str:
    """Forward the request to Gemma 4 via Google AI Studio API."""
    import httpx

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMMA_MODEL}:generateContent"
    contents = []
    for msg in messages:
        if msg.role in ("user", "assistant"):
            role = "user" if msg.role == "user" else "model"
            contents.append({"role": role, "parts": [{"text": msg.content}]})

    payload = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.7},
        "systemInstruction": {
            "parts": [{"text": (
                "You are Hermes, an AI assistant with full access to a Linux Ubuntu instance. "
                "Help the user with tasks, commands, and anything they need on this system."
            )}]
        },
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json=payload,
                params={"key": GOOGLE_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except httpx.HTTPStatusError as exc:
        return f"Gemma API error {exc.response.status_code}: {exc.response.text[:200]}"
    except Exception as exc:
        return f"Gemma API error: {exc}"


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
        system = (
            "You are Hermes, an AI assistant with full access to a Linux Ubuntu instance. "
            "When given a task, reason through it and respond helpfully."
        )
        api_messages = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        response = await client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=system,
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
