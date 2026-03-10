# Printify Legacy Documentation Audit

**Date**: 2026-03-08
**Scope**: All non-code documentation files across the project
**Total files with "Printify" references**: 190 `.md` files + 52 `.json` files
**Total occurrences in `.md` files**: ~2,405
**Total occurrences in `.json` files**: ~11,705 (mostly in backup/session data)

---

## Executive Summary

The Printify-to-Printful migration left **massive documentation debt**. Of 190 markdown files referencing "Printify", only ~20 are historical migration docs where the reference is expected. The remaining ~170 files contain **stale or actively misleading** Printify references that describe the current system incorrectly. The contamination spans every layer: project instructions (CLAUDE.md), agent memory, Claude skills, PodClaw backend docs, audit reports, onboarding guides, deployment runbooks, and user-facing i18n strings.

**Critical impact**: CLAUDE.md alone has 9 Printify references including API URLs, env vars, and shop IDs that no longer apply. Any agent reading CLAUDE.md will use incorrect Printify API patterns instead of Printful.

---

## 1. CLAUDE.md (HIGHEST PRIORITY)

**File**: `/Users/lr0y/POD-AI-PDR/pod_workspace/project/CLAUDE.md`
**Occurrences**: 9
**Status**: ACTIVELY MISLEADING

| Line | Content | Severity |
|------|---------|----------|
| 44 | `SKILL.md (pipeline Printify 10 pasos)` — describes design-dtg skill | HIGH |
| 74 | `Precio en Printify PRIMERO` — pricing workflow instruction | CRITICAL |
| 78 | Section header: `PRINTIFY & SUPABASE — CONNECTION REFERENCE (MANDATORY READ)` | CRITICAL |
| 80 | Sub-header: `### PRINTIFY API` | CRITICAL |
| 81 | `Base URL: https://api.printify.com/v1` | CRITICAL |
| 82 | `Auth: Bearer JWT — env var PRINTIFY_API_TOKEN` | CRITICAL |
| 83 | `Shop ID: env var PRINTIFY_SHOP_ID (value: 26473208 = AI-Shopper)` | CRITICAL |
| 87 | `Authorization: Bearer ${PRINTIFY_API_TOKEN}` in code block | CRITICAL |
| 94 | `frontend/src/lib/printify.ts — PrintifyClient class` | HIGH |

**Action**: URGENT UPDATE — Replace entire PRINTIFY section with Printful API reference. This is the master instruction file read by every agent and session.

---

## 2. Claude Skills (`.claude/skills/`)

### 2.1 Legacy Design Skills (Pre-migration, Printify pipeline)

| Skill | File | Occurrences | Status | Action |
|-------|------|-------------|--------|--------|
| `design-dtg` | `SKILL.md` | 9 | STALE | Rewrite pipeline section from Printify to Printful |
| `design-dtg` | `DESIGN_GUIDELINES.md` | 1 | STALE | Update `print_areas y:0.45` Printify positioning ref |
| `design-embroidery` | `SKILL.md` | 5 | STALE | Rewrite pipeline section from Printify to Printful |
| `design-sublimation` | `SKILL.md` | 4 | STALE | Rewrite pipeline section from Printify to Printful |
| `product-catalog-planner` | `SKILL.md` | 3 | STALE | Update GPSR flow, branding add-ons, blueprint references |
| `product-catalog-planner` | `PRICING_RULES.md` | 2 | STALE | Update pricing workflow (Printify USD cents → Printful EUR) |

**Summary**: The 4 original design skills all contain full Printify product creation pipelines (upload, create, GPSR, publish, sync) that are completely wrong for the current Printful integration.

### 2.2 Printful Skills (Post-migration, with legacy cross-references)

| Skill | File | Occurrences | Content | Action |
|-------|------|-------------|---------|--------|
| `printful-tshirt` | `SKILL.md` | 1 | "For Printify-based products... see `design-dtg`" | Minor — update cross-reference |
| `printful-tshirt` | `BRANDING.md` | 1 | "Posicion Printify: x: 0.28, y: 0.22, scale: 0.3" | Update label |
| `printful-m2580-embroidery` | `SKILL.md` | 1 | `pod_provider: 'printful', // IMPORTANT: 'printful', no 'printify'` | OK — Correct warning |
| `printful-m2580-embroidery` | `BRANDING.md` | 3 | "Design Files del Origin (Printify)" + Printify S3 URLs | Historical — needs context note |
| `printful-sasu024` | `SKILL.md` | 1 | "Para productos Printify (legacy DTG on P26), ver `design-dtg`" | Update cross-reference |
| `printful-stsu177` | `SKILL.md` | 1 | "For Printify-based products (legacy DTG on P26)" | Update cross-reference |
| `printful-m2580` | `SKILL.md` | 1 | "For Printify-based products (legacy DTG on P26)" | Update cross-reference |
| `printful-cc1717` | `SKILL.md` | 1 | "For Printify-based products (DTG... on P26)" | Update cross-reference |
| `printful-mc1087` | `SKILL.md` | 1 | "For Printify-based products (legacy DTG on P26)" | Update cross-reference |
| `printful-m2480` | `SKILL.md` | 1 | "For Printify-based products (legacy DTG on P26)" | Update cross-reference |
| `printful-g18600` | `SKILL.md` | 1 | "For Printify-based products (legacy DTG on P26)" | Update cross-reference |
| `printful-sols03576-dtg` | `SKILL.md` | 1 | References `printify-sync.ts` margin threshold | Update file reference |
| `printful-otto1018-embroidery` | `SKILL.md` | 1 | `pod_provider: 'printful', // IMPORTANT: ... NOT 'printify'` | OK — Correct warning |
| `printful-camelbak-thrive` | `SKILL.md` | 1 | "For Printify-based drinkware... see `design-sublimation`" | Update cross-reference |

