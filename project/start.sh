#!/usr/bin/env bash
***REMOVED***========
# POD AI — Docker Compose Orchestration Script
***REMOVED***========
#
# Usage:
#   ./start.sh              # Local dev (default)
#   ./start.sh --prod       # Production (requires DOMAIN in .env)
#   ./start.sh --down       # Stop all services
#   ./start.sh --build      # Build images only (no start)
#   ./start.sh --clean      # Stop + prune Docker resources
#   ./start.sh --status     # Show service status
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"
PROJECT_NAME="podai"

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
MODE="local"
ACTION="up"

while [[ $# -gt 0 ]]; do
  case $1 in
    --prod)    MODE="prod"; shift ;;
    --local)   MODE="local"; shift ;;
    --down)    ACTION="down"; shift ;;
    --build)   ACTION="build"; shift ;;
    --clean)   ACTION="clean"; shift ;;
    --status)  ACTION="status"; shift ;;
    -h|--help)
      echo "Usage: $0 [--local|--prod] [--down|--build|--clean|--status]"
      echo ""
      echo "Modes:"
      echo "  --local    Local dev with Docker Desktop (default)"
      echo "  --prod     Production with auto-HTTPS (requires DOMAIN)"
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
if [[ "$MODE" == "local" ]]; then
  OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.local.yml"
else
  OVERRIDE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
fi

COMPOSE_CMD="docker compose -p $PROJECT_NAME -f $COMPOSE_FILE -f $OVERRIDE_FILE"

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
# First-run: create .env from template
# ---------------------------------------------------------------------------
ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    warn "No .env file found. Creating from template..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
    echo ""
    info "Created $ENV_FILE from .env.example"
    info "Edit it with your real API keys and secrets before continuing."
    echo ""
    echo "  Required variables:"
    echo "    SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY"
    echo "    STRIPE_SECRET_KEY, ANTHROPIC_API_KEY"
    echo "    REDIS_PASSWORD (generate: openssl rand -hex 32)"
    echo "    PODCLAW_BRIDGE_AUTH_TOKEN (generate: openssl rand -hex 32)"
    echo ""
    info "Then run this script again."
    exit 0
  fi
}

# ---------------------------------------------------------------------------
# Validate required variables
# ---------------------------------------------------------------------------
validate_env() {
  # Source .env to check values (subshell to avoid polluting current env)
  local missing=()
  local placeholder=()

  while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ -z "$key" || "$key" == \#* ]] && continue
    # Remove quotes
    value="${value%\"}"
    value="${value#\"}"
    export "$key=$value"
  done < "$ENV_FILE"

  REQUIRED_VARS=(SUPABASE_URL SUPABASE_SERVICE_KEY REDIS_PASSWORD STRIPE_SECRET_KEY ANTHROPIC_API_KEY)

  for var in "${REQUIRED_VARS[@]}"; do
    val="${!var:-}"
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

  if [[ "$MODE" == "prod" ]]; then
    local domain="${DOMAIN:-}"
    if [[ -z "$domain" || "$domain" == "yourdomain.com" ]]; then
      error "DOMAIN must be set for production mode (e.g., DOMAIN=mystore.com)"
      exit 1
    fi
  fi

  ok "Environment validated"
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
do_status() {
  info "Service status:"
  $COMPOSE_CMD ps
}

do_down() {
  info "Stopping all services..."
  $COMPOSE_CMD down
  ok "All services stopped"
}

do_clean() {
  info "Stopping all services..."
  $COMPOSE_CMD down --remove-orphans 2>/dev/null || true
  info "Pruning Docker resources..."
  docker builder prune -f
  docker system prune -f
  ok "Cleanup complete"
}

do_build() {
  info "Building images..."
  $COMPOSE_CMD build
  ok "Build complete"
}

do_up() {
  info "Building images..."
  $COMPOSE_CMD build

  info "Phase 1/3: Starting infrastructure (redis, rembg, crawl4ai)..."
  $COMPOSE_CMD up -d redis rembg crawl4ai

  info "Waiting for infrastructure health..."
  local retries=0
  while [[ $retries -lt 30 ]]; do
    if docker compose -p "$PROJECT_NAME" ps --format json 2>/dev/null | \
       python3 -c "
import sys, json
services = [json.loads(l) for l in sys.stdin if l.strip()]
infra = [s for s in services if s.get('Service') in ('redis','rembg','crawl4ai')]
healthy = all(s.get('Health','') == 'healthy' for s in infra)
sys.exit(0 if healthy and len(infra) == 3 else 1)
" 2>/dev/null; then
      ok "Infrastructure healthy"
      break
    fi
    retries=$((retries + 1))
    sleep 2
  done

  if [[ $retries -ge 30 ]]; then
    warn "Infrastructure health check timed out. Continuing anyway..."
  fi

  info "Phase 2/3: Starting application (podclaw, frontend, admin, mcp-server)..."
  $COMPOSE_CMD up -d podclaw frontend admin mcp-server

  info "Phase 3/3: Starting reverse proxy (caddy)..."
  $COMPOSE_CMD up -d caddy

  # Wait a moment for health checks to settle
  sleep 3

  echo ""
  ok "All services started!"
  echo ""
  $COMPOSE_CMD ps
  echo ""

  if [[ "$MODE" == "local" ]]; then
    info "Local URLs:"
    echo "  Frontend:  http://localhost:3000"
    echo "  Admin:     http://localhost:3001/panel"
    echo "  PodClaw:   http://localhost:8000/health"
    echo "  MCP:       http://localhost:8002/health"
    echo "  Via Caddy: http://localhost:8080"
  else
    local domain="${DOMAIN:-yourdomain.com}"
    info "Production URLs:"
    echo "  Frontend:  https://$domain"
    echo "  Admin:     https://$domain/panel"
    echo "  Bridge:    https://$domain/api/bridge (auth required)"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
preflight

case "$ACTION" in
  status)
    do_status
    ;;
  down)
    do_down
    ;;
  clean)
    do_clean
    ;;
  build)
    ensure_env
    validate_env
    do_build
    ;;
  up)
    ensure_env
    validate_env
    do_up
    ;;
esac
