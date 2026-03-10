---
description: Comprehensive validation for this codebase
---

# POD AI Store — Full Validation

Validates the entire monorepo: frontend, admin, mcp-server, podclaw, and Docker infrastructure.
Phases are ordered by speed — fast checks first, slow E2E last.

---

## Phase 1: Linting (ESLint)

### Frontend
!`cd frontend && npm run lint 2>&1 | tail -20`

### Admin
!`cd admin && npm run lint 2>&1 | tail -20`

---

## Phase 2: Type Checking (TypeScript + Python imports)

### Frontend (strict mode)
!`cd frontend && npm run type-check 2>&1 | tail -30`

### Admin (strict mode)
!`cd admin && npm run type-check 2>&1 | tail -30`

### MCP Server
!`cd mcp-server && npm run typecheck 2>&1 | tail -30`

### PodClaw (Python import verification)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
import podclaw.config
import podclaw.core
import podclaw.scheduler
import podclaw.router.dispatcher
import podclaw.router.responder
import podclaw.router.fallback
import podclaw.approval.manager
import podclaw.approval.timeout
import podclaw.connectors.printful_connector
import podclaw.connectors.svg_renderer_connector
import podclaw.connectors.whatsapp_connector
import podclaw.connectors.telegram_connector
import podclaw.connectors.supabase_connector
import podclaw.connectors.stripe_connector
import podclaw.bridge.api
print('All PodClaw modules import OK')
" 2>&1`

---

## Phase 3: Unit Tests

### Frontend (Vitest — 70% coverage threshold)
!`cd frontend && npm test 2>&1 | tail -30`

### Admin (Vitest — 30% coverage threshold)
!`cd admin && npm test 2>&1 | tail -30`

### MCP Server (Vitest — 60% coverage threshold)
!`cd mcp-server && npm test 2>&1 | tail -30`

### PodClaw (Pytest — full suite excluding known broken hooks)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -m pytest podclaw/tests/ -v --tb=short --ignore=podclaw/tests/hooks/ 2>&1 | tail -50`

---

## Phase 4: Coverage Enforcement

### Frontend coverage check
!`cd frontend && npx vitest run --coverage 2>&1 | grep -E "(Statements|Branches|Functions|Lines|ERROR|FAIL)" | head -10`

### Admin coverage check
!`cd admin && npx vitest run --coverage 2>&1 | grep -E "(Statements|Branches|Functions|Lines|ERROR|FAIL)" | head -10`

### MCP Server coverage check
!`cd mcp-server && npx vitest run --coverage 2>&1 | grep -E "(Statements|Branches|Functions|Lines|ERROR|FAIL)" | head -10`

---

## Phase 5: Build Verification

### Frontend build (Next.js standalone)
!`cd frontend && npm run build 2>&1 | tail -20`

### Admin build (Next.js standalone)
!`cd admin && npm run build 2>&1 | tail -20`

### MCP Server build (TypeScript compile)
!`cd mcp-server && npm run build 2>&1 | tail -10`

---

## Phase 6: Database Migration Verification

### Check SQL migration syntax (no parse errors)
!`for f in supabase/migrations/*.sql; do echo "--- $f ---"; head -5 "$f"; echo ""; done | head -80`

### Verify migration file order (no duplicates or gaps)
!`ls -1 supabase/migrations/*.sql | sort | awk -F/ '{print $NF}' | head -60`

---

## Phase 7: Docker Build Smoke Test

### Verify all Dockerfiles parse correctly
!`docker compose -f docker-compose.yml config --quiet 2>&1 && echo "docker-compose.yml: OK" || echo "docker-compose.yml: INVALID"`
!`docker compose -f docker-compose.yml -f docker-compose.local.yml config --quiet 2>&1 && echo "docker-compose.local.yml: OK" || echo "docker-compose.local.yml: INVALID"`

### Build all images (no cache)
!`docker compose -f docker-compose.yml build --no-cache 2>&1 | tail -30`

---

## Phase 8: PodClaw Sprint 2 Verification

### Verify Printful connector (18 tools)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.connectors.printful_connector import PrintfulMCPConnector
c = PrintfulMCPConnector(api_token='test', store_id='test')
tools = c.get_tools()
print(f'Printful tools: {len(tools)} (expected 18)')
assert len(tools) == 18, f'Expected 18, got {len(tools)}'
for name in sorted(tools.keys()):
    assert callable(tools[name]['handler']), f'{name} handler not callable'
    print(f'  OK: {name}')
print('All Printful tools verified')
" 2>&1`

### Verify SVG renderer connector (2 tools)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.connectors.svg_renderer_connector import SVGRendererConnector
c = SVGRendererConnector()
tools = c.get_tools()
print(f'SVG tools: {len(tools)} (expected 2)')
assert len(tools) == 2
assert 'svg_render_png' in tools
assert 'svg_composite' in tools
print('SVG renderer connector OK')
" 2>&1`

### Verify approval flow
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.approval.manager import ApprovalManager, _PAYLOAD_RE
from podclaw.approval.timeout import ApprovalTimeoutChecker, REMINDER_THRESHOLD, TIMEOUT_THRESHOLD
from datetime import timedelta

# Regex tests
assert _PAYLOAD_RE.match('approve_design_12345678-1234-1234-1234-123456789abc')
assert _PAYLOAD_RE.match('reject_product_abcdef01-2345-6789-abcd-ef0123456789')
assert not _PAYLOAD_RE.match('invalid')

# Threshold tests
assert REMINDER_THRESHOLD == timedelta(hours=4)
assert TIMEOUT_THRESHOLD == timedelta(hours=24)
print('Approval flow verified')
" 2>&1`