### 2.3 Audit Skills

| Skill | File | Occurrences | Content | Action |
|-------|------|-------------|---------|--------|
| `audit-performance` | `SKILL.md` | 2 | Check Printify/Printful image CDN preconnect | Minor update |
| `audit-webhooks-idempotency` | `SKILL.md` | 7 | Printify HMAC sig verification, webhook handlers | Update to reflect current provider |
| `audit-design-studio` | `SKILL.md` | 2 | Competitor comparison table Printify column | OK — competitor reference |

---

## 3. Memory Files

### 3.1 Project Memory (`~/.claude/projects/.../memory/`)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `MEMORY.md` | 16 | ACTIVELY MISLEADING | Lines 152, 155, 157-158, 175, 181, 184, 188-195, 197, 207-208 all reference Printify API, sync flows, env vars | URGENT UPDATE |
| `printify-supabase-connections.md` | ~80 | ENTIRELY STALE | Entire file documents Printify API (URLs, headers, endpoints, env vars, curl patterns) | DELETE or REWRITE as Printful |
| `printify-product-rules.md` | ~30 | MOSTLY STALE | Describes Printify GPSR flow, product creation, provider IDs (P26, P410, P90, etc.) | DELETE or REWRITE |

**Note**: `MEMORY.md` line 7 correctly says "Printful (migrado de Printify)" but all subsequent sections (lines 152+) still describe the old Printify system in detail.

---

## 4. i18n Messages (USER-FACING)

| File | Line | Content | Status |
|------|------|---------|--------|
| `frontend/messages/en.json` | 1169 | `"Printify: order fulfillment and shipping"` | STALE — User sees "Printify" |
| `frontend/messages/en.json` | 1219 | `"Print-on-demand fulfillment through our partner network (Printify)"` | STALE — User sees "Printify" |
| `frontend/messages/es.json` | 1169 | `"Printify: cumplimiento y envío de pedidos"` | STALE |
| `frontend/messages/es.json` | 1219 | `"Cumplimiento de impresión bajo demanda a través de nuestra red de socios (Printify)"` | STALE |
| `frontend/messages/de.json` | 1169 | `"Printify: Auftragsabwicklung und Versand"` | STALE |
| `frontend/messages/de.json` | 1219 | `"Print-on-Demand-Erfüllung über unser Partnernetzwerk (Printify)"` | STALE |

**Action**: CRITICAL — These are displayed to end users. Must replace "Printify" with "Printful" in all 3 languages.

---

## 5. PodClaw Backend Documentation

### 5.1 Core PodClaw Docs

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `podclaw/TOOLS.md` | 12 | STALE | Entire `printify` connector section with 10 tool names + config vars | Rewrite for Printful |
| `podclaw/AGENTS.md` | 9 | STALE | Agent tool access lists reference `printify` connector | Update to `printful` |
| `podclaw/README.md` | 4 | STALE | `PRINTIFY_API_TOKEN`, architecture diagram, agent tool lists | Update |
| `podclaw/USAGE.md` | 6 | STALE | E2E test flows reference Printify API, `PRINTIFY_SHOP_ID` | Update |
| `podclaw/SECURITY.md` | 5 | STALE | Rate limit tables for `printify_create`, `printify_publish`, etc. | Update tool names |
| `podclaw/CONTRIBUTING.md` | 1 | STALE | Directory tree shows `printify_connector.py` | Update filename |

### 5.2 PodClaw Agent Skills

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `podclaw/skills/cataloger/SKILL.md` | 33 | STALE | Full Printify CRUD tool list (18 tools), workflow, sync rules | REWRITE |
| `podclaw/skills/qa_inspector/SKILL.md` | 13 | STALE | Printify sync checks, health checks, tool list | REWRITE |
| `podclaw/skills/brand_manager/SKILL.md` | 9 | STALE | Printify product update tools, neck label workflow | REWRITE |
| `podclaw/skills/designer/SKILL.md` | 7 | STALE | Printify image upload tools, blueprint/provider tools | REWRITE |
| `podclaw/skills/customer_manager/SKILL.md` | 5 | STALE | Printify order management tools | REWRITE |
| `podclaw/skills/researcher/SKILL.md` | 1 | STALE | Printify product count sync check | Update |
| `podclaw/skills/cataloger/templates/product_template.md` | 2 | STALE | `{printify_blueprint}` template variable | Update |

