# MCP E-Commerce Ecosystem Reference — March 2026

Research date: 2026-03-09

---

## Table of Contents

1. [Major E-Commerce MCP Servers](#1-major-e-commerce-mcp-servers)
2. [Payment & Financial MCP Servers](#2-payment--financial-mcp-servers)
3. [Community E-Commerce MCP Servers](#3-community-e-commerce-mcp-servers)
4. [Competing Protocols: ACP, UCP, SCP](#4-competing-protocols-acp-ucp-scp)
5. [How AI Clients Connect to Remote MCP Servers](#5-how-ai-clients-connect-to-remote-mcp-servers)
6. [Tool Design Best Practices](#6-tool-design-best-practices)
7. [Remote Hosting & Deployment Patterns](#7-remote-hosting--deployment-patterns)
8. [Transport Protocol: Streamable HTTP](#8-transport-protocol-streamable-http)
9. [Gap Analysis: SKAPARA MCP vs Ecosystem](#9-gap-analysis-skapara-mcp-vs-ecosystem)
10. [Recommendations for SKAPARA](#10-recommendations-for-skapara)
11. [Reference Links](#11-reference-links)

---

## 1. Major E-Commerce MCP Servers

### 1.1 Shopify Storefront MCP (Official)

**Status**: Production, built-in to all Shopify stores since Summer 2025 Edition.

**Endpoint**: `https://{shop}.myshopify.com/api/mcp`

**Auth**: No authentication required for storefront operations (public catalog, cart).

**Transport**: JSON-RPC 2.0 over HTTP POST with `Content-Type: application/json`.

**Tools (4 total)**:

| Tool | Type | Description |
|------|------|-------------|
| `search_shop_catalog` | Read | Search products by natural language query + context. Returns name, price, currency, variant ID, product/image URLs, description |
| `search_shop_policies_and_faqs` | Read | Answer questions about store policies, shipping, returns |
| `get_cart` | Read | Retrieve current cart contents + checkout URL by cart_id |
| `update_cart` | Write | Add/remove/update items in cart. Creates new cart if no cart_id provided. Set quantity=0 to remove |

**Key design decisions**:
- Extremely minimal tool set (only 4 tools for entire storefront)
- `update_cart` handles create, add, remove, and update -- single tool for all cart mutations
- No checkout tool -- returns a checkout URL instead, letting the user complete in browser
- No auth needed for browsing/cart -- auth only for customer account operations (separate server)
- `search_shop_catalog` takes a `context` parameter for disambiguation (e.g., "looking for a gift for my sister")

**Separate server**: Shopify Customer Accounts MCP Server handles authenticated operations (order tracking, returns, account info).

**Innovation -- MCP UI (Aug 2025)**: Shopify published a protocol extension that lets MCP servers include embeddable UI modules (product carousels, detail cards) in responses, rendered inside AI chat interfaces.

### 1.2 commercetools Commerce MCP (Official)

**Status**: Production, launched mid-2025.

**Architecture**: Three separate MCP servers for different use cases:
- **Essentials MCP**: Pre-built tools for commerce operations
- **Developer MCP**: API schemas + documentation for code generation
- **Commerce MCP**: Unified access layer

**Tools (40+ categories, read/create/update per category)**:

| Category | Operations |
|----------|-----------|
| Products | `products.read`, `products.create`, `products.update` |
| Product Search | `product-search.read` |
| Product Discounts | `product-discount.read/create/update` |
| Cart | `cart.read`, `cart.create`, `cart.update` |
| Cart Discounts | `cart-discount.read/create/update` |
| Orders | `order.read`, `order.create`, `order.update` |
| Customers | `customer.read/create/update` |
| Customer Groups | `customer-group.read/create/update` |
| Shopping Lists | `shopping-lists.read/create/update` |
| Payments | `payment.read/create/update` |
| Payment Intents | `payment-intents.update` |
| Prices | `standalone-price.read/create/update` |
| Inventory | `inventory.read/create/update` |
| Shipping | `shipping-methods.read/create/update` |
| Discount Codes | `discount-code.read/create/update` |
| Stores | `store.read/create/update` |
| Reviews | `reviews.read/create/update` |
| Subscriptions | `subscriptions.read/create/update` |
| Quotes | `quote.read/create/update` |
| Bulk Operations | `bulk.create/update` |

**Configuration**:
- `--tools=all` loads everything
- `--tools=all.read` for read-only
- `--tools=carts.read,quote.create` for specific tools
- `--isAdmin=true` enables admin-level operations

**Key design decisions**:
- Fine-grained CRUD per domain (contrast with Shopify's 4-tool approach)
- Explicit read/write separation via tool naming
- Admin flag for elevated operations
- Framework agnostic: Works with OpenAI Agent SDK, Vercel AI SDK, LangChain, CrewAI

---

## 2. Payment & Financial MCP Servers

### 2.1 Stripe MCP Server (Official)

**Status**: Production, hosted at `https://mcp.stripe.com`.

**Auth**: OAuth 2.0 (preferred) or restricted API keys via Bearer token.

**Tools (29 total)**:

| Tool | Type | Description |
|------|------|-------------|
| `get_stripe_account_info` | Read | Account details |
| `retrieve_balance` | Read | Current balance |
| `create_coupon` | Write | Create discount coupon |
| `list_coupons` | Read | List all coupons |
| `create_customer` | Write | Create customer record |
| `list_customers` | Read | List customers |
| `list_disputes` | Read | List disputes |
| `update_dispute` | Write | Update dispute |
| `create_invoice` | Write | Create invoice |
| `create_invoice_item` | Write | Add line item to invoice |
| `finalize_invoice` | Write | Finalize invoice for payment |
| `list_invoices` | Read | List invoices |
| `create_payment_link` | Write | Generate payment link |
| `list_payment_intents` | Read | List payment intents |
| `create_price` | Write | Create price object |
| `list_prices` | Read | List prices |
| `create_product` | Write | Create product |
| `list_products` | Read | List products |
| `create_refund` | Write | Process refund |
| `cancel_subscription` | Write | Cancel subscription |
| `list_subscriptions` | Read | List subscriptions |
| `update_subscription` | Write | Modify subscription |
| `search_stripe_resources` | Read | Search across all Stripe objects |
| `fetch_stripe_resources` | Read | Fetch specific resources |
| `search_stripe_documentation` | Read | Search Stripe docs |

**Key design decisions**:
- Uses `verb_noun` naming pattern (e.g., `create_customer`, `list_invoices`)
- Recommends restricted API keys to limit agent capabilities
- Advises enabling "human confirmation of tools" for sensitive operations
- Warns about prompt-injection risks when used alongside other MCP servers
- Hosted remotely -- no local installation required

### 2.2 PayPal MCP Server (Official)

**Status**: Production, first remote MCP server in the industry.

**Tool categories**: Payments, invoices, disputes, shipment tracking, catalog, subscriptions, reporting/insights.

**Key tools**:
- Process payments
- Issue refunds for captured payments
- Update subscriptions
- Track shipments
- Manage invoices
- Dispute management

**Integration**: Works with OpenAI Agent SDK, LangChain, Vercel AI SDK, and direct MCP.

### 2.3 Square MCP Server (Official)

**Status**: Available, Apache 2.0 license.

**Capabilities**: Customer management, payment processing, inventory management via Square Connect API.

### 2.4 Paddle MCP Server (Official)

**Status**: Available, Apache 2.0 license.

**Capabilities**: Products, prices, customers, transactions, subscriptions, custom financial reports via Billing API.

---

## 3. Community E-Commerce MCP Servers

### 3.1 Printify MCP Server (TSavo) -- DIRECTLY RELEVANT

**Status**: Published on npm (`@tsavo/printify-mcp`), MIT license.

**Auth**: Environment variables (`PRINTIFY_API_KEY`, `REPLICATE_API_TOKEN`, `IMGBB_API_KEY`).

**Transport**: stdio (local only, connects to Claude Desktop).

**Tools (15 total)**:

| Tool | Category | Description |
|------|----------|-------------|
| `get-printify-status` | Shop | Verify API connection, show active shop |
| `list-shops` | Shop | List all shops |
| `switch-shop` | Shop | Change active shop context |
| `list-products` | Product | Paginated product list |
| `get-product` | Product | Full product details |
| `create-product` | Product | Create new product |
| `update-product` | Product | Modify product |
| `delete-product` | Product | Remove product |
| `publish-product` | Product | Make product live |
| `list-blueprints` | Catalog | Browse product templates |
| `get-blueprint` | Catalog | Blueprint specifications |
| `list-print-providers` | Catalog | Production partners |
| `get-variants` | Catalog | Size/color/material options |
| `upload-image` | Image | Upload design to Printify |
| `generate-and-upload-image` | Image | AI generate + upload (Replicate Flux) |

**Key observations**:
- Uses kebab-case for tool names (not snake_case)
- Admin-focused (product creation/management), not customer-facing
- Includes AI image generation as a tool
- Includes `documentation` and `prompts` tools for self-guidance

### 3.2 Shopify Community MCP Servers

Multiple community implementations exist:
- **siddhantbajaj/shopify-mcp-server**: GraphQL Admin API integration
- **GeLi2001/shopify-mcp**: Products, customers, orders management
- **themightywolfie/shopify-storefront-mcp-server**: Storefront API access
- **arunlakshmikabilan1982/mcp-server**: Listed on LobeHub

### 3.3 Other E-Commerce MCP Servers

| Server | Author | Focus |
|--------|--------|-------|
| Bitrefill Search & Shop | bitrefill | Crypto payments shopping |
| Magento 2 MCP | community | Magento store data |
| PrestaShop MCP | community | PrestaShop development |
| Vendure MCP | community | Vendure e-commerce automation |
| Etsy MCP | community | Product search & listings |
| ConsignCloud MCP | community | Consignment business |
| Europarcel MCP | europarcel | Shipping & logistics |
| Omnisend MCP | community | Marketing platform |

### 3.4 Shopper Context Protocol (SCP)

**Status**: Open standard with MCP wrapper.

**Purpose**: Provides AI assistants with shopper context (orders, loyalty, preferences) from merchants.

**Key innovation**: Merchant discovery via DNS records (similar to MX records) and well-known URIs.

**Auth**: OAuth 2.0 with PKCE.

**Capabilities**:
- Retrieve order history, loyalty points, active offers, shopping preferences
- Discover SCP endpoints for merchants via DNS
- Store encrypted auth tokens locally

---

## 4. Competing Protocols: ACP, UCP, SCP

The e-commerce agent ecosystem is NOT converging on MCP alone. Three major protocols are emerging:

### 4.1 Agentic Commerce Protocol (ACP) -- OpenAI + Stripe

**Launched**: Late 2025. Open-sourced.

**Purpose**: End-to-end purchase flow within AI agents (specifically ChatGPT).

**Key innovation**: Shared Payment Token (SPT) -- lets agents initiate payment without exposing credentials.

**Live**: U.S. ChatGPT users can buy from Etsy sellers; Shopify merchants (Glossier, SKIMS, Spanx, Vuori) coming soon.

**For merchants**: Enable in ~1 line of code if already using Stripe. Small fee on completed purchases.

**GitHub**: [agentic-commerce-protocol/agentic-commerce-protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)

### 4.2 Universal Commerce Protocol (UCP) -- Google

**Launched**: January 2026 at NRF Retail's Big Show.

**Backers**: Google, Shopify, Etsy, Wayfair, Target, Walmart, Adyen, Amex, Mastercard, Visa, Stripe.

**Purpose**: Open standard for agentic commerce covering discovery, checkout, and payments.

**Relationship to MCP**: UCP integrates with MCP, A2A (Agent-to-Agent), and existing agent frameworks. It's a higher-level protocol that can USE MCP as a transport/tool layer.

**Website**: [ucp.dev](https://ucp.dev/)

### 4.3 Implications for SKAPARA

- MCP is the **tool/integration layer** -- how agents talk to our store
- ACP/UCP are **commerce transaction layers** -- how purchases happen
- Supporting MCP is necessary but may not be sufficient long-term
- The Stripe + ACP integration is the most likely path for our checkout (we already use Stripe)
- Watch for Stripe's ACP SDK becoming available for self-hosted stores

---

## 5. How AI Clients Connect to Remote MCP Servers

### 5.1 ChatGPT (OpenAI)

**Transport**: Streamable HTTP or HTTP/SSE.

**Auth**: OAuth access tokens via `authorization` parameter. Tokens are NOT stored by OpenAI -- must be resent each request.

**Tool discovery flow**:
1. API fetches tools from MCP server (`mcp_list_tools` output item)
2. Tools can be filtered with `allowed_tools` parameter
3. Model calls tools, generating `mcp_call` items

**Tool approval**:
- Default: Requires explicit approval before sharing data with MCP servers (`mcp_approval_request`)
- Can disable per-tool with `require_approval: { "never": { "tool_names": [...] } }`
- Or disable all: `require_approval: "never"`

**Developer Mode**: Required for MCP in regular ChatGPT. Available for Pro, Team, Enterprise, Edu.

**Access**: Settings > Connectors > Advanced > Developer Mode.

**Cannot connect to localhost** -- requires public URL or tunnel (ngrok).

**Security warning**: "Developers must trust any remote MCP server. A malicious server can exfiltrate sensitive data."

### 5.2 Claude (Anthropic)

**Transport**: Streamable HTTP (remote), stdio (local via Claude Desktop).

**Auth**: OAuth 2.0 with PKCE. Claude acts as a public OAuth client.

**Connection**: Settings > Connectors > Add custom connector > Enter MCP server URL.

**OAuth details**:
- Callback URL: `https://claude.ai/api/mcp/auth_callback` (may change to `claude.com`)
- Claude uses Dynamic Client Registration (DCR) or custom client_id/secret
- PKCE required (public client, no pre-shared secrets)

**Plans**: Pro, Max, Team, Enterprise support remote MCP servers.

**Tool permissions**: Users can enable/disable specific tools per connector in settings.

**Known issue (Dec 2025)**: OAuth flow broke after a Claude Desktop update -- custom connectors using OAuth stopped working properly.

### 5.3 Key Requirements for Our MCP Server

To be compatible with both ChatGPT and Claude:
1. **HTTPS required** -- both clients need public HTTPS endpoints
2. **OAuth 2.0 with PKCE** -- Claude requires it; ChatGPT supports it
3. **Streamable HTTP transport** -- both support it (current MCP spec standard)
4. **CORS** -- Must allow origins from `claude.ai` and `chatgpt.com`
5. **DNS/Domain** -- Need a public domain (e.g., `mcp.skapara.com`)
6. **Dynamic Client Registration** -- Recommended for Claude compatibility

---

## 6. Tool Design Best Practices

### 6.1 Naming Conventions

- **snake_case** is the recommended convention for tool names (best for LLM tokenization, especially GPT-4o)
- Tool names: 1-64 characters, case-sensitive
- Server IDs: kebab-case, should contain "mcp"
- Common patterns: `verb_noun` (e.g., `search_products`, `create_customer`, `get_cart`)

### 6.2 Granularity: Fine-Grained vs Coarse

Two approaches observed in the ecosystem:

**Shopify approach (minimal/coarse)**:
- 4 tools for entire storefront
- `update_cart` handles create + add + remove + update
- Simpler for LLMs to reason about
- Best for: Customer-facing agents, shopping assistants

**commercetools approach (fine-grained)**:
- 40+ tool categories with CRUD per category
- Explicit `products.read` vs `products.create`
- Better for: Admin/developer agents, programmatic access

**Stripe approach (balanced)**:
- 29 tools, one per action
- `create_customer`, `list_customers`, `create_refund`
- Clear verb_noun naming
- Best for: Multi-purpose integrations

**Recommendation for SKAPARA**: Use the **Shopify model for customer-facing tools** (few, powerful tools) and the **Stripe model for admin tools** (explicit verb_noun per action).

### 6.3 Tool Descriptions

- Keep descriptions concise (1-2 sentences)
- Put the most important information FIRST (LLMs may not read the full description)
- Include instructions for auth, pagination, filtering in the description
- Avoid "not found" responses -- return relevant alternatives instead (LLMs get confused by negative phrasing)
- Use enums in schemas when possible for constrained inputs

### 6.4 Tool Annotations

The MCP spec supports tool annotations that help clients understand tool behavior:

```
readOnlyHint: true/false    -- Does this tool only read data?
destructiveHint: true/false -- Can this tool delete/modify data irreversibly?
idempotentHint: true/false  -- Is calling this tool multiple times safe?
openWorldHint: true/false   -- Does this tool interact with external systems?
```

### 6.5 Error Handling

- Return structured error responses with `isError: true`
- Include actionable error messages (not just "failed")
- For search tools, return partial results instead of errors when possible
- Never expose internal system details in error messages

---

## 7. Remote Hosting & Deployment Patterns

### 7.1 Cloudflare Workers (Recommended for Edge)

**Advantages**:
- One-click deployment
- Edge execution (no cold starts)
- Built-in OAuth via `workers-oauth-provider` library
- Streamable HTTP transport support
- `workers.dev` subdomain included

**Architecture options**:
1. `createMcpHandler()` -- Stateless, simplest setup
2. `McpAgent` with Durable Objects -- Stateful, per-session state
3. Raw `WebStandardStreamableHTTPServerTransport` -- Full control

**Auth**: Cloudflare Access (identity aggregator) or GitHub OAuth via `OAuthProvider` wrapper.

### 7.2 Docker (Our Current Approach)

**Suitable for**: Self-hosted VPS deployments.

**Pattern**: Docker container with environment variables for secrets, port mapping, reverse proxy (Caddy/nginx) for HTTPS.

**Advantages for SKAPARA**: Already fits our Docker Compose stack, co-located with frontend/redis/caddy.

### 7.3 Serverless (AWS Lambda, Google Cloud Functions)

**Consideration**: Cold starts can be problematic for MCP sessions.

**Not recommended** unless using provisioned concurrency.

### 7.4 Our Deployment Strategy

For SKAPARA, the optimal setup is:
- **MCP server** as a Docker service in our existing Compose stack
- **Caddy** handles HTTPS termination + reverse proxy (`mcp.skapara.com` -> port 8002)
- **Redis** for session storage (already in stack)
- **No Cloudflare Workers needed** -- we already have infrastructure

---

## 8. Transport Protocol: Streamable HTTP

### 8.1 Current Standard

As of MCP spec version 2025-03-26, **Streamable HTTP** is the standard transport for remote servers. SSE (Server-Sent Events) is deprecated.

### 8.2 Key Differences from SSE

| Feature | SSE (deprecated) | Streamable HTTP |
|---------|-------------------|-----------------|
| Endpoints | Separate GET (SSE stream) + POST (messages) | Single endpoint for both |
| Direction | Server-to-client only | Bidirectional |
| Session | Implicit via SSE connection | Explicit via `Mcp-Session-Id` header |
| Resumability | Not supported | Supported |
| Cancellability | Not supported | Supported |
| CORS | Complex | Standard HTTP CORS |
| Auth | Difficult | Standard HTTP auth headers |

### 8.3 Our Implementation Status

Our MCP server (`mcp-server/src/index.ts`) already uses:
- `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`
- Session management via `Mcp-Session-Id` header
- `sessionIdGenerator: () => randomUUID()`
- Transport-per-session pattern with `Map<string, StreamableHTTPServerTransport>`

This is correct and aligned with the current spec. SDK version 1.0.4.

---

## 9. Gap Analysis: SKAPARA MCP vs Ecosystem

### 9.1 What We Have (Current State)

**17 tools** registered:

| Tool | Auth | Type |
|------|------|------|
| `search_products` | Public | Read |
| `get_product_details` | Public | Read |
| `get_product_reviews` | Public | Read |
| `list_categories` | Public | Read |
| `get_store_info` | Public | Read |
| `get_store_policies` | Public | Read |
| `get_cart` | Auth | Read |
| `update_cart` | Auth | Write |
| `create_checkout` | Auth | Write |
| `get_my_profile` | Auth | Read |
| `update_my_profile` | Auth | Write |
| `list_my_orders` | Auth | Read |
| `get_order_status` | Auth | Read |
| `track_shipment` | Auth | Read |
| `list_wishlist` | Auth | Read |
| `add_to_wishlist` | Auth | Write |
| `remove_from_wishlist` | Auth | Write |

**Infrastructure**:
- Streamable HTTP transport (correct)
- OAuth 2.1 with PKCE (correct)
- JWT-based session management
- Redis for rate limiting
- Audit logging
- CORS configured for claude.ai, chatgpt.com, localhost:3000
- Resources: product catalog, store policies
- Prompts: shopping assistant template

### 9.2 What We're Doing Well

1. **Transport**: Already on Streamable HTTP (aligned with spec)
2. **Auth**: OAuth 2.1 with PKCE (required by Claude)
3. **Tool annotations**: Using `readOnlyHint`, `destructiveHint`, `idempotentHint` (ahead of many community servers)
4. **CORS**: Already configured for Claude + ChatGPT origins
5. **Tool count**: 17 tools is reasonable (between Shopify's 4 and Stripe's 29)
6. **Public/auth separation**: Public tools for browsing, auth for personal operations
7. **Audit logging**: More mature than most community MCP servers
8. **Rate limiting**: Redis-based sliding window

### 9.3 Gaps vs Ecosystem Leaders

| Gap | Shopify | Stripe | commercetools | SKAPARA Status |
|-----|---------|--------|---------------|----------------|
| Remote hosting (HTTPS) | Built-in per store | `mcp.stripe.com` | Cloud-hosted | Missing -- localhost only |
| Dynamic Client Registration | N/A (no auth) | Supported | Supported | Not implemented |
| MCP UI (rich responses) | Yes (Aug 2025) | No | No | Not implemented |
| Tool filtering/scopes | N/A | Via restricted keys | `--tools=` flag | Not implemented |
| Search context parameter | `context` field | N/A | N/A | Missing from `search_products` |
| Documentation tool | N/A | `search_stripe_documentation` | Developer MCP | Not implemented |
| Completions/autocomplete | N/A | N/A | N/A | Partially implemented |
| Coupon/discount tools | N/A | `create_coupon`, `list_coupons` | `discount-code.read/create/update` | Missing |

### 9.4 Missing Tools (Compared to Ecosystem)

**High priority** (seen in multiple major MCP servers):
1. `validate_coupon` / `apply_coupon` -- Stripe and commercetools both have coupon tools
2. `search_products` `context` parameter -- Shopify pattern for disambiguation

**Medium priority**:
3. `get_shipping_options` -- Expected by shoppers before checkout
4. `estimate_delivery` -- Related to shipping
5. `search_documentation` -- Self-help tool (Stripe pattern)

**Low priority** (nice to have):
6. `get_product_recommendations` -- Personalized suggestions
7. `get_trending_products` -- Discovery aid
8. `submit_review` -- Post-purchase engagement

---

## 10. Recommendations for SKAPARA

### 10.1 Immediate (Before Production)

1. **Deploy to public HTTPS** -- Add `mcp.skapara.com` subdomain via Caddy reverse proxy. Without HTTPS, neither ChatGPT nor Claude can connect.

2. **Add Dynamic Client Registration (DCR)** -- Required for Claude's OAuth flow. Implement `POST /register` endpoint per OAuth 2.0 DCR spec (RFC 7591).

3. **Add `context` parameter to `search_products`** -- Following Shopify's pattern, let agents provide qualifying context (e.g., "gift for teenager who likes skateboarding").

4. **Add coupon tools** -- `validate_coupon` and `apply_coupon_to_cart` to match ecosystem expectations.

### 10.2 Short-Term (Post-Launch)

5. **Tool scoping** -- Allow clients to request a subset of tools (like commercetools `--tools=` pattern). This reduces latency and token usage.

6. **MCP UI exploration** -- Investigate Shopify's MCP UI protocol for rich product cards in AI chat interfaces.

7. **ACP/Stripe integration** -- When Stripe's Agentic Commerce Protocol becomes available for non-Shopify merchants, integrate for in-agent checkout.

8. **Shipping tools** -- Add `get_shipping_options` and `estimate_delivery_time` tools.

### 10.3 Long-Term

9. **Google UCP compatibility** -- Watch the UCP spec as it matures. Being discoverable by Google's commerce agents could drive traffic.

10. **Shopper Context Protocol (SCP)** -- Consider implementing SCP DNS records for merchant discovery by AI shopping assistants.

11. **Multi-language tool descriptions** -- Our store supports en/es/de; tool descriptions could be localized for international agents.

---

## 11. Reference Links

### Official MCP Servers
- [Shopify Storefront MCP](https://shopify.dev/docs/apps/build/storefront-mcp/servers/storefront)
- [Shopify About Storefront MCP](https://shopify.dev/docs/apps/build/storefront-mcp)
- [Stripe MCP Documentation](https://docs.stripe.com/mcp)
- [commercetools Commerce MCP](https://docs.commercetools.com/sdk/commerce-mcp/overview)
- [commercetools Essentials MCP](https://docs.commercetools.com/sdk/commerce-mcp/essentials-mcp)
- [PayPal MCP Server Blog](https://developer.paypal.com/community/blog/paypal-model-context-protocol/)
- [PayPal Agent Toolkit](https://developer.paypal.com/community/blog/paypal-mcp-agenttoolkit/)

### AI Client MCP Integration
- [ChatGPT MCP & Connectors Guide](https://developers.openai.com/api/docs/guides/tools-connectors-mcp/)
- [ChatGPT MCP Developer Docs](https://developers.openai.com/api/docs/mcp/)
- [Claude Remote MCP Servers](https://modelcontextprotocol.io/docs/develop/connect-remote-servers)
- [Claude Custom Connectors Help](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)

### Competing Commerce Protocols
- [OpenAI Agentic Commerce Protocol (ACP)](https://openai.com/index/buy-it-in-chatgpt/)
- [ACP GitHub Spec](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
- [Stripe ACP Integration](https://docs.stripe.com/agentic-commerce/protocol)
- [Google Universal Commerce Protocol (UCP)](https://ucp.dev/)
- [Shopper Context Protocol (SCP)](https://shoppercontextprotocol.io/)

### MCP Ecosystem & Best Practices
- [MCP Official Server Registry (GitHub)](https://github.com/modelcontextprotocol/servers)
- [E-Commerce MCP Servers Directory (Glama)](https://glama.ai/mcp/servers/categories/ecommerce-and-retail)
- [MCP Naming Conventions](https://zazencodes.com/blog/mcp-server-naming-conventions)
- [5 Best Practices for MCP Servers (Snyk)](https://snyk.io/articles/5-best-practices-for-building-mcp-servers/)
- [MCP Tool Descriptions Best Practices](https://www.merge.dev/blog/mcp-tool-description)
- [MCP Transport: Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports)
- [Why MCP Deprecated SSE](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)

### Deployment & Hosting
- [Cloudflare Workers Remote MCP Server Guide](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Cloudflare MCP with Auth0 & OAuth](https://auth0.com/blog/secure-and-deploy-remote-mcp-servers-with-auth0-and-cloudflare/)
- [Auth0 MCP Server in ChatGPT](https://auth0.com/blog/add-remote-mcp-server-chatgpt/)
- [Remote MCP Server Template with GitHub OAuth](https://github.com/coleam00/remote-mcp-server-with-auth)

### Relevant Community MCP Servers
- [Printify MCP Server (TSavo)](https://github.com/TSavo/printify-mcp) -- Print-on-demand, closest to SKAPARA's domain
- [Shopify MCP UI Engineering Blog](https://shopify.engineering/mcp-ui-breaking-the-text-wall)
- [Shopify Agentic Commerce Platform](https://www.shopify.com/news/ai-commerce-at-scale)

### SKAPARA MCP Server (Our Implementation)
- Server source: `mcp-server/src/index.ts`
- Tools directory: `mcp-server/src/tools/`
- OAuth provider: `mcp-server/src/auth/oauth-provider.ts`
- SDK reference: `mcp-server/CLAUDE.md`
