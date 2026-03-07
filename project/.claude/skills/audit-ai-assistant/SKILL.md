---
name: AI Shopping Assistant Audit
description: >
  Comprehensive audit of the SKAPARA AI shopping assistant — conversation quality,
  RAG retrieval, session memory, usage metering, tool execution, streaming UX,
  cost optimization, and security. Use when asked to audit the AI assistant, chatbot,
  conversation system, RAG pipeline, AI usage limits, or chat UX.
---

# AI Shopping Assistant Audit Skill

## Overview

The SKAPARA AI Shopping Assistant is a Gemini 2.5-flash powered conversational commerce agent with 28 tools, Vercel AI SDK 6 streaming, RAG (pgvector hybrid search), tier-based usage metering, anomaly detection, content safety, and conversation persistence. This skill defines a structured 8-phase audit workflow to evaluate every layer against industry best practices and surface actionable findings.

## Architecture Reference

| Layer | File | Lines | Description |
|---|---|---|---|
| Chat API | `frontend/src/app/api/chat/route.ts` | 2520 | 28 tools, system prompt, streaming, persistence |
| Chat UI | `frontend/src/components/storefront/ChatArea.tsx` | 830+ | useChat hook, message rendering, artifacts |
| Conversations API | `frontend/src/app/api/conversations/route.ts` | 57 | List user conversations with message counts |
| RAG Search | `frontend/src/app/api/rag/search/route.ts` | 227 | Hybrid vector + keyword search, Redis cache |
| RAG Index | `frontend/src/app/api/rag/index/route.ts` | -- | Document indexing pipeline |
| RAG Add Docs | `frontend/src/app/api/rag/add-documents/route.ts` | -- | Batch document ingestion |
| Usage Limiter | `frontend/src/lib/usage-limiter.ts` | 417 | Tier-based limits, Supabase RPC atomic ops |
| Rate Limiter | `frontend/src/lib/rate-limit.ts` | 129 | In-memory burst protection per instance |
| Anomaly Monitor | `frontend/src/lib/anomaly-monitor.ts` | 150 | Velocity block, rate-limit hit tracking |
| Content Safety | `frontend/src/lib/content-safety.ts` | 86 | Blocked terms filter (trademarks, NSFW, hate) |
| Artifact Registry | `frontend/src/components/artifacts/registry.tsx` | 80+ | 12 artifact types mapped to tool outputs |
| Transport | ChatArea.tsx:151-198 | -- | DefaultChatTransport with CSRF + conversation ID |
| DB Tables | `conversations`, `messages`, `user_usage`, `documents` | -- | RLS-protected persistence |

## Audit Workflow

Execute phases sequentially. Each phase produces findings in the standardized format (see Output Format below). Skip phases only if explicitly told to narrow scope.

---

### Phase 1: Conversation Quality & Flow

**Goal**: Evaluate how well the assistant guides users from intent to conversion.

#### 1.1 System Prompt Analysis

- **File**: `chat/route.ts:401-528`
- Read the full system prompt. Check for:
  - [ ] Clear persona definition (name, role, store context)
  - [ ] Locale-aware instructions (`route.ts:390-395` — en/es/de)
  - [ ] Tool routing instructions with numbered examples (`route.ts:432-507`)
  - [ ] Proactive no-results handling (`route.ts:514-520`)
  - [ ] Premium upsell awareness (`route.ts:522-527`)
  - [ ] Missing: proactive greeting strategy (industry benchmark: 45% higher engagement)
  - [ ] Missing: checkout hesitation detection cues
  - [ ] Missing: cart abandonment recovery prompts
  - [ ] Missing: cross-sell / upsell triggers after add-to-cart
  - [ ] Missing: sentiment detection instructions

**Industry Benchmarks**:
| Metric | Target | How to Measure |
|---|---|---|
| First recommendation | < 2 exchanges | Count messages before first product_search call |
| Conversion rate (chat-assisted) | > 8% | Track create_checkout calls / total conversations |
| Cart abandonment recovery | > 15% recovery | Track add_to_cart without confirm_checkout |
| Avg messages per session | 6-12 | Query messages table grouped by conversation_id |
| Fallback rate | < 10% | Count responses with no tool call and generic text |

#### 1.2 Tool Routing Accuracy