### 5.3 PodClaw Context Files

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `podclaw/context/product_workflow.md` | 22 | STALE | Full Printify product creation workflow (18 steps) | REWRITE |
| `podclaw/context/design_workflow.md` | 3 | STALE | Upload pipeline references Printify | Update |
| `podclaw/context/best_sellers.md` | 17 | MIXED | Sync status (stale) + market research citing Printify blog (historical) | Partial update |
| `podclaw/context/qa_report.md` | 8 | STALE | Printify sync status, root cause analysis | Update |
| `podclaw/context/pricing_history.md` | 8 | STALE | "Printify ID" column headers, data source attribution | Update |
| `podclaw/context/customer_insights.md` | 2 | STALE | "Printify mockups excellent" quality assessment | Update |
| `podclaw/context/brand_config.md` | 1 | STALE | "Printify Upload ID" field | Update |
| `podclaw/context/design_library.md` | 1 | STALE | "Upload to Printify" action item | Update |
| `podclaw/context/RESEARCH_SOURCES.md` | 11 | HISTORICAL | External Printify blog/guide URLs used as research sources | Keep — valid external references |

### 5.4 PodClaw Catalog

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `podclaw/catalog/README.md` | 11 | STALE | Title "Printify Europa", Premium plan, 7 Printify URLs | REWRITE |
| `podclaw/catalog/PRICING-MODEL.md` | 3 | STALE | "Printify Premium ($24.99/mes)", pricing references | REWRITE |
| `podclaw/catalog/INDEX.md` | 2 | STALE | "Printify Choice EU" provider reference | Update |
| `podclaw/catalog/01-camisetas.md` | 1 | STALE | "Printify Premium obligatorio" | Update |
| `podclaw/catalog/02-sudaderas-hoodies.md` | 1 | STALE | "Printify lo destaca como..." (market ref but used as instruction) | Update |
| `podclaw/catalog/05-tazas-drinkware.md` | 1 | STALE | Provider verification instruction | Update |
| `podclaw/catalog/07-pijamas-loungewear.md` | 4 | STALE | "Proveedores Printify (US-based)" | Update |
| `podclaw/catalog/08-velas.md` | 5 | STALE | Printify product recommendations, provider refs | Update |
| `podclaw/catalog/09-tote-bags-accesorios.md` | 3 | STALE | "Printify identifica keychains..." | Update |
| `podclaw/catalog/10-arte-decoracion.md` | 3 | STALE | "Printify destaca canvas..." | Update |

### 5.5 PodClaw Archive/Reports

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `podclaw/reports/trend_report_2026-02-15.md` | 6 | HISTORICAL | Competitor analysis, external URLs | Keep |
| `podclaw/context/archive/best_sellers.md.2026-02-16.md` | 22 | HISTORICAL | Pre-migration sync audit | Archive |
| `podclaw/context/archive/pricing_history.md.2026-02-16.md` | 1 | HISTORICAL | "Printify ID" column header | Archive |
| `podclaw/context/archive/customer_insights.md.2026-02-17.md` | 6 | HISTORICAL | Pre-migration customer insights | Archive |
| `podclaw/context/archive/customer_insights.md.2026-02-16.md` | 4 | HISTORICAL | Pre-migration customer insights | Archive |

---

## 6. Project-Level Documentation (`docs/`)

### 6.1 Printify-Specific Files

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/audit-360/12-printify-integration.md` | 90 | STALE | Full Printify integration audit | ARCHIVE or DELETE |
| `docs/plan-maestro/13-printify-integration.md` | 27 | STALE | Printify integration plan | ARCHIVE or DELETE |

### 6.2 General Docs with Printify References

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/runbooks/deployment.md` | 17 | STALE | Printify env vars, webhook endpoints, troubleshooting | REWRITE deployment section |
| `docs/ONBOARDING.md` | 5 | STALE | Printify account requirement, env vars | Update |
| `docs/ARCHITECTURE_AI_PERSONALIZATION.md` | 8 | STALE | Design studio → Printify integration architecture | Update |
| `docs/database-erd.md` | 4 | STALE | `printify_product_id` column, webhook provider enum | Update |
| `docs/admin-audit-2026-03-06.md` | 28 | MIXED | Admin panel audit with Printify sync references | Update active refs |
| `docs/admin-feature-proposal-2026-03-06.md` | 3 | STALE | Feature proposals referencing Printify | Update |
| `docs/audit-history/FAILING_FEATURES_AUDIT.md` | 4 | HISTORICAL | Past test failures | Archive |