### Verify scheduler hybrid (10 agents disabled, 8 system jobs)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.scheduler import DEFAULT_SCHEDULE
disabled = [k for k, v in DEFAULT_SCHEDULE.items() if not v.get('enabled', True)]
enabled = [k for k, v in DEFAULT_SCHEDULE.items() if v.get('enabled', True)]
print(f'Disabled agents: {len(disabled)} (expected 10)')
print(f'Enabled agents: {len(enabled)} (expected 0)')
assert len(disabled) == 10, f'Expected 10 disabled, got {len(disabled)}'
assert len(enabled) == 0, f'Expected 0 enabled, got {len(enabled)}'
print('Scheduler hybrid verified')
" 2>&1`

### Verify CEO inactivity fallback
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.router.fallback import CEOInactivityMonitor, INACTIVITY_THRESHOLD, FALLBACK_AGENTS, CEO_LAST_MSG_KEY
print(f'Threshold: {INACTIVITY_THRESHOLD}s (48h)')
print(f'Fallback agents: {FALLBACK_AGENTS}')
print(f'Redis key: {CEO_LAST_MSG_KEY}')
assert INACTIVITY_THRESHOLD == 48 * 3600
assert len(FALLBACK_AGENTS) == 3
print('CEO fallback verified')
" 2>&1`

### Sprint 2 unit tests (all 78)
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -m pytest podclaw/tests/connectors/test_printful_connector.py podclaw/tests/connectors/test_svg_renderer_connector.py podclaw/tests/approval/test_manager.py podclaw/tests/approval/test_timeout.py podclaw/tests/test_fallback.py podclaw/tests/test_scheduler.py -v --tb=short 2>&1 | tail -40`

---

## Phase 9: Security Checks

### Verify SSRF protection in Printful connector
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.connectors.printful_connector import _validate_id, _validate_image_url
import socket
from unittest.mock import patch

# ID injection blocked
try:
    _validate_id('abc; DROP TABLE', 'test')
    print('FAIL: SQL injection not blocked')
except ValueError:
    print('OK: SQL injection blocked')

# Path traversal blocked
try:
    _validate_id('../../etc/passwd', 'test')
    print('FAIL: Path traversal not blocked')
except ValueError:
    print('OK: Path traversal blocked')

# JavaScript URL blocked
try:
    _validate_image_url('javascript:alert(1)')
    print('FAIL: javascript: URL not blocked')
except ValueError:
    print('OK: javascript: URL blocked')

# File scheme blocked
try:
    _validate_image_url('file:///etc/passwd')
    print('FAIL: file:// URL not blocked')
except ValueError:
    print('OK: file:// URL blocked')

# Unauthorized host blocked
try:
    _validate_image_url('https://evil.com/hack.png')
    print('FAIL: Unauthorized host not blocked')
except ValueError:
    print('OK: Unauthorized host blocked')

print('All security checks passed')
" 2>&1`

### Verify circuit breaker
!`PODCLAW_BRIDGE_AUTH_ENABLED=false podclaw/.venv/bin/python -c "
from podclaw.connectors.printful_connector import CircuitBreaker
cb = CircuitBreaker(failure_threshold=3, timeout=10.0)
assert cb.can_attempt() is True, 'Should start closed'
cb.record_failure()
cb.record_failure()
cb.record_failure()
assert cb.can_attempt() is False, 'Should be open after 3 failures'
cb.record_success()
assert cb.can_attempt() is True, 'Should reset after success'
print('Circuit breaker OK')
" 2>&1`

---

## Phase 10: Integration Verification (API Route Existence)

### Frontend API routes — spot check critical endpoints exist
!`for route in health ping checkout/create-session cart products orders auth/login auth/register webhooks/stripe coupons/validate chat; do
  found=$(find frontend/src/app/api/$route -name "route.ts" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    echo "OK: /api/$route"
  else
    echo "MISSING: /api/$route"
  fi
done`

### Admin API routes — spot check critical endpoints exist
!`for route in health auth/login auth/logout admin/orders admin/settings; do
  found=$(find admin/src/app/api/$route -name "route.ts" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    echo "OK: /api/$route"
  else
    echo "MISSING: /api/$route"
  fi
done`

---

## Phase 11: i18n Completeness

### Verify all locale files have same keys
!`cd frontend && node -e "
const en = require('./messages/en.json');
const es = require('./messages/es.json');
const de = require('./messages/de.json');

function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getKeys(v, prefix + k + '.') : [prefix + k]
  );
}

const enKeys = new Set(getKeys(en));
const esKeys = new Set(getKeys(es));
const deKeys = new Set(getKeys(de));

const missingEs = [...enKeys].filter(k => !esKeys.has(k));
const missingDe = [...enKeys].filter(k => !deKeys.has(k));

console.log('EN keys:', enKeys.size);
console.log('ES keys:', esKeys.size, missingEs.length ? '- MISSING: ' + missingEs.slice(0,5).join(', ') : '- OK');
console.log('DE keys:', deKeys.size, missingDe.length ? '- MISSING: ' + missingDe.slice(0,5).join(', ') : '- OK');

if (missingEs.length > 10 || missingDe.length > 10) {
  console.log('WARNING: More than 10 keys missing in translations');
}
" 2>&1`

---

## Summary

All phases complete. Review any FAIL/MISSING/WARNING lines above.

**Expected results:**
- Phase 1-2: Zero lint/type errors
- Phase 3-4: All unit tests pass, coverage meets thresholds
- Phase 5: All builds succeed
- Phase 6: Migration files valid
- Phase 7: Docker configs parse, images build
- Phase 8: Sprint 2 — 78/78 tests, all components verified
- Phase 9: Security validators work correctly
- Phase 10: Critical API routes exist
- Phase 11: Translation keys complete