- **File**: `chat/route.ts:432-507` (WHEN TO USE EACH TOOL)
- Verify:
  - [ ] All 28 tools have routing instructions
  - [ ] No overlapping triggers between product_search and browse_catalog
  - [ ] Design tools have intent classification (`route.ts:451-459`)
  - [ ] Privacy classification for personal designs (`route.ts:461-464`)
  - [ ] Approval-required tools clearly marked (create_checkout, confirm_checkout, request_return, apply_design_to_product)

#### 1.3 Fallback & Error Handling

- **File**: `chat/route.ts:567-578` (product_search fallback), `route.ts:651-665` (browse_catalog fallback)
- Check:
  - [ ] Zero-results fallback provides suggestions + categories
  - [ ] Tool execution errors return structured error objects (not thrown exceptions)
  - [ ] `getSearchFallback()` (`route.ts:71-94`) returns top-rated + category counts
  - [ ] FAQs loaded via CAG pattern (`route.ts:101-162`) with 200K token guard

#### 1.4 Conversation Title Generation

- **File**: `chat/route.ts:2464-2469`
- Check:
  - [ ] Title set from first assistant response (first 100 chars)
  - [ ] Truncation at 100 chars — may cut mid-word (potential improvement)
  - [ ] No summarization model used — title is raw text prefix

---

### Phase 2: RAG & Product Retrieval

**Goal**: Evaluate retrieval accuracy, latency, and freshness.

#### 2.1 Hybrid Search Pipeline

- **File**: `rag/search/route.ts:105-117`
- Check:
  - [ ] Hybrid search weights: 70% vector + 30% keyword (`hybrid_search_documents` RPC)
  - [ ] Embedding model: `gemini-embedding-001` at 768 dimensions (`route.ts:66-79`)
  - [ ] Similarity threshold: 0.65 (`route.ts:154`)
  - [ ] Low-relevance flag set when no results above threshold (`route.ts:173-176`)
  - [ ] Fallback to direct query when RPC unavailable (`route.ts:122-151`)

#### 2.2 Caching

- **File**: `rag/search/route.ts:40-53`, `route.ts:178-195`
- Check:
  - [ ] Cache key: SHA-256 hash of normalized query + limit + locale (`route.ts:13-18`)
  - [ ] Cache TTL: 3600 seconds (1 hour) (`route.ts:189`)
  - [ ] Cache hit logged with response time (`route.ts:46`)
  - [ ] Cache miss logged with key (`route.ts:55`)
  - [ ] Only non-empty results cached (`route.ts:180`)

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Query latency (cached) | < 50ms | Measure via responseTime field |
| Query latency (uncached) | < 200ms | Measure via responseTime field |
| Cache hit rate | > 60% | Monitor cache HIT vs MISS logs |
| Similarity threshold | 0.60-0.70 | Currently 0.65 |
| Embedding dimension | 768+ | 768 (Gemini) |
| Re-ranking | Yes | Not implemented (hybrid weights only) |

#### 2.3 RAG Integration in Chat

- **File**: `chat/route.ts:2374-2430`
- Check:
  - [ ] RAG search called with last user message (`route.ts:2379-2389`)
  - [ ] Top 3 results injected into system prompt (`route.ts:2405, 2415-2422`)
  - [ ] RAG failure is non-blocking (`route.ts:2427-2430`)
  - [ ] Auth cookies forwarded to RAG endpoint (`route.ts:2400`)
  - [ ] Missing: RAG is called on EVERY message — no intent filter to skip for greetings/cart ops
  - [ ] Missing: no re-ranking step after retrieval

#### 2.4 Document Freshness

- Check:
  - [ ] Product sync frequency (how often documents table updated)
  - [ ] Stale document detection (products deleted but documents remain)
  - [ ] Locale-filtered search available (`route.ts:115-116`)

---

### Phase 3: Session Memory & Persistence

**Goal**: Evaluate context retention, session lifecycle, and cross-session continuity.

#### 3.1 Working Memory (Context Window)

- **File**: `chat/route.ts:28, 339-341`
- Check:
  - [ ] Sliding window: MAX_CONTEXT_MESSAGES = 40 (`route.ts:28`)
  - [ ] Window preserves first message (system context) + last 39 (`route.ts:340`)
  - [ ] Missing: no summarization for conversations exceeding window
  - [ ] Missing: no priority retention (tool results may be dropped before user preferences)

#### 3.2 Session Persistence (Client-Side)