### 6.3 Plan Maestro

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/plan-maestro/99-roadmap-ejecutivo.md` | 12 | STALE | Roadmap with Printify milestones | Update |
| `docs/plan-maestro/11-multi-tenant.md` | 12 | STALE | Multi-tenant with Printify shop IDs | Update |
| `docs/plan-maestro/01-seguridad.md` | 4 | STALE | Security plan with Printify webhook refs | Update |
| `docs/plan-maestro/00-indice.md` | 1 | STALE | Index referencing "13-printify-integration" | Update |
| `docs/plan-maestro/05-categorias.md` | 3 | STALE | Category sync with Printify | Update |
| `docs/plan-maestro/09-observabilidad.md` | 2 | STALE | Monitoring Printify API | Update |
| `docs/plan-maestro/06-podclaw-governance.md` | 1 | STALE | PodClaw Printify connector | Update |
| `docs/plan-maestro/04-frontend-ecommerce.md` | 1 | STALE | Frontend Printify integration | Update |
| `docs/plan-maestro/12-documentacion.md` | 2 | STALE | Documentation plan with Printify refs | Update |

### 6.4 Audit 360

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/audit-360/11-integrations.md` | 33 | STALE | Integration audit with Printify section | Update |
| `docs/audit-360/04-podclaw-governance.md` | 11 | STALE | PodClaw Printify connector references | Update |
| `docs/audit-360/03-category-expansion.md` | 13 | STALE | Category mapping with Printify blueprints | Update |
| `docs/audit-360/08-security-auth.md` | 7 | STALE | Printify webhook security | Update |
| `docs/audit-360/06-testing-docs.md` | 4 | STALE | Test coverage for Printify | Update |
| `docs/audit-360/07-database-schema.md` | 3 | STALE | DB schema with Printify columns | Update |
| `docs/audit-360/99-executive-summary.md` | 3 | STALE | Executive summary with Printify refs | Update |
| `docs/audit-360/02-frontend-ecommerce.md` | 1 | STALE | Frontend Printify integration | Update |
| `docs/audit-360/README.md` | 1 | STALE | Index mentioning Printify | Update |

### 6.5 Production Audit

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/production-audit/02-printful-stripe-config.md` | 30 | MIXED | Named Printful but references Printify internally | Update internal refs |
| `docs/production-audit/05-database-performance.md` | 20 | STALE | DB queries referencing `printify_id` columns | Update |
| `docs/production-audit/01-purchase-payment-returns.md` | 6 | STALE | Purchase flow with Printify fulfillment | Update |
| `docs/production-audit/04-admin-config-monitoring.md` | 5 | STALE | Admin config with Printify env vars | Update |
| `docs/production-audit/07-frontend-ux-performance-seo.md` | 4 | STALE | Frontend UX with Printify image refs | Update |
| `docs/production-audit/00-executive-summary.md` | 2 | STALE | Summary mentioning Printify | Update |
| `docs/production-audit/03-legal-compliance-i18n.md` | 1 | STALE | Legal compliance with Printify ref | Update |

### 6.6 Orders Audit (2026-03-08)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `docs/audit-orders-2026-03-08/01-ORDER-LIFECYCLE.md` | 22 | MIXED | Order lifecycle, some Printify refs in current flow | Update |
| `docs/audit-orders-2026-03-08/02-PRINTFUL-SYNC-INVENTORY.md` | 16 | MIXED | Named Printful but has legacy Printify refs | Update |
| `docs/audit-orders-2026-03-08/04-PRODUCT-AVAILABILITY-UX.md` | 3 | STALE | Product availability with Printify refs | Update |
| `docs/audit-orders-2026-03-08/00-CONSOLIDATED-INDEX.md` | 2 | STALE | Index with Printify mentions | Update |

---

## 7. Frontend Documentation (`frontend/docs/`)

### 7.1 Printify-Named Files (ENTIRELY LEGACY)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/docs/printify-mockups.md` | 39 | STALE | Printify mockup API research | ARCHIVE or DELETE |
| `frontend/docs/printify-branding-gift-message.md` | 44 | STALE | Printify branding/gift features | ARCHIVE or DELETE |
| `frontend/docs/printify-aop-products.md` | 28 | STALE | Printify AOP products research | ARCHIVE or DELETE |
| `frontend/docs/printify-neck-labels.md` | 19 | STALE | Printify neck label research | ARCHIVE or DELETE |
| `frontend/docs/printify-packaging-inserts.md` | 11 | STALE | Printify packaging inserts | ARCHIVE or DELETE |
| `frontend/docs/printify-placeholders-audit.md` | 3 | STALE | Printify placeholder audit | ARCHIVE or DELETE |
| `frontend/docs/PRINTIFY-RESEARCH-ANALYSIS.md` | 8 | STALE | Printify API research | ARCHIVE or DELETE |

