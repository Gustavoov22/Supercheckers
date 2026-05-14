#!/usr/bin/env bash
# One-time setup: install hermes agent + hermes-mcp bridge and configure Claude Code.
# Run as root or with sudo.

set -e

echo "=== Installing NousResearch hermes-agent ==="
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash -s -- --skip-setup

echo ""
echo "=== Installing hermes-mcp MCP bridge ==="
pip3 install --ignore-installed "git+https://github.com/mlennie/claude-hermes-mcp.git"

echo ""
echo "=== Generating hermes-mcp OAuth credentials ==="
HERMES_DIR="$HOME/.hermes"
CLIENT_ID="hermes-mcp-$(openssl rand -base64 8 | tr -dc 'a-zA-Z0-9' | head -c 10)"
CLIENT_SECRET="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 43)"
API_KEY="$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9_-' | head -c 64)"

cat > "$HERMES_DIR/hermes-mcp.env" <<EOF
OAUTH_CLIENT_ID=$CLIENT_ID
OAUTH_CLIENT_SECRET=$CLIENT_SECRET
OAUTH_ISSUER_URL=http://localhost:8765
HERMES_API_KEY=$API_KEY
HERMES_API_URL=http://127.0.0.1:8642
HERMES_MODEL=hermes-agent
BIND_HOST=127.0.0.1
BIND_PORT=8765
LOG_LEVEL=INFO
EOF
chmod 600 "$HERMES_DIR/hermes-mcp.env"

cat > "$HERMES_DIR/.env" <<EOF
API_SERVER_KEY=$API_KEY
GATEWAY_HOST=127.0.0.1
GATEWAY_PORT=8642

# Set one of these to enable AI responses:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENROUTER_API_KEY=sk-or-...
EOF
chmod 600 "$HERMES_DIR/.env"

echo ""
echo "=== Registering MCP servers with Claude Code ==="
MCP_CLIENT_SECRET="$CLIENT_SECRET" claude mcp add \
  --transport http \
  --client-id "$CLIENT_ID" \
  --client-secret \
  --scope user \
  hermes "http://127.0.0.1:8765/mcp"

claude mcp add --scope user hermes-agent -- hermes mcp serve --accept-hooks

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Add an LLM API key to $HERMES_DIR/.env then run: bash hermes/start.sh"
echo ""
echo "Available MCP servers:"
claude mcp list
