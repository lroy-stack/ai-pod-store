#!/usr/bin/env bash
# Copyright (c) 2026 L.LÖWE <maintainer@example.com>
# SPDX-License-Identifier: MIT
# ====================================================================
# POD Platform — Docker Compose Orchestration Script
# ====================================================================
#
# Usage:
#   ./start.sh --private             # Local dev (Docker Desktop)
#   ./start.sh --public              # Production (requires DOMAIN in .env)
#   ./start.sh --private --no-supabase   # Use Supabase Cloud (skip self-hosted)
#   ./start.sh --private --with-studio   # Enable Supabase Studio dashboard
#   ./start.sh --private --no-monitoring # Without monitoring stack
#   ./start.sh --down                # Stop all services
#   ./start.sh --build               # Build images only (no start)
#   ./start.sh --clean               # Stop + prune Docker resources
#   ./start.sh --status              # Show service status
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
SUPABASE_OVERLAY="$SCRIPT_DIR/docker-compose.supabase.yml"
SUPABASE_DIR="$SCRIPT_DIR/supabase"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
PROJECT_NAME="pod-platform"

# Trap errors with useful message
trap 'error "Fatal error at line $LINENO. Run with bash -x start.sh for debug output."; exit 1' ERR

# Colors (if terminal supports them)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
MODE="private"
ACTION="up"
WITH_MONITORING=""
NO_MONITORING=""
NO_SUPABASE=""
WITH_STUDIO=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --public)          MODE="public"; shift ;;
    --private)         MODE="private"; shift ;;
    --prod)            MODE="public"; shift ;;   # legacy alias
    --local)           MODE="private"; shift ;;  # legacy alias
    --with-monitoring) WITH_MONITORING="true"; shift ;;
    --no-monitoring)   NO_MONITORING="true"; shift ;;
    --no-supabase)     NO_SUPABASE="true"; shift ;;
    --with-studio)     WITH_STUDIO="true"; shift ;;
    --down)            ACTION="down"; shift ;;
    --build)           ACTION="build"; shift ;;
    --clean)           ACTION="clean"; shift ;;
    --status)          ACTION="status"; shift ;;
    -h|--help)
      echo "Usage: $0 [--private|--public] [--down|--build|--clean|--status]"
      echo ""
      echo "Modes:"
      echo "  --private    Local dev with Docker Desktop (default)"
      echo "  --public     Production with auto-HTTPS (requires DOMAIN)"
      echo ""
      echo "Options:"
      echo "  --no-supabase      Skip Supabase self-hosted (use Cloud)"
      echo "  --with-studio      Enable Supabase Studio dashboard"
      echo "  --with-monitoring  Enable Prometheus, Grafana, Loki, Promtail"
      echo "  --no-monitoring    Disable monitoring even if ENABLE_MONITORING=true"
      echo ""
      echo "Actions:"
      echo "  (default)  Build and start all services"
      echo "  --build    Build images only"
      echo "  --down     Stop all services"
      echo "  --clean    Stop + prune Docker resources"
      echo "  --status   Show service health status"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      echo "Run $0 --help for usage"
      exit 1
      ;;
  esac
done

# Select override file
if [[ "$MODE" == "private" ]]; then
  OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.private.yml"
else
  OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.public.yml"
fi

# Compose command is built after load_env() resolves ENABLE_SUPABASE.
# See build_compose_cmd() below.
COMPOSE_CMD=""
USE_SUPABASE="false"

