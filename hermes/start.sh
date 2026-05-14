#!/usr/bin/env bash
# Start the hermes agent stack:
#   1. hermes gateway with api_server platform (port 8642)
#   2. hermes-mcp OAuth bridge (port 8765)
#
# Prerequisites:
#   - hermes installed: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
#   - hermes-mcp installed: pip3 install "git+https://github.com/mlennie/claude-hermes-mcp.git"
#   - ~/.hermes/.env configured with API_SERVER_KEY
#   - ~/.hermes/hermes-mcp.env configured with HERMES_API_KEY, OAUTH_* values
#   - An LLM API key set in ~/.hermes/.env (ANTHROPIC_API_KEY, OPENROUTER_API_KEY, etc.)
#
# To register with Claude Code (run once):
#   claude mcp add --transport http --client-id <OAUTH_CLIENT_ID> --client-secret \
#     --scope user hermes http://127.0.0.1:8765/mcp
#   claude mcp add --scope user hermes-agent -- hermes mcp serve --accept-hooks

set -e

HERMES_DIR="$HOME/.hermes"
LOG_DIR="$HERMES_DIR"

# Load gateway env
set -a
source "$HERMES_DIR/.env"
set +a

echo "Starting hermes gateway (api_server on port ${GATEWAY_PORT:-8642})..."
nohup hermes gateway run > "$LOG_DIR/hermes-gateway.log" 2>&1 &
GATEWAY_PID=$!
echo "Gateway PID: $GATEWAY_PID"

sleep 2

echo "Starting hermes-mcp OAuth bridge (port 8765)..."
nohup env $(cat "$HERMES_DIR/hermes-mcp.env" | grep -v '^#' | xargs) \
  hermes-mcp serve > "$LOG_DIR/hermes-mcp.log" 2>&1 &
MCP_PID=$!
echo "hermes-mcp PID: $MCP_PID"

echo ""
echo "Stack started:"
echo "  Gateway:    http://127.0.0.1:${GATEWAY_PORT:-8642}"
echo "  hermes-mcp: http://127.0.0.1:8765"
echo ""
echo "Test: curl http://127.0.0.1:${GATEWAY_PORT:-8642}/health"