### 7.2 Printful Migration Docs (Historical — Expected References)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/docs/printful-migration/printify-integration-audit.md` | 57 | HISTORICAL | Pre-migration audit of Printify integration | Keep as history |
| `frontend/docs/printful-migration/plan-sections/01-provider-abstraction.md` | 281 | HISTORICAL | Provider abstraction plan (Printify → Printful) | Keep as history |
| `frontend/docs/printful-migration/plan-sections/06-database-testing.md` | 247 | HISTORICAL | Database migration tests | Keep as history |
| `frontend/docs/printful-migration/design-module-audit.md` | 96 | HISTORICAL | Design module audit pre-migration | Keep as history |
| `frontend/docs/printful-migration/api-endpoints-map.md` | 90 | HISTORICAL | API endpoint mapping Printify → Printful | Keep as history |
| `frontend/docs/printful-migration/architecture-recommendations.md` | 87 | HISTORICAL | Architecture recommendations during migration | Keep as history |
| `frontend/docs/printful-migration/plan-sections/03-sync-webhooks-cron.md` | 83 | HISTORICAL | Sync/webhook migration plan | Keep as history |
| `frontend/docs/printful-migration/MIGRATION_PLAN.md` | 82 | HISTORICAL | Master migration plan | Keep as history |
| `frontend/docs/printful-migration/plan-sections/02-printful-adapter.md` | 80 | HISTORICAL | Printful adapter implementation plan | Keep as history |
| `frontend/docs/printful-migration/chat-interface-audit.md` | 50 | HISTORICAL | Chat interface audit pre-migration | Keep as history |
| `frontend/docs/printful-migration/plan-sections/04-catalog-migration.md` | 39 | HISTORICAL | Catalog migration plan | Keep as history |
| `frontend/docs/printful-migration/printful-design-personalization-research.md` | 19 | HISTORICAL | Research doc | Keep as history |
| `frontend/docs/printful-migration/printful-migration-index.md` | 12 | HISTORICAL | Migration index | Keep as history |
| `frontend/docs/printful-migration/printful-api-types.md` | 8 | HISTORICAL | API type mapping | Keep as history |
| `frontend/docs/printful-migration/printful-products-api.md` | 6 | HISTORICAL | Products API comparison | Keep as history |
| `frontend/docs/printful-migration/printful-api-overview.md` | 5 | HISTORICAL | API overview comparison | Keep as history |
| `frontend/docs/printful-migration/post-migration-audit.md` | 5 | HISTORICAL | Post-migration audit | Keep as history |
| `frontend/docs/printful-migration/printful-file-library-api.md` | 4 | HISTORICAL | File library API comparison | Keep as history |
| `frontend/docs/printful-migration/plan-sections/05-design-studio-v2.md` | 4 | HISTORICAL | Design studio v2 plan | Keep as history |
| `frontend/docs/printful-migration/printful-authentication.md` | 3 | HISTORICAL | Auth comparison | Keep as history |
| `frontend/docs/printful-migration/current-catalog-audit.md` | 3 | HISTORICAL | Catalog state pre-migration | Keep as history |
| `frontend/docs/printful-migration/design-personalization-research.md` | 2 | HISTORICAL | Research | Keep as history |
| `frontend/docs/printful-migration/printful-shipping-api.md` | 2 | HISTORICAL | Shipping API comparison | Keep as history |
| `frontend/docs/printful-migration/printful-orders-api.md` | 2 | HISTORICAL | Orders API comparison | Keep as history |
| `frontend/docs/printful-migration/printful-mockup-generator-api.md` | 2 | HISTORICAL | Mockup API comparison | Keep as history |
| `frontend/docs/printful-migration/printful-webhooks-api.md` | 2 | HISTORICAL | Webhooks API comparison | Keep as history |

### 7.3 Design Studio Docs

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/docs/design-studio-audit/03-production-pipeline-audit.md` | 15 | STALE | Production pipeline with Printify refs | Update |
| `frontend/docs/design-studio-audit/DESIGN_STUDIO_AUDIT_E2E.md` | 6 | STALE | E2E audit with Printify refs | Update |
| `frontend/docs/design-studio-audit/04-persistence-cart-audit.md` | 5 | STALE | Cart persistence with Printify product refs | Update |
| `frontend/docs/design-studio-audit/02-ux-competitor-analysis.md` | 4 | MIXED | Competitor analysis (Printify as competitor = OK) | Keep competitor refs |
| `frontend/docs/design-studio-audit/01-canvas-bugs-audit.md` | 2 | STALE | Canvas bugs with Printify refs | Update |
| `frontend/docs/design-studio-audit/FASE4_RESEARCH.md` | 1 | STALE | Research with Printify ref | Update |
| `frontend/docs/POD_DESIGN_EDITOR_MARKET_RESEARCH.md` | 13 | MIXED | Market research (Printify as competitor = OK) | Keep competitor refs |
| `frontend/docs/design-studio-research/08-ux-flows.md` | 5 | MIXED | UX flow research | Review |
| `frontend/docs/design-studio-research/07-font-system.md` | 1 | STALE | Font system with Printify ref | Update |
| `frontend/docs/design-studio-research/06-print-technique-constraints.md` | 4 | MIXED | Print technique research | Review |

### 7.4 Profile/Engagement Audit Docs

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/docs/profile-audit-v2/04-cart-to-delivery-lifecycle.md` | 30 | STALE | Cart-to-delivery lifecycle with Printify fulfillment | Update |
| `frontend/docs/profile-audit-v2/02-backend-api-purchase-flow.md` | 22 | STALE | Backend API purchase flow with Printify | Update |
| `frontend/docs/profile-audit-v2/01-database-schema-multitenancy.md` | 16 | STALE | Database schema with `printify_id` refs | Update |
| `frontend/docs/profile-audit-v2/06-engagement-best-practices.md` | 2 | STALE | Engagement with Printify refs | Update |
| `frontend/docs/profile-audit-v2/05-consolidated-gaps-priorities.md` | 2 | STALE | Gap analysis with Printify refs | Update |
| `frontend/docs/profile-audit-v2/08-current-engagement-audit.md` | 1 | STALE | Engagement audit with Printify ref | Update |
| `frontend/docs/profile-audit-v2/07-mcp-server-audit.md` | 1 | STALE | MCP server audit with Printify ref | Update |

