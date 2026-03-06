# Printful Migration — Documentation Index

**Created:** 2026-03-02
**Purpose:** Reference documentation for migrating from Printify to Printful

---

## Files in This Directory (20 documents, 444KB, 11,478 lines)

### Codebase Audits (verified against real code)
| File | Contents |
|---|---|
| `printify-integration-audit.md` | 6 core libs, 17 methods, 10+ API routes, DB schema, 80+ scripts |
| `current-catalog-audit.md` | 79 products, 1435 variants, 33 blueprints, 5 providers, pricing, GPSR |
| `design-module-audit.md` | 9 components, 8 libs, 8 API routes, 4 DB tables, coupling analysis |
| `chat-interface-audit.md` | 26 AI tools, 12 artifacts, 3 contexts, 0 direct Printify coupling |
| `api-endpoints-map.md` | ~152 API routes, 12 directly coupled, 114 unaffected |

### Printful API Documentation
| File | Contents |
|---|---|
| `printful-api-overview.md` | Base URL, response format, rate limits, pagination, all API sections |
| `printful-authentication.md` | Private Token + OAuth 2.0 flows, scopes, headers |
| `printful-api-types.md` | Private Token vs Public App comparison, env vars, portal |
| `printful-catalog-api.md` | GET /products, GET /products/{id}, GET /products/variant/{id}, size guides |
| `printful-products-api.md` | Sync Products CRUD — create, update, delete products and variants |
| `printful-orders-api.md` | Create, confirm, estimate orders; EU VAT notes; packing slips |
| `printful-webhooks-api.md` | All event types, payload schemas, security, implementation example |
| `printful-mockup-generator-api.md` | Async task flow, printfiles, polling strategy |
| `printful-shipping-api.md` | Shipping rates, tax rates, countries API, EU notes |
| `printful-file-library-api.md` | Upload files, thread colors, file requirements by print type |

### Architecture & Research
| File | Contents |
|---|---|
| `architecture-recommendations.md` | Provider abstraction (ISP), adapter pattern, sync engine, webhook normalization, migration path |
| `design-generator-architecture.md` | Canvas editor architecture, Fabric.js integration, Printful API flow, migration phases |
| `printful-design-personalization-research.md` | EDM (Embedded Design Maker), Mockup Generator API, Public App, Fyul merger |
| `design-personalization-research.md` | Kittl/Graffiti Empire analysis, Konva/Fabric comparison, text effects, UX patterns, roadmap |

---

## Key Differences: Printify → Printful

### API Basics

| | Printify | Printful |
|---|---|---|
| Base URL | `https://api.printify.com/v1` | `https://api.printful.com` |
| Shop in URL | Yes (`/shops/{id}/`) | No — use header or store-scoped token |
| Token expires | Never | YES — must rotate |
| Rate limit | ~120 req/min | 120 req/min (30/min catalog unauthenticated) |
| Response envelope | `{ data: [...] }` | `{ code: 200, result: {...}, paging: {} }` |

### Products

| | Printify | Printful |
|---|---|---|
| Create product | `POST /shops/{id}/products.json` | `POST /sync_products` |
| Publish product | `POST /products/{id}/publish.json` (separate step) | No publish step needed |
| Variant identification | Blueprint ID + Provider ID + variant IDs | Single Catalog Variant ID |
| External ID lookup | Not documented | `@external_id` prefix on all endpoints |

### Orders

| | Printify | Printful |
|---|---|---|
| Create order | `POST /shops/{id}/orders.json` | `POST /orders` |
| Draft flow | No draft concept | Create as draft → `POST /orders/{id}/confirm` |
| Cost estimate | Not available | `POST /orders/estimate` |
| Gift message | `gift_message` field | `gift.message` object |
| Custom packing slip | Dashboard only | `packing_slip` object in request |

### Files

| | Printify | Printful |
|---|---|---|
| Upload method | Base64 JSON body (Cloudflare issues) | Public URL (simple, no encoding) |
| Thread colors | No equivalent | `POST /files/colors` |

### Webhooks

| | Printify | Printful |
|---|---|---|
| Setup | `POST /shops/{id}/webhooks.json` | `POST /webhooks` |
| Signature | HMAC header | No built-in (use secret in URL) |
| Delete specific | `DELETE /webhooks/{id}` | `DELETE /webhooks` (removes all) |

---

## EU Considerations

- Printful EU fulfillment center: **Riga, Latvia**
- No import duties for EU→EU shipments (goods stay within EU)
- Check `availability_status` for `region: "EU"` before using a variant
- `avg_fulfillment_time` + `maxDeliveryDays` = total delivery estimate
- IOSS generally not needed since EU orders fulfilled from within EU
- Include `tax_number` in recipient for B2B EU orders

---

## Quick Start Checklist

- [ ] Create Printful account at printful.com
- [ ] Go to https://developers.printful.com/ and generate a Private Token
- [ ] Set scopes: `orders`, `sync_products`, `file_library`, `webhooks`
- [ ] Add `PRINTFUL_API_TOKEN`, `PRINTFUL_STORE_ID`, `PRINTFUL_API_TOKEN_EXPIRES` to `.env.local`
- [ ] Implement `printful.ts` client (mirroring current `printify.ts`)
- [ ] Set up webhook: `POST /webhooks` with your endpoint URL
- [ ] Add `PRINTFUL_WEBHOOK_SECRET` to `.env.local`
- [ ] Migrate product creation scripts to use `POST /sync_products`
- [ ] Migrate order creation to use `POST /orders`
- [ ] Replace Printify sync cron with Printful sync
- [ ] Validate EU availability with `availability_status` check