build_compose_cmd() {
  # Resolve Supabase mode: CLI flag overrides .env
  USE_SUPABASE="${ENABLE_SUPABASE:-false}"
  [[ -n "$NO_SUPABASE" ]] && USE_SUPABASE="false"

  if [[ "$USE_SUPABASE" == "true" ]]; then
    COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE -f $SUPABASE_OVERLAY -f $OVERRIDE_FILE"
  else
    COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE -f $OVERRIDE_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight() {
  if ! command -v docker &>/dev/null; then
    error "docker not found. Install Docker: https://docs.docker.com/get-docker/"
    exit 1
  fi

  if ! docker compose version &>/dev/null; then
    error "docker compose plugin not found. Install: https://docs.docker.com/compose/install/"
    exit 1
  fi

  if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon is not running. Start Docker Desktop or the Docker service."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Supabase self-hosted: clone/update official repo (sparse checkout)
# ---------------------------------------------------------------------------
setup_supabase() {
  if [[ "$USE_SUPABASE" != "true" ]]; then
    return 0
  fi

  if [[ ! -d "$SUPABASE_DIR" ]]; then
    info "Cloning Supabase Docker setup (sparse checkout)..."
    git clone --filter=blob:none --no-checkout \
      https://github.com/supabase/supabase.git "$SUPABASE_DIR"
    git -C "$SUPABASE_DIR" sparse-checkout init --cone
    git -C "$SUPABASE_DIR" sparse-checkout set docker
    git -C "$SUPABASE_DIR" checkout master
    ok "Supabase repo cloned (docker/ only)"
  else
    info "Updating Supabase Docker setup..."
    git -C "$SUPABASE_DIR" pull --ff-only 2>/dev/null || \
      warn "Could not update Supabase repo (offline or conflict)"
  fi

  # Copy .env so Supabase compose can resolve its variables
  cp "$ENV_FILE" "$SUPABASE_DIR/docker/.env"
  info "Supabase environment synced"
}

# ---------------------------------------------------------------------------
# Validate Supabase-specific environment variables
# ---------------------------------------------------------------------------
validate_supabase_env() {
  if [[ "$USE_SUPABASE" != "true" ]]; then
    return 0
  fi

  local missing=()
  SUPABASE_REQUIRED_VARS=(
    POSTGRES_PASSWORD
    JWT_SECRET
    ANON_KEY
    SERVICE_ROLE_KEY
    SECRET_KEY_BASE
    VAULT_ENC_KEY
    PG_META_CRYPTO_KEY
    LOGFLARE_PUBLIC_ACCESS_TOKEN
    LOGFLARE_PRIVATE_ACCESS_TOKEN
    DASHBOARD_PASSWORD
  )

  for var in "${SUPABASE_REQUIRED_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" ]]; then
      missing+=("$var")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing Supabase self-hosted variables in .env: ${missing[*]}"
    info "Set ENABLE_SUPABASE=false or add the missing variables."
    exit 1
  fi

  # POSTGRES_PASSWORD must not contain @ or % (breaks connection strings)
  local pg_pw="${POSTGRES_PASSWORD:-}"
  if [[ "$pg_pw" == *"@"* || "$pg_pw" == *"%"* ]]; then
    error "POSTGRES_PASSWORD must not contain @ or % (breaks connection strings)"
    exit 1
  fi

  ok "Supabase environment validated"
}

# ---------------------------------------------------------------------------
# First-run: create .env from template
# ---------------------------------------------------------------------------
ensure_env() {
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    error ".env.example not found. The repository may be corrupted."
    exit 1
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    warn "No .env file found. Creating from template..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo ""
    info "Created $ENV_FILE from .env.example"
    info "Edit it with your real API keys and secrets before continuing."
    echo ""
    echo "  Required variables:"
    echo "    SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY"
    echo "    STRIPE_SECRET_KEY, FAL_KEY"
    echo "    REDIS_PASSWORD (generate: openssl rand -hex 32)"
    echo "    PODCLAW_BRIDGE_AUTH_TOKEN (generate: openssl rand -hex 32)"
    echo ""
    info "Then run this script again."
    exit 0
  fi
}

# ---------------------------------------------------------------------------
# Load .env — correct parser that handles values containing '='
# ---------------------------------------------------------------------------
load_env() {
  while IFS= read -r line; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    # Extract key (everything before first =)
    local key="${line%%=*}"
    # Extract value (everything after first =)
    local value="${line#*=}"
    # Strip surrounding double quotes
    value="${value%\"}"
    value="${value#\"}"
    # Strip surrounding single quotes
    value="${value%\'}"
    value="${value#\'}"
    # Export (skip if key is empty or has spaces)
    [[ -n "$key" && "$key" != *" "* ]] && export "$key=$value"
  done < "$ENV_FILE"
}

