#!/bin/bash
# Development startup script for MCP server
# Loads environment variables from frontend/.env.local

set -a  # automatically export all variables
source ../frontend/.env.local
set +a

# MCP-specific environment variables
export PORT=8002
export MCP_BASE_URL="http://localhost:8002"
export MCP_CORS_ORIGINS="https://claude.ai,https://chatgpt.com"
export MCP_JWT_SECRET="development-secret-key-change-in-production-min-32-chars-required"

echo "[MCP Server] Starting with environment from ../frontend/.env.local"
echo "[MCP Server] Port: $PORT"
echo "[MCP Server] Supabase URL: ${SUPABASE_URL:0:30}..."

npx tsx src/index.ts
