"""Stdio MCP server exposing hermes_ask() — no OAuth required.

Reads HERMES_API_URL and HERMES_API_KEY from environment (or ~/.hermes/.env).
Run as: python3 ~/.hermes/mcp_stdio_server.py
"""

from __future__ import annotations

import os
from pathlib import Path

# Load ~/.hermes/.env if vars not already set
_env_file = Path.home() / ".hermes" / ".env"
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())

from mcp.server.fastmcp import FastMCP
from hermes_mcp.hermes_client import HermesClient

API_URL = os.environ.get("HERMES_API_URL", "http://127.0.0.1:8642")
API_KEY = os.environ.get("API_SERVER_KEY") or os.environ.get("HERMES_API_KEY", "")
MODEL = os.environ.get("HERMES_MODEL", "hermes-agent")

client = HermesClient(
    api_url=API_URL,
    api_key=API_KEY,
    model=MODEL,
    timeout_seconds=120,
)

mcp = FastMCP("hermes-ask")

_DESCRIPTION = """\
Delegate a task to the Hermes Agent running on this Ubuntu instance.

Use this when you need to:
  - Run bash commands or scripts on the instance
  - Schedule recurring tasks (cron)
  - Browse the web, scrape pages
  - Manage files or local documents
  - Anything that should persist after this conversation

Args:
  prompt: Natural-language instruction for Hermes.
  session_id: Optional. Reuse across calls to maintain context.

Returns the agent's response text.
"""


@mcp.tool(description=_DESCRIPTION)
def hermes_ask(prompt: str, session_id: str | None = None) -> str:
    return client.ask(prompt, session_id=session_id)


if __name__ == "__main__":
    mcp.run(transport="stdio")