- **File**: `ChatArea.tsx:50-69` (serialization), `ChatArea.tsx:71-106` (TTL + restore)
- Check:
  - [ ] Messages serialized to sessionStorage (`ChatArea.tsx:316-326`)
  - [ ] TTL: 3 hours for anonymous users (`ChatArea.tsx:71`)
  - [ ] Expiry checked on mount, tab focus, visibility change, 10min interval (`ChatArea.tsx:280-308`)
  - [ ] Conversation ID persisted in sessionStorage (`ChatArea.tsx:140-142, 170-171`)
  - [ ] Tool parts serialized: only text + output-available tool results (`ChatArea.tsx:55`)
  - [ ] Missing: authenticated user sessions have no TTL (persist until tab close)

#### 3.3 Conversation Persistence (Server-Side)

- **File**: `chat/route.ts:344-387`
- Check:
  - [ ] Conversation upsert is fire-and-forget (`route.ts:349-362`)
  - [ ] User message saved fire-and-forget (`route.ts:364-387`)
  - [ ] Assistant message saved in onFinish callback (`route.ts:2448-2472`)
  - [ ] Write client uses user JWT for authenticated, service key for anonymous (`route.ts:207-215`)
  - [ ] Missing: no retry on persistence failure
  - [ ] Missing: no conversation list/history loading in chat UI (conversations API exists but unused in ChatArea)
  - [ ] Missing: no cross-session memory retrieval (user cannot reference old conversations)

#### 3.4 Conversation ID Tracking

- **File**: `ChatArea.tsx:140-142, 151-172`, `chat/route.ts:344, 2498-2501`
- Check:
  - [ ] Conversation ID sent via `x-conversation-id` header (`ChatArea.tsx:161-163`)
  - [ ] Server returns conversation ID in response header (`route.ts:2500`)
  - [ ] New ID generated if none provided (`route.ts:344`)

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Context retention | Full session | 40-message sliding window |
| Long conversation handling | Summarization | Truncation only |
| Cross-session memory | Last 3 conversations | Not implemented |
| Session restore time | < 200ms | sessionStorage (sync, fast) |
| Persistence reliability | > 99.5% | Fire-and-forget (no retry) |

---

### Phase 4: Tool Execution & Reliability

**Goal**: Evaluate tool schema validation, error handling, execution patterns, and approval workflows.

#### 4.1 Tool Schema Validation

- **File**: `chat/route.ts:530-2372` (all tool definitions)
- Check:
  - [ ] All tools use Zod schema validation
  - [ ] @ts-expect-error workaround for AI SDK 6 type mismatch (`route.ts:539, 606, etc.`)
  - [ ] Optional parameters have `.optional()` and `.describe()`
  - [ ] product_search uses `sanitizeForPostgrest()` (`route.ts:553`)
  - [ ] get_product_detail uses `sanitizeForLike()` (`route.ts:715`)

#### 4.2 Approval Workflow

- Tools requiring approval:
  - [ ] `create_checkout` — shows cart summary, waits for user approval
  - [ ] `confirm_checkout` — creates Stripe session after approval
  - [ ] `request_return` — return/refund request needs approval
  - [ ] `apply_design_to_product` — `needsApproval: true` (`route.ts:2302`)
- **File**: `ChatArea.tsx:205` — `addToolApprovalResponse` from useChat
- Check:
  - [ ] Approval UI renders via `ApprovalCardArtifact` and `ReturnRequestArtifact`
  - [ ] User can approve/reject inline in chat

#### 4.3 Error Recovery

- Check across all tool execute functions:
  - [ ] Each tool has try/catch returning `{ success: false, error: string }`
  - [ ] No uncaught exceptions that would crash the stream
  - [ ] Database errors logged with console.error
  - [ ] Missing: no automatic retry on transient DB errors
  - [ ] Missing: no circuit breaker for repeated tool failures

#### 4.4 Tool Step Limits

- **File**: `chat/route.ts:2447`
- Check:
  - [ ] Step limit: 3 for free/anon, 5 for premium (`stepCountIs`)
  - [ ] Ensures tool loops terminate (prevents infinite agent loops)
  - [ ] Missing: no per-tool timeout (relies on global maxDuration = 60s at `route.ts:16`)

#### 4.5 Artifact Rendering

- **File**: `frontend/src/components/artifacts/registry.tsx:29-80+`
- Check:
  - [ ] 12 artifact types registered: ProductGrid, ProductDetail, ComparisonTable, SizeGuide, CartSummary, PricingTable, ApprovalCard, OrderTimeline, OrderList, ReturnRequest, DesignPreview
  - [ ] Each has Component + Skeleton (loading state)
  - [ ] Missing artifacts for: add_to_cart result, apply_coupon result, switch_language result