### 7.5 Auth/Security Audit Docs

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/docs/audit-auth-security-2026-03-08/06-security-headers-cache.md` | 4 | STALE | Security headers with Printify CDN refs | Update |
| `frontend/docs/audit-auth-security-2026-03-08/04-rate-limiting.md` | 2 | STALE | Rate limiting with Printify refs | Update |

---

## 8. Audit Reports (Project Root + `audits/`)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `AUDIT_PODCLAW_2026-03-07.md` | 10 | STALE | PodClaw audit with Printify connector refs | Update |
| `AUDIT_PREDEPLOY.md` | 8 | STALE | Pre-deploy audit with Printify service refs | Update |
| `AUDIT_API_2026-03-07.md` | 2 | STALE | API audit with Printify refs | Update |
| `AUDIT_DATABASE_2026-03-07.md` | 2 | STALE | Database audit with `printify_id` refs | Update |
| `AUDIT_INFRASTRUCTURE_2026-03-07.md` | 1 | STALE | Infrastructure audit with Printify ref | Update |
| `AUDIT_SEO_2026-03-07.md` | 1 | STALE | SEO audit with Printify ref | Update |
| `audits/2026-03-07/AUDIT_PODCLAW.md` | 9 | STALE | PodClaw audit with Printify connector | Update |
| `audits/2026-03-07/AUDIT_API.md` | 2 | STALE | API audit | Update |
| `audits/2026-03-07/AUDIT_PREPRODUCTION.md` | 3 | STALE | Pre-production audit | Update |
| `audits/2026-03-07/AUDIT_ADMIN.md` | 2 | STALE | Admin audit | Update |
| `audits/2026-03-07/AUDIT_INFRASTRUCTURE.md` | 2 | STALE | Infrastructure audit | Update |
| `audits/2026-03-07/AUDIT_INFRASTRUCTURE_V2.md` | 1 | STALE | Infrastructure audit v2 | Update |
| `audits/2026-03-07/AUDIT_DESIGN_STUDIO.md` | 1 | STALE | Design studio audit | Update |

### Audit Exploration Files

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `audits/2026-03-07/exploration/checkout_webhooks.md` | 7 | STALE | Checkout webhook analysis | Update |
| `audits/2026-03-07/exploration/todos_deadcode_residuals.md` | 7 | STALE | Dead code analysis | Update |
| `audits/2026-03-07/exploration/email_performance_v2.md` | 5 | STALE | Email performance | Update |
| `audits/2026-03-07/exploration/email_performance.md` | 5 | STALE | Email performance | Update |
| `audits/2026-03-07/exploration/repo_structure_scripts.md` | 4 | STALE | Repo structure | Update |
| `audits/2026-03-07/exploration/profile_large_components.md` | 3 | STALE | Profile components | Update |
| `audits/2026-03-07/exploration/seo_i18n_accessibility.md` | 2 | STALE | SEO/i18n | Update |

### E-commerce Audit

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/audit-ecommerce-2026-03-07/06-engagement-retention.md` | 1 | STALE | Engagement audit | Update |
| `frontend/audit-ecommerce-2026-03-07/04-seo-discoverability.md` | 1 | STALE | SEO audit | Update |

---