# ---------------------------------------------------------------------------
# Validate required variables
# ---------------------------------------------------------------------------
validate_env() {
  load_env

  local missing=()
  local placeholder=()

  REQUIRED_VARS=(
    SUPABASE_URL
    SUPABASE_SERVICE_KEY
    SUPABASE_ANON_KEY
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    REDIS_PASSWORD
    STRIPE_SECRET_KEY
    FAL_KEY
    GEMINI_API_KEY
    RESEND_API_KEY
    PRINTIFY_API_TOKEN
    PRINTIFY_SHOP_ID
    PODCLAW_BRIDGE_AUTH_TOKEN
    MCP_JWT_SECRET
    MCP_APPROVE_SECRET
    CRON_SECRET
    SESSION_SECRET
    REVALIDATION_SECRET
  )

  for var in "${REQUIRED_VARS[@]}"; do
    local val="${!var:-}"
    if [[ -z "$val" ]]; then
      missing+=("$var")
    elif [[ "$val" == *"placeholder"* || "$val" == *"your-"* || "$val" == *"change-me"* ]]; then
      placeholder+=("$var")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    error "Missing required variables in .env: ${missing[*]}"
    exit 1
  fi

  if [[ ${#placeholder[@]} -gt 0 ]]; then
    error "Variables still have placeholder values in .env: ${placeholder[*]}"
    info "Edit $ENV_FILE with real values."
    exit 1
  fi

  if [[ "$MODE" == "public" ]]; then
    local domain="${DOMAIN:-}"
    if [[ -z "$domain" || "$domain" == "yourdomain.com" ]]; then
      error "DOMAIN must be set for public mode (e.g., DOMAIN=mystore.com)"
      exit 1
    fi
  fi

  # Validate GRAFANA_ADMIN_PASSWORD when monitoring is enabled
  local grafana_pw="${GRAFANA_ADMIN_PASSWORD:-}"
  local enable_mon="${ENABLE_MONITORING:-false}"
  if [[ "$enable_mon" == "true" ]]; then
    if [[ -z "$grafana_pw" ]]; then
      error "GRAFANA_ADMIN_PASSWORD is required when ENABLE_MONITORING=true."
      error "Generate with: openssl rand -hex 24"
      exit 1
    fi
    if [[ "$grafana_pw" == "admin" || "$grafana_pw" == "change-me"* || "$grafana_pw" == *"grafana"* ]]; then
      error "GRAFANA_ADMIN_PASSWORD must not use default/placeholder values."
      error "Generate a strong password: openssl rand -hex 24"
      exit 1
    fi
  fi

  ok "Environment validated ($MODE mode)"
}

# ---------------------------------------------------------------------------
# Resolve profiles from env toggles
# ---------------------------------------------------------------------------
resolve_profiles() {
  local profiles=""

  # Monitoring: CLI flags override .env
  local enable_monitoring="${ENABLE_MONITORING:-false}"
  [[ -n "$WITH_MONITORING" ]] && enable_monitoring="true"
  [[ -n "$NO_MONITORING" ]] && enable_monitoring="false"

  if [[ "$enable_monitoring" == "true" ]]; then
    profiles="$profiles --profile monitoring"
  fi

  # Supabase Studio: CLI flag enables
  if [[ -n "$WITH_STUDIO" && "$USE_SUPABASE" == "true" ]]; then
    profiles="$profiles --profile studio"
  fi

  # AI tools (rembg and crawl4ai are in default profile — always started)
  # If we add them to ai-tools profile later, uncomment:
  # local enable_crawl4ai="${ENABLE_CRAWL4AI:-true}"
  # local enable_rembg="${ENABLE_REMBG:-true}"
  # [[ "$enable_crawl4ai" == "true" || "$enable_rembg" == "true" ]] && profiles="$profiles --profile ai-tools"

  echo "$profiles"
}

# ---------------------------------------------------------------------------
# Wait for services to be healthy (no python3 dependency)
# ---------------------------------------------------------------------------
wait_for_healthy() {
  local service_names=("$@")
  local retries=0
  local max_retries=60

  while [[ $retries -lt $max_retries ]]; do
    local all_healthy=true
    for svc in "${service_names[@]}"; do
      local health
      health=$(docker compose -p "$PROJECT_NAME" ps --format '{{.Health}}' "$svc" 2>/dev/null || echo "unknown")
      if [[ "$health" != "healthy" ]]; then
        all_healthy=false
        break
      fi
    done

    if $all_healthy; then
      return 0
    fi

    retries=$((retries + 1))
    sleep 2
  done

  return 1
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
do_status() {
  info "Service status:"
  $COMPOSE_CMD $(resolve_profiles) ps
}

do_down() {
  info "Stopping all services..."
  $COMPOSE_CMD $(resolve_profiles) down
  ok "All services stopped"
}

do_clean() {
  info "Stopping all services..."
  $COMPOSE_CMD $(resolve_profiles) down --remove-orphans 2>/dev/null || true
  info "Pruning Docker resources..."
  docker builder prune -f
  docker system prune -f
  ok "Cleanup complete"
}

do_build() {
  info "Building images..."
  $COMPOSE_CMD $(resolve_profiles) build
  ok "Build complete"
}

do_up() {
  local profiles
  profiles=$(resolve_profiles)
  local total_phases=3
  local phase=1

  # Determine total phases
  if [[ "$USE_SUPABASE" == "true" ]]; then
    total_phases=$((total_phases + 1))
  fi
  local enable_monitoring="${ENABLE_MONITORING:-false}"
  [[ -n "$WITH_MONITORING" ]] && enable_monitoring="true"
  [[ -n "$NO_MONITORING" ]] && enable_monitoring="false"
  if [[ "$enable_monitoring" == "true" ]]; then
    total_phases=$((total_phases + 1))
  fi

  info "Building images..."
  $COMPOSE_CMD $profiles build

  # Phase 1: Infrastructure
  info "Phase $phase/$total_phases: Starting infrastructure (redis, rembg, crawl4ai, svg-renderer)..."
  $COMPOSE_CMD $profiles up -d redis rembg crawl4ai svg-renderer

  info "Waiting for infrastructure health..."
  if wait_for_healthy redis rembg crawl4ai svg-renderer; then
    ok "Infrastructure healthy"
  else
    warn "Infrastructure health check timed out (120s). Continuing..."
  fi
  phase=$((phase + 1))

  # Phase 2: Supabase (conditional)
  if [[ "$USE_SUPABASE" == "true" ]]; then
    info "Phase $phase/$total_phases: Starting Supabase self-hosted..."

    # Step 1: Database + vector (vector feeds logs to db)
    $COMPOSE_CMD $profiles up -d db vector
    info "Waiting for Supabase DB..."
    if ! wait_for_healthy db; then
      error "Supabase DB failed to start. Check: docker compose -p $PROJECT_NAME logs db"
      exit 1
    fi
    ok "Supabase DB healthy"

    # Step 2: Analytics (depends on db)
    $COMPOSE_CMD $profiles up -d analytics
    if ! wait_for_healthy analytics; then
      error "Analytics (Logflare) failed. Check: docker compose -p $PROJECT_NAME logs analytics"
      exit 1
    fi
    ok "Analytics healthy"

    # Step 3: All remaining Supabase services
    $COMPOSE_CMD $profiles up -d auth rest realtime storage imgproxy supavisor kong
    info "Waiting for Kong (API gateway)..."
    if wait_for_healthy kong auth rest; then
      ok "Supabase services healthy"
    else
      warn "Some Supabase services slow to start. Continuing..."
    fi
    phase=$((phase + 1))
  else
    info "Supabase self-hosted: skipped (using Cloud)"
  fi

  # Phase N: Application
  info "Phase $phase/$total_phases: Starting application (podclaw, frontend, admin, mcp-server)..."
  $COMPOSE_CMD $profiles up -d podclaw frontend admin mcp-server
  phase=$((phase + 1))

  # Phase N+1: Reverse proxy
  info "Phase $phase/$total_phases: Starting reverse proxy (caddy)..."
  $COMPOSE_CMD $profiles up -d caddy
  phase=$((phase + 1))

  # Phase N+2 (optional): Monitoring stack
  if [[ "$enable_monitoring" == "true" ]]; then
    info "Phase $phase/$total_phases: Starting monitoring (prometheus, grafana, loki, promtail)..."
    $COMPOSE_CMD $profiles up -d prometheus grafana loki promtail 2>/dev/null || warn "Some monitoring services may not be configured"
    ok "Monitoring stack started"
  fi

  # Wait for health checks to settle
  sleep 3

  echo ""
  ok "All services started!"
  echo ""
  $COMPOSE_CMD $profiles ps
  echo ""

  if [[ "$MODE" == "private" ]]; then
    info "Local URLs:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Admin:     http://localhost:3001/panel"
    echo "  PodClaw:   http://localhost:8100/health"
    echo "  MCP:       http://localhost:8002/health"
    echo "  Via Caddy: http://localhost:8080"
    if [[ "$USE_SUPABASE" == "true" ]]; then
      echo ""
      info "Supabase URLs:"
      echo "  Kong API:  http://localhost:8000"
      echo "  Postgres:  localhost:54322 (user: postgres)"
      echo "  Supavisor: localhost:54329"
      if [[ -n "$WITH_STUDIO" ]]; then
        echo "  Studio:    http://localhost:3100"
      fi
    fi
  else
    local domain="${DOMAIN:-yourdomain.com}"
    info "Production URLs (subdomain routing):"
    echo "  Frontend:  https://$domain"
    echo "  Admin:     https://admin.$domain"
    echo "  MCP:       https://mcp.$domain/health"
    if [[ "$USE_SUPABASE" == "true" ]]; then
      echo "  Supabase:  https://api.$domain/auth/v1/health"
    fi
    local enable_monitoring_display="${ENABLE_MONITORING:-false}"
    [[ -n "$WITH_MONITORING" ]] && enable_monitoring_display="true"
    if [[ "$enable_monitoring_display" == "true" ]]; then
      echo "  Grafana:   https://grafana.$domain"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
preflight

case "$ACTION" in
  status)
    load_env 2>/dev/null || true
    build_compose_cmd
    do_status
    ;;
  down)
    load_env 2>/dev/null || true
    build_compose_cmd
    do_down
    ;;
  clean)
    load_env 2>/dev/null || true
    build_compose_cmd
    do_clean
    ;;
  build)
    ensure_env
    validate_env
    build_compose_cmd
    validate_supabase_env
    setup_supabase
    do_build
    ;;
  up)
    ensure_env
    validate_env
    build_compose_cmd
    validate_supabase_env
    setup_supabase
    do_up
    ;;
esac