---

### Phase 5: Usage Metering & Rate Limiting

**Goal**: Evaluate quota enforcement accuracy, atomicity, and tier fairness.

#### 5.1 Tier Definitions

- **File**: `usage-limiter.ts:25-59`
- Verify tier limits match business requirements:

| Action | Anonymous | Free | Premium |
|---|---|---|---|
| chat (conversations/day) | 5 | 30 | 100 |
| chat:messages (messages/day) | 20 | 200 | unlimited (-1) |
| chat:tokens (tokens/day) | 50K | 500K | 2M |
| design:generate (designs/month) | 0 | 5 | 50 |
| design:ai-generate (AI designs/month) | 0 | 5 | 50 |

- Check:
  - [ ] Premium messages unlimited (`-1` at `route.ts:50`)
  - [ ] Anonymous blocked from all design actions (limit = 0)
  - [ ] Period types correct (daily for chat, monthly for designs)

#### 5.2 Atomic Enforcement

- **File**: `usage-limiter.ts:111-133` (supabaseIncrement), `usage-limiter.ts:217-298` (checkAndIncrementUsage)
- Check:
  - [ ] Atomic check+increment via Supabase RPC `increment_usage` (`route.ts:118`)
  - [ ] Fail-CLOSED: Supabase failure = deny request (`route.ts:284-298`)
  - [ ] Admin alert fired on Supabase failure (`route.ts:288-296`)
  - [ ] Token increment via separate `increment_usage_by` RPC (`route.ts:138-162`)
  - [ ] Premium credit overflow: `consume_credit_atomic` RPC (`route.ts:188-204`)
  - [ ] Decrement on rollback is best-effort (`route.ts:335-353`)

#### 5.3 Identifier Resolution

- **File**: `usage-limiter.ts:77-87`
- Check:
  - [ ] UUID user IDs pass through unchanged
  - [ ] Fingerprints (`fp:`) pass through unchanged
  - [ ] IPs hashed with daily salt for GDPR compliance (`SHA-256(ip:daySalt)`)
  - [ ] Missing: fingerprint rotation attack (same user, new fingerprint each time)

#### 5.4 Burst Rate Limiting

- **File**: `rate-limit.ts:17-56` (RateLimiter class), `rate-limit.ts:62-63` (chat limiters)
- Check:
  - [ ] In-memory per-instance (acceptable for Vercel, not shared across instances)
  - [ ] Chat: 20 msg/min with fingerprint, 5 msg/min without (`rate-limit.ts:62-63`)
  - [ ] E2E test bypass: `PLAYWRIGHT_TEST_BASE_URL` or `CI` env (`rate-limit.ts:29`)
  - [ ] Probabilistic cleanup (1% chance per check at `rate-limit.ts:36`)
  - [ ] Concurrent slot limiter: max 2 streaming requests per identifier (`rate-limit.ts:112-128`)

#### 5.5 Anomaly Detection

- **File**: `anomaly-monitor.ts`
- Check:
  - [ ] High usage warning at 80% of limit (`anomaly-monitor.ts:64`)
  - [ ] Auto-block after 5+ rate-limit hits in 5 min (`anomaly-monitor.ts:87-89`)
  - [ ] Velocity block: 5+ messages in <3 seconds (`anomaly-monitor.ts:113-148`)
  - [ ] Block duration: 30 minutes (`anomaly-monitor.ts:16`)
  - [ ] All in-memory (resets on deploy/restart)
  - [ ] Missing: no persistent block storage (attacker waits for deploy)
  - [ ] Missing: no alerting channel (console.warn only)

#### 5.6 Usage Headers

- **File**: `usage-limiter.ts:410-416`, `chat/route.ts:272`
- Check:
  - [ ] X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers set
  - [ ] Headers returned on 429 responses

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Enforcement model | Fail-closed | Fail-closed (correct) |
| Quota accuracy | 100% atomic | Supabase RPC atomic (correct) |
| Block persistence | Survive deploys | In-memory only (gap) |
| Identifier evasion resistance | Fingerprint + IP | Fingerprint OR IP (gap) |
| Usage dashboard | Customer-visible | Not implemented |
| Grace period at limit | Soft warning at 80% | Warning logged, not shown to user |