## 9. Frontend Root-Level Docs

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/CATALOGO_EU_DEFINITIVO.md` | 3 | STALE | "Verificado contra Printify Shipping API", P99 (Printify Choice) | Update |
| `frontend/EXPANSION_50_PRODUCTOS.md` | 3 | STALE | Printify pricing workflow, external URLs | Update |
| `frontend/PRODUCT_CATALOG.md` | 2 | STALE | "Generado desde datos reales (Printify API + Supabase)" | Update |
| `frontend/FASE1_CATALOGO_PRODUCCION.md` | 2 | STALE | "Upload PNG a Printify" | Update |
| `frontend/printify_catalog.md` | 1 | STALE | "Printify Choice" provider | ARCHIVE or DELETE |
| `frontend/docs/HEADWEAR_COLLECTION_v2.md` | 1 | STALE | Headwear with Printify ref | Update |
| `frontend/public/phase2-production/PHASE2_PLAN.md` | 1 | STALE | "crear los 10 productos en Printify" | Update |

---

## 10. Project Root Files

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `README.md` | 5 | STALE | "Printify fulfillment", architecture diagram, env vars, agent tools | URGENT UPDATE |
| `CHANGELOG.md` | 9 | HISTORICAL | Past changelog entries (correct as history) | Keep |
| `CONTRIBUTING.md` | 1 | STALE | "Mock external services (Stripe, Printify, Supabase)" | Update |
| `SETUP.md` | 4 | STALE | `PRINTIFY_API_TOKEN`, "Printify REST API", setup instructions | URGENT UPDATE |
| `MARKET_RESEARCH_SUMMARY.md` | 1 | HISTORICAL | Competitor comparison | Keep |
| `test_stock_sourced_products.md` | 1 | STALE | "Revisa el catálogo actual en Printify" | Update or Delete |

---

## 11. Other Files

### Supabase/Setup

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `supabase/README.md` | 2 | STALE | "synced with Printify", "Configure Printify integration" | Update |
| `setup/README.md` | 1 | STALE | "Printify - Print-on-demand fulfillment" | Update |
| `docs/reference/printful-api-products.md` | 3 | MIXED | Named Printful but has Printify cross-refs | Update |

### JSON Data Files (Non-Session)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `frontend/messages/en.json` | 2 | STALE | User-facing Printify strings | CRITICAL — Update |
| `frontend/messages/es.json` | 2 | STALE | User-facing Printify strings | CRITICAL — Update |
| `frontend/messages/de.json` | 2 | STALE | User-facing Printify strings | CRITICAL — Update |
| `frontend/vercel.json` | 1 | STALE | Cron route `/api/cron/sync-printify` | Update when route renamed |
| `frontend/scripts/phase1-backup.json` | 4768 | HISTORICAL | Backup data from Printify era | Keep as backup |
| `frontend/scripts/phase1-backups/*.json` | ~3,500+ | HISTORICAL | Individual product backups from Printify | Keep as backup |
| `frontend/scripts/_catalog-snapshot.json` | 53 | HISTORICAL | Catalog snapshot from Printify era | Keep as backup |
| `frontend/scripts/phase1-audit.json` | 40 | HISTORICAL | Audit data from Printify era | Keep as backup |
| `frontend/scripts/phase1-verification-report.json` | 20 | HISTORICAL | Verification data from Printify era | Keep as backup |
| `frontend/scripts/phase1-archive-results.json` | 20 | HISTORICAL | Archive data from Printify era | Keep as backup |
| `frontend/public/mockup-preview/manifest.json` | 79 | STALE | Mockup manifest with Printify image URLs | Review |

### Session Data (`.claude/data/sessions/`)

Multiple session JSON files contain Printify references from past conversations. These are ephemeral and do not need updating.

---

## 12. Product Plans (`.claude/data/product-plans/`)

| File | Occurrences | Status | Action |
|------|-------------|--------|--------|
| `.claude/data/product-plans/2026-02-28-meme-previews-batch.md` | 2 | HISTORICAL | "COMPLETADO — 10/10 productos creados en Printify" | Keep as history |
| `.claude/data/product-plans/2026-02-28-kids-collection.md` | 1 | STALE | "Crear productos en Printify" (if plan is still active) | Review |

---

## Recommendations — Priority Order

### P0: CRITICAL (Actively misleading agents and users)

1. **CLAUDE.md** (lines 44, 74, 78-94) — Replace entire `PRINTIFY & SUPABASE` section with Printful equivalent
2. **Memory files** — Rewrite `printify-supabase-connections.md` and `printify-product-rules.md` for Printful, or delete and create Printful equivalents
3. **MEMORY.md** — Update lines 152-208 to reflect Printful integration
4. **i18n messages** — Replace "Printify" with "Printful" in `en.json`, `es.json`, `de.json` (lines 1169, 1219)

### P1: HIGH (Core operational docs used by developers and agents)

5. **README.md** — Update architecture description, env vars, integrations list
6. **SETUP.md** — Replace `PRINTIFY_API_TOKEN` references with Printful equivalents
7. **PodClaw skills** — Rewrite all 7 agent skills (`cataloger`, `qa_inspector`, `brand_manager`, `designer`, `customer_manager`, `researcher`, template)
8. **PodClaw core docs** — Update `TOOLS.md`, `AGENTS.md`, `README.md`, `USAGE.md`, `SECURITY.md`, `CONTRIBUTING.md`
9. **PodClaw context files** — Update `product_workflow.md`, `design_workflow.md`, `qa_report.md`, `best_sellers.md`, `pricing_history.md`
10. **Claude design skills** — Rewrite pipeline sections in `design-dtg`, `design-embroidery`, `design-sublimation`, `product-catalog-planner`
11. **Deployment runbook** — Rewrite `docs/runbooks/deployment.md` Printify sections

### P2: MEDIUM (Documentation accuracy)

12. **PodClaw catalog** — Update all 10 catalog category files + `README.md` + `PRICING-MODEL.md` + `INDEX.md`
13. **Frontend catalog docs** — Update `CATALOGO_EU_DEFINITIVO.md`, `PRODUCT_CATALOG.md`, `EXPANSION_50_PRODUCTOS.md`, `FASE1_CATALOGO_PRODUCCION.md`
14. **Printful skill cross-references** — Update the ~10 Printful skills that say "For Printify-based products..."
15. **Audit skills** — Update `audit-webhooks-idempotency`, `audit-performance`
16. **Docs general** — Update `ONBOARDING.md`, `ARCHITECTURE_AI_PERSONALIZATION.md`, `database-erd.md`
17. **supabase/README.md**, `setup/README.md`, `CONTRIBUTING.md`

### P3: LOW (Historical docs, audits, archives)

18. **Audit reports** — Update the ~25 audit files at root and in `audits/` directory
19. **Frontend audit docs** — Update the ~30 files across design-studio-audit, profile-audit-v2, audit-auth-security
20. **Plan Maestro** — Update the 10 plan-maestro files
21. **Audit 360** — Update the 9 audit-360 files
22. **Production audit** — Update the 7 production-audit files

### Safe to Keep As-Is (Historical/Archive)

- `frontend/docs/printful-migration/` — 26 files. These are migration documentation and SHOULD reference Printify as the source system
- `CHANGELOG.md` — Historical entries are accurate for when they were written
- `MARKET_RESEARCH_SUMMARY.md` — Competitor comparison
- `podclaw/reports/trend_report_2026-02-15.md` — Market research citing Printify as external source
- `podclaw/context/RESEARCH_SOURCES.md` — External Printify blog URLs as research sources
- `podclaw/context/archive/` — 4 archived context files
- `.claude/data/product-plans/` — Completed historical plans
- `frontend/scripts/phase1-backup*.json` — Raw data backups from Printify era
- Session data files (`.claude/data/sessions/`)

### Safe to Archive or Delete

- `frontend/docs/printify-mockups.md` — Printify-specific, superseded by Printful
- `frontend/docs/printify-branding-gift-message.md` — Printify-specific
- `frontend/docs/printify-aop-products.md` — Printify-specific
- `frontend/docs/printify-neck-labels.md` — Printify-specific
- `frontend/docs/printify-packaging-inserts.md` — Printify-specific
- `frontend/docs/printify-placeholders-audit.md` — Printify-specific
- `frontend/docs/PRINTIFY-RESEARCH-ANALYSIS.md` — Printify-specific
- `frontend/printify_catalog.md` — Printify catalog dump
- `docs/audit-360/12-printify-integration.md` — Pre-migration audit
- `docs/plan-maestro/13-printify-integration.md` — Pre-migration plan
- `test_stock_sourced_products.md` — One-off task file

---

## Summary Statistics

| Category | Files | Occurrences | Status |
|----------|-------|-------------|--------|
| CLAUDE.md + Memory | 4 | ~135 | CRITICAL — Actively misleading |
| i18n Messages | 3 | 6 | CRITICAL — User-facing |
| Project Root (README, SETUP, etc.) | 6 | 20 | HIGH — Developer-facing |
| Claude Design Skills | 6 | 24 | HIGH — Agent instructions |
| Printful Skills (cross-refs) | 14 | 16 | MEDIUM — Minor updates |
| Audit Skills | 3 | 11 | MEDIUM |
| PodClaw Core Docs | 6 | 37 | HIGH — Agent-facing |
| PodClaw Agent Skills | 7 | 75 | HIGH — Agent instructions |
| PodClaw Context Files | 9 | 64 | HIGH — Agent context |
| PodClaw Catalog | 10 | 35 | MEDIUM |
| PodClaw Archives/Reports | 5 | 39 | LOW — Historical |
| Frontend Printify Docs | 7 | 152 | LOW — Archive candidates |
| Frontend Migration Docs | 26 | ~1,100 | OK — Historical migration docs |
| Frontend Audit Docs | 17 | ~90 | LOW — Past audits |
| Frontend Root Docs | 7 | 13 | MEDIUM |
| Project Docs (`docs/`) | 39 | ~300 | MEDIUM — Mixed stale/historical |
| Audit Reports | 20 | ~55 | LOW — Past audits |
| JSON Data/Backups | ~40 | ~11,700 | OK — Historical data |
| **TOTAL** | **~230** | **~13,900** | |

**Bottom line**: ~170 documentation files need some form of update, with 4 files (CLAUDE.md, MEMORY.md, and 2 memory topic files) being critically misleading and requiring immediate attention. The 6 i18n message entries are user-facing and should be fixed before any public deployment.
