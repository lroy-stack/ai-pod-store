---
name: Audit Pre-Production
description: >
  Full pre-production readiness audit combining all domain audits. Use when asked to assess
  production readiness, do a launch checklist, or perform a go/no-go review. Covers OWASP
  Top 10, GDPR, GPSR, multi-tenancy, and operational readiness.
---

# Audit Pre-Production

Master audit that orchestrates all domain audits and produces a go/no-go decision.

## Prerequisites

- Run (or have results from) all 6 domain audits:
  - `audit-frontend`, `audit-admin`, `audit-database`, `audit-api`, `audit-podclaw`, `audit-infrastructure`
- Read existing audit reports at workspace root (`AUDIT_*_[DATE].md`)
- Read `CLAUDE.md` for architecture overview

## Workflow

### Phase 1: Aggregate Domain Audits

1. **Collect existing reports**:
   - Read all `AUDIT_*_[DATE].md` files
   - Extract CRITICAL and FAIL items from each
   - Build consolidated issue list

2. **Run missing audits**:
   - If any domain audit is missing or stale (>7 days), trigger it
   - Use the corresponding audit skill

### Phase 2: OWASP Top 10 Cross-Check

3. **A01 Broken Access Control**:
   - RLS policies enforced? (from DB audit)
   - Auth on every endpoint? (from API audit)
   - Admin RBAC working? (from admin audit)

4. **A02 Cryptographic Failures**:
   - Secrets in env vars, not code? (from infra audit)
   - HTTPS enforced? (from infra audit)
   - Password hashing algorithm? (from admin audit)

5. **A03 Injection**:
   - SQL injection vectors? (from API audit)
   - XSS vectors? (from frontend audit)
   - Command injection? (from API/PodClaw audit)

6. **A04 Insecure Design**:
   - Multi-tenancy isolation verified? (from DB audit)
   - Chat isolation per user? (from frontend audit)
   - Agent sandboxing? (from PodClaw audit)

7. **A05 Security Misconfiguration**:
   - Security headers present? (from frontend/admin/infra audit)
   - Default credentials removed? (from admin audit)
   - Debug mode disabled? (from all audits)

8. **A06 Vulnerable Components**:
   - `npm audit` results for frontend and admin
   - Python dependency audit for PodClaw
   - Docker image CVE scan

9. **A07 Authentication Failures**:
   - Brute force protection? (from admin audit)
   - Session management? (from frontend/admin audit)
   - MFA available? (from admin audit)

10. **A08 Data Integrity Failures**:
    - Webhook signature validation? (from API audit)
    - CI/CD pipeline security? (from infra audit)
    - Dependency integrity? (lockfile pinning)

11. **A09 Logging & Monitoring**:
    - Audit logging? (from admin audit)
    - Agent activity logging? (from PodClaw audit)
    - Infrastructure monitoring? (from infra audit)

12. **A10 SSRF**:
    - Can users trigger server-side requests? (AI calls, image URLs)
    - Are URLs validated before fetching?
    - Is there an allowlist for external domains?

### Phase 3: Regulatory Compliance

13. **GDPR compliance**:
    - Is there a privacy policy?
    - Can users export their data?
    - Can users delete their account and all data?
    - Is consent tracked for marketing communications?
    - Are data processing records maintained?

14. **GPSR compliance** (EU Product Safety):
    - Do ALL products have safety_information in product_details?
    - Is manufacturer info present?
    - Are material compositions listed?
    - Is care instruction info available?

15. **Cookie consent**:
    - Is there a cookie banner?
    - Are non-essential cookies blocked until consent?
    - Is consent revocable?

### Phase 4: Operational Readiness

16. **Deployment checklist**:
    - Can the system be deployed from scratch with `start.sh`?
    - Is there a rollback procedure?
    - Are backups configured and tested?
    - Is there a runbook for common failures?

17. **Monitoring & alerting**:
    - Are health checks configured for all services?
    - Is there uptime monitoring?
    - Are error alerts configured? (email, Telegram, etc.)
    - Is there a status page?

18. **Performance baseline**:
    - Are page load times acceptable? (<3s on 3G)
    - Are API response times reasonable? (<500ms p95)
    - Is there a CDN for static assets?
    - Are images optimized?

### Phase 5: Go/No-Go Decision

19. **Classify all findings**:
    - **BLOCKER**: Must fix before launch (any CRITICAL from domain audits)
    - **SHOULD FIX**: Fix within first week post-launch
    - **NICE TO HAVE**: Backlog items

20. **Decision matrix**:
    - 0 BLOCKERS → GO
    - 1+ BLOCKERS → NO-GO (list required fixes)

## Output Format

Generate `AUDIT_PREPRODUCTION_[DATE].md` at workspace root with:

```markdown
# Pre-Production Audit — [DATE]

## GO / NO-GO Decision: [GO | NO-GO]

## Blockers (must fix before launch)
[List with source audit and fix description]

## OWASP Top 10 Matrix
| Category | Status | Source | Notes |
|---|---|---|---|

## GDPR Compliance
| Requirement | Status | Notes |
|---|---|---|

## GPSR Compliance
| Requirement | Status | Notes |
|---|---|---|

## Should Fix (first week)
[Prioritized list]

## Nice to Have (backlog)
[Deprioritized list]

## Domain Audit Summary
| Audit | Date | CRITICAL | FAIL | WARN | PASS |
|---|---|---|---|---|---|
```