---

### Phase 6: Chat UX & Accessibility

**Goal**: Evaluate message rendering, interaction patterns, mobile UX, and accessibility.

#### 6.1 Message Rendering

- **File**: `ChatArea.tsx:463-end` (JSX rendering)
- Check:
  - [ ] Text rendered via `SafeMarkdown` component (`ChatArea.tsx:26`)
  - [ ] Tool results rendered via artifact registry (`ChatArea.tsx:27`)
  - [ ] Loading skeletons shown during tool execution
  - [ ] Auto-scroll to bottom on new messages (`ChatArea.tsx:311-313`)
  - [ ] Missing: message chunking for long responses (industry best practice)

#### 6.2 Welcome Screen

- **File**: `ChatArea.tsx:471-478+`
- Check:
  - [ ] Shown when messages.length === 0
  - [ ] Brand mark + personalized greeting (user name if available)
  - [ ] Quick-reply prompt buttons available
  - [ ] Missing: proactive greeting with user context (active orders, recent favorites)

#### 6.3 Input Area

- **File**: `ChatArea.tsx:336-366`
- Check:
  - [ ] Enter key sends message (`ChatArea.tsx:337-341`)
  - [ ] Image upload via file input + drag-and-drop (`ChatArea.tsx:387-461`)
  - [ ] Image validation: type check + 5MB limit (`ChatArea.tsx:392-401`)
  - [ ] Voice input via `useSpeechToText` hook (`ChatArea.tsx:214-232`)
  - [ ] Limit-reached state disables input (`ChatArea.tsx:137`)
  - [ ] Missing: typing indicator ("SKAPARA is thinking...")
  - [ ] Missing: message editing/retry

#### 6.4 Engagement Modals

- **File**: `ChatArea.tsx:134-137, 174-195`
- Check:
  - [ ] AuthWallModal shown when anonymous user hits limit (`ChatArea.tsx:182`)
  - [ ] UpgradeModal shown when free user hits limit (`ChatArea.tsx:184`)
  - [ ] 429 responses intercepted and converted to engagement flow (`ChatArea.tsx:175-195`)
  - [ ] Fake empty SSE stream returned to prevent raw error display (`ChatArea.tsx:187-190`)

#### 6.5 Mobile UX

- Check:
  - [ ] Responsive padding: `px-3 py-4 sm:px-4 md:px-6 md:py-6` (`ChatArea.tsx:470`)
  - [ ] Touch targets for buttons >= 44px
  - [ ] Product cards in artifacts are mobile-responsive
  - [ ] Voice input button accessible on mobile
  - [ ] Missing: haptic feedback on send

#### 6.6 Accessibility

- Check:
  - [ ] ARIA labels on input field, send button, voice button, attach button
  - [ ] Screen reader announcements for new messages
  - [ ] Keyboard navigation through quick-reply buttons
  - [ ] Color contrast for message bubbles (semantic tokens)
  - [ ] Focus management after tool approval/rejection

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Time to first response | < 1.5s | Streaming (good), no measurement |
| Product card render | Image + price + rating | Via artifacts (good) |
| Quick-reply buttons | 3-5 contextual options | Static prompts on welcome only |
| Brand voice consistency | 100% on-brand | System prompt only, no validation |
| Mobile touch targets | >= 44px | Needs verification |
| Approval workflow clarity | 1-click approve/reject | Via artifact cards (good) |

---

### Phase 7: Cost & Performance Optimization

**Goal**: Evaluate token costs, model selection, caching strategy, and latency.

#### 7.1 Model Configuration

- **File**: `chat/route.ts:46-48, 2442`
- Check:
  - [ ] Model: `gemini-2.5-flash` (cost-optimized)
  - [ ] API key: `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` fallback
  - [ ] Missing: no context caching for system prompt (Gemini supports cached context)
  - [ ] Missing: no model fallback on 429/5xx from Gemini

#### 7.2 Token Budget

- **File**: `chat/route.ts:18-23, 2446`
- Check:
  - [ ] Per-response output caps: anon=2048, free=4096, premium=8192 (`route.ts:19-23`)
  - [ ] Daily token budgets enforced via `checkTokenBudget` (`route.ts:300-310`)
  - [ ] Token tracking in onFinish callback (`route.ts:2474-2493`)
  - [ ] Cost alert threshold: $0.05 per response (`route.ts:2483`)
  - [ ] Gemini Flash pricing used: $0.30/M input, $1.25/M output (`route.ts:2482`)

