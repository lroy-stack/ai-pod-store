#!/usr/bin/env bash
# =====================================================================
# Secret Generator — POD Platform
# =====================================================================
#
# Generates all required secret values for .env
# Requires: openssl (built into macOS/Linux)
#
# Usage:
#   chmod +x bin/generate-secrets.sh
#   ./bin/generate-secrets.sh
#
# Output: paste into your .env file
# =====================================================================

set -e

echo ""
echo "🔐 Generated secrets — paste into your .env file:"
echo "======================================================"
echo ""
echo "# Internal authentication secrets"
echo "REDIS_PASSWORD=$(openssl rand -hex 32)"
echo "PODCLAW_BRIDGE_AUTH_TOKEN=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
echo "MCP_JWT_SECRET=$(openssl rand -hex 32)"
echo "MCP_APPROVE_SECRET=$(openssl rand -hex 32)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo "REVALIDATION_SECRET=$(openssl rand -hex 32)"
echo ""
echo "# Monitoring"
echo "GRAFANA_ADMIN_PASSWORD=$(openssl rand -hex 24)"
echo ""
echo "# Supabase self-hosted (only if ENABLE_SUPABASE=true)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "SECRET_KEY_BASE=$(openssl rand -hex 64)"
echo "VAULT_ENC_KEY=$(openssl rand -hex 16)"
echo "PG_META_CRYPTO_KEY=$(openssl rand -hex 16)"
echo "DASHBOARD_PASSWORD=$(openssl rand -hex 24)"
echo "LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 16)"
echo "LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 16)"
echo ""
echo "======================================================"
echo ""
echo "⚠️  These values are shown ONCE. Save them securely."
echo ""