#### 7.3 Input Cost Control

- **File**: `chat/route.ts:26-28, 339-341`
- Check:
  - [ ] MAX_MESSAGE_CHARS = 4000 (`route.ts:26`)
  - [ ] MAX_CONTEXT_MESSAGES = 40 sliding window (`route.ts:28`)
  - [ ] System prompt size: ~3K tokens (measured from route.ts:401-528)
  - [ ] FAQ context loaded conditionally with 200K token guard (`route.ts:102-103`)
  - [ ] RAG context adds ~200-500 tokens per query (`route.ts:2415-2422`)
  - [ ] Missing: input token counting before sending to model

#### 7.4 RAG Call Optimization

- **File**: `chat/route.ts:2374-2430`
- Check:
  - [ ] RAG called on every message (even greetings, cart ops, confirmations)
  - [ ] RAG adds latency: embedding generation + vector search + network round-trip
  - [ ] Recommendation: skip RAG for non-product queries (cart, checkout, order, language, design operations)
  - [ ] Redis cache mitigates repeated queries (`rag/search/route.ts:44-53`)

#### 7.5 Streaming Performance

- **File**: `chat/route.ts:2441-2502`
- Check:
  - [ ] `streamText` with SSE (`toUIMessageStreamResponse`)
  - [ ] maxDuration = 60s at route level (`route.ts:16`)
  - [ ] Concurrent slot limit prevents resource exhaustion (`route.ts:253-258`)
  - [ ] Slot released in finally block (`route.ts:2503-2506`)

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Cost per conversation | < $0.02 | ~$0.005-0.02 (Flash pricing, good) |
| Cost alert threshold | > $0.05/response | $0.05 (correct) |
| System prompt caching | Reduce 50% input cost | Not implemented |
| Unnecessary RAG calls | 0% | ~40% (cart/order/design ops) |
| Time to first token | < 500ms | Not measured |
| End-to-end latency | < 3s for simple queries | Not measured |

---

### Phase 8: Security & Safety

**Goal**: Evaluate input validation, injection prevention, content safety, auth boundaries, and data protection.

#### 8.1 Input Validation

- **File**: `chat/route.ts:315-336`
- Check:
  - [ ] Message array required (`route.ts:315-320`)
  - [ ] Last message length validated: max 4000 chars (`route.ts:322-336`)
  - [ ] Text extracted from both string content and parts array (`route.ts:325-329`)
  - [ ] Missing: no validation of message role (user could send role=system)
  - [ ] Missing: no validation of parts types (could send arbitrary part types)

#### 8.2 SQL Injection Prevention

- **File**: `chat/route.ts:14, 553, 715`
- Check:
  - [ ] `sanitizeForPostgrest()` used in product_search (`route.ts:553-554`)
  - [ ] `sanitizeForLike()` used in get_product_detail name search (`route.ts:715`)
  - [ ] Import from `@/lib/query-sanitizer` (`route.ts:14`)
  - [ ] Other tools using `.eq()` or `.in()` (parameterized, safe)

#### 8.3 Content Safety

- **File**: `content-safety.ts`
- Check:
  - [ ] `checkPromptSafety()` filters design prompts before generation
  - [ ] 45 blocked terms across 6 categories: Trademark, NSFW, Hate, Violence, Illegal (`content-safety.ts:8-45`)
  - [ ] Word-boundary regex matching (`content-safety.ts:74`)
  - [ ] Input normalized: lowercase, special chars removed (`content-safety.ts:51-57`)
  - [ ] Missing: no content safety check on chat messages (only design prompts)
  - [ ] Missing: no output safety check on model responses
  - [ ] Missing: no image content moderation for uploaded images
  - [ ] Missing: prompt injection detection (user could instruct model to ignore system prompt)

#### 8.4 Authentication & Authorization

- **File**: `chat/route.ts:175-231, 204-231`
- Check:
  - [ ] User resolved from `sb-access-token` cookie (`route.ts:197, 210-211`)
  - [ ] Tier resolved from users table with subscription validation (`route.ts:216-230`)
  - [ ] Expired premium treated as free (`route.ts:223-229`)
  - [ ] User-scoped write client for authenticated users (`route.ts:215`)
  - [ ] Anonymous sessions use service key for writes (`route.ts:209`)
  - [ ] Conversations API requires auth (`conversations/route.ts:11`)
  - [ ] RAG search requires auth (`rag/search/route.ts:29`)

#### 8.5 CSRF Protection

- **File**: `ChatArea.tsx:155-158`
- Check:
  - [ ] CSRF token read from cookie (`ChatArea.tsx:155`)
  - [ ] Token sent via `x-csrf-token` header (`ChatArea.tsx:157`)
  - [ ] Missing: CSRF token rotation strategy

#### 8.6 Rate Limit Evasion

- Check:
  - [ ] IP-based rate limiting can be bypassed with VPN/proxy rotation
  - [ ] Fingerprint-based limiting can be bypassed with browser fingerprint spoofing
  - [ ] In-memory anomaly blocks reset on deploy (`anomaly-monitor.ts` — all Maps)
  - [ ] No persistent block list (Redis or DB-backed)
  - [ ] E2E test bypass in production code (`rate-limit.ts:29` — check env var security)

#### 8.7 Data Exposure

- Check:
  - [ ] Service key used for admin reads in chat route (`route.ts:52-55`) — bypasses RLS
  - [ ] Conversation writes use user-scoped client (correct, `route.ts:215`)
  - [ ] Product data exposed: id, title, description, price, images, rating (safe)
  - [ ] User profile data: only tier + subscription status read (`route.ts:217-221`)
  - [ ] Token counts logged with truncated identifier (`anomaly-monitor.ts:44`)

**Industry Benchmarks**:
| Metric | Target | Current |
|---|---|---|
| Prompt injection resistance | Model-level + input filter | No filter (gap) |
| Output content moderation | Automated check | Not implemented (gap) |
| Image upload moderation | Automated NSFW check | Not implemented (gap) |
| SQL injection prevention | Parameterized + sanitized | Sanitized (good) |
| Auth boundary enforcement | RLS + JWT scoping | Hybrid (mostly good) |
| GDPR compliance (identifiers) | Hashed/anonymized | IP hashed with daily salt (good) |
| Rate limit persistence | Survive restarts | In-memory only (gap) |

---

## Output Format

Generate a structured Markdown report with the following sections:

### 1. Executive Summary

3-5 sentences summarizing overall health, top strengths, and critical gaps.

### 2. Scorecard

| Phase | Score (1-10) | Critical Issues | Notes |
|---|---|---|---|
| 1. Conversation Quality | X | N | ... |
| 2. RAG & Retrieval | X | N | ... |
| 3. Session Memory | X | N | ... |
| 4. Tool Execution | X | N | ... |
| 5. Usage Metering | X | N | ... |
| 6. Chat UX | X | N | ... |
| 7. Cost & Performance | X | N | ... |
| 8. Security & Safety | X | N | ... |
| **Overall** | **X/10** | **N** | |

### 3. Findings Table

| ID | Finding | Severity | Phase | File:Line | Recommendation |
|---|---|---|---|---|---|
| F-001 | ... | Critical/High/Medium/Low | 1-8 | path:line | ... |

Severity definitions:
- **Critical**: Security vulnerability, data loss risk, or compliance violation
- **High**: Significant UX degradation, revenue impact, or reliability gap
- **Medium**: Suboptimal behavior that should be addressed in next sprint
- **Low**: Nice-to-have improvement, polish item

### 4. Priority Action Items

Top 10 findings ranked by impact, with effort estimate (S/M/L) and suggested implementation approach.

### 5. Metrics Dashboard Proposal

Recommended observability metrics to track ongoing health:

| Metric | Source | Alert Threshold |
|---|---|---|
| Chat API p95 latency | Vercel analytics | > 3s |
| RAG cache hit rate | Redis logs | < 50% |
| Tool execution error rate | console.error logs | > 5% |
| Usage limiter denial rate | Supabase user_usage | > 20% of requests |
| Cost per conversation | onFinish token tracking | > $0.05 |
| Conversation completion rate | conversations + messages | < 40% with 3+ messages |
| Anomaly blocks per day | anomaly-monitor logs | > 50 |

---

## Checklist Before Reporting

- [ ] All 8 phases executed with file:line references verified
- [ ] Every finding has a specific file path and line number
- [ ] Severity levels applied consistently
- [ ] Recommendations are actionable (not just "improve X")
- [ ] Industry benchmarks cited for each phase
- [ ] No assumptions — every claim verified against source code
- [ ] Report saved to `frontend/docs/audit-ai-assistant-YYYY-MM-DD.md`
