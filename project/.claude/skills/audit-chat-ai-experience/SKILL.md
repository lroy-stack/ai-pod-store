---
name: Audit Chat AI Experience
description: >
  Comprehensive audit of the SKAPARA generative AI chat interface — the store's core differentiator.
  Use when asked to audit the chatbot, AI experience, chat UI/UX, design generation pipeline,
  product recommendations via chat, or conversational commerce flows. Covers AI context awareness,
  tool usage, streaming, conversation persistence, mobile chat, and the end-to-end design pipeline.
---

# Audit Chat AI Experience

Systematic audit of the SKAPARA AI chat system — from UI to backend pipeline.
The chat is the primary way users discover products, get recommendations, and generate custom designs.

## Prerequisites

- Read `CLAUDE.md` for architecture overview (route groups, design system, Supabase clients)
- Read `frontend/src/app/[locale]/(app)/chat/` for the chat page
- Read `frontend/src/components/chat/` for chat UI components
- Read `frontend/src/app/api/ai/` for all AI API routes
- Read `frontend/src/lib/ai/` for AI utilities, tools, and config

## Workflow

### Phase 1: Chat UI/UX Audit

1. **Chat page structure**:
   - Read `src/app/[locale]/(app)/chat/page.tsx` — what does it render?
   - How is the chat integrated into StorefrontLayout? (sidebar toggle? full page? overlay?)
   - Is there a dedicated chat route or is it embedded in the layout?
   - Check: can users access chat from ANY page or only from `/chat`?

2. **Chat component architecture**:
   - Read all components under `src/components/chat/`
   - Identify: message list, input area, typing indicator, message bubbles
   - Check: are messages rendered with proper styling for user vs assistant?
   - Check: is markdown rendered safely? (XSS via react-markdown, DOMPurify)
   - Check: are code blocks, links, images handled in AI responses?
   - Check: does the input support multiline? file attachments? voice?

3. **Mobile chat experience**:
   - Is the chat UI responsive? Test at 375px base styles
   - Touch targets on send button, action buttons (min 44px)
   - Keyboard handling: does the input stay visible when keyboard opens?
   - Does the message list scroll correctly on mobile?
   - Is there a bottom sheet/drawer pattern for chat on mobile?

4. **Chat entry points & engagement**:
   - How do users discover the chat? (navigation, CTA, landing page?)
   - Is there a welcome message or onboarding flow?
   - Are there suggested prompts or quick actions?
   - Does the chat have a personality/brand voice consistent with SKAPARA?

### Phase 2: AI Backend & Context Audit

5. **Chat API route**:
   - Read `src/app/api/ai/chat/route.ts` (or similar main chat endpoint)
   - What model is used? (Claude, GPT, etc.)
   - How is the system prompt structured? Does it know about SKAPARA products?
   - Is streaming implemented? (SSE, AI SDK streamText, etc.)
   - Error handling: what happens when the AI fails? rate limits? timeouts?
   - Authentication: is the endpoint protected? how are guests handled?

6. **AI tools & capabilities**:
   - List ALL tools available to the AI (the spec mentions 43 tools)
   - Read each tool definition — what can the AI do?
   - Categories to identify:
     - Product search/recommendation tools
     - Design generation tools
     - Cart/order management tools
     - User preference tools
     - Store information tools
   - Check: are tools properly typed? do they have error handling?
   - Check: can the AI access the FULL product catalog including variants, prices, categories?

7. **Product & catalog awareness**:
   - How does the AI access products? (direct Supabase query? API call? embedded context?)
   - Can the AI search by category, price range, style, color?
   - Does the AI know about stock availability?
   - Can it recommend products based on user preferences/history?
   - Check: is the product data fresh or stale? (caching strategy)

8. **Conversation context & memory**:
   - How is conversation history stored? (DB table? localStorage? in-memory?)
   - Read the conversation persistence mechanism
   - Is history scoped per user? (CRITICAL: no cross-user leakage)
   - How many messages are kept in context? Is there a sliding window?
   - Is there long-term memory across sessions? (user preferences, past orders)
   - Check: what happens when context window fills up? truncation strategy?

### Phase 3: Design Generation Pipeline

9. **Design generation flow**:
   - How does a user request a design through chat?
   - What happens step by step? (intent detection → generation → preview → refinement)
   - What API/service generates the designs? (fal.ai, DALL-E, Stable Diffusion?)
   - How are generated images stored? (Supabase storage? temp URL?)
   - Can users iterate on designs? ("make it darker", "add text", "change color")

10. **Design-to-product pipeline**:
    - After a design is generated, how does it become a product?
    - Is there a mockup preview? (on a t-shirt, mug, hat?)
    - Can users select which product to apply the design to?
    - How does the design get to the cart? (create-on-demand? pre-created?)
    - Check: Printful integration for custom products

11. **Design quality & guardrails**:
    - Are there content moderation filters on generated designs?
    - Resolution/quality: are designs print-ready? (300 DPI, correct dimensions)
    - Brand consistency: does the AI follow SKAPARA design guidelines?
    - Error handling: what if generation fails? timeout? NSFW content?

### Phase 4: Streaming & Performance

12. **Streaming implementation**:
    - Is the chat response streamed token-by-token? (AI SDK streamText?)
    - How are tool calls displayed during streaming? (loading states?)
    - Is there a typing indicator during AI processing?
    - What's the time-to-first-token? (check for unnecessary delays)

13. **Performance & reliability**:
    - What happens on network disconnect mid-stream?
    - Is there retry logic for failed AI calls?
    - Are there loading skeletons during initial chat load?
    - Message sending: optimistic UI or wait for server?
    - Check for memory leaks in streaming subscriptions

### Phase 5: Security & Data

14. **Chat security**:
    - Is the chat API rate-limited? (per user, per IP)
    - Can users inject system prompts? (prompt injection attacks)
    - Is user input sanitized before being sent to the AI?
    - Are AI responses sanitized before rendering? (XSS)
    - Check: is the system prompt exposed in client-side code?

15. **Data privacy**:
    - Are chat conversations stored? For how long?
    - Can users delete their chat history? (GDPR)
    - Is PII in chat messages handled properly?
    - Are conversations used for training? (transparency needed)

## Output Format

Write the report to `audit-ecommerce-2026-03-07/07-chat-ai-experience.md` (or the directory specified by the user):

```markdown
# SKAPARA Chat & AI Experience Audit — [DATE]

## Executive Summary
[2-3 sentences: overall AI experience quality, biggest gaps, production readiness]

## Findings

### Phase 1: Chat UI/UX
| # | Finding | Severity | File:Line | Recommendation |
|---|---------|----------|-----------|----------------|
| CHAT-01 | ... | CRITICAL/HIGH/MEDIUM/LOW | path:line | ... |

### Phase 2: AI Backend & Context
| # | Finding | Severity | File:Line | Recommendation |
...

### Phase 3: Design Generation Pipeline
...

### Phase 4: Streaming & Performance
...

### Phase 5: Security & Data
...

## AI Capability Matrix
| Capability | Implemented | Quality | Notes |
|------------|-------------|---------|-------|
| Product search | YES/NO | ... | ... |
| Design generation | YES/NO | ... | ... |
| Cart management | YES/NO | ... | ... |
| Recommendations | YES/NO | ... | ... |
...

## Design Pipeline Flow
[Diagram or step list: user request → intent → generation → preview → product → cart]

## Scorecard
| Category | Score /10 | Notes |
|----------|-----------|-------|
| Chat UI/UX | X | ... |
| AI Context | X | ... |
| Design Pipeline | X | ... |
| Streaming | X | ... |
| Security | X | ... |

## Priority Action Items
1. [P0] ...
2. [P1] ...
3. [P2] ...
```

## Severity Levels

- **CRITICAL**: AI data leakage, prompt injection, cross-user conversations, design pipeline broken → blocks production
- **HIGH**: Missing core functionality, poor UX flow, no error handling → must fix before launch
- **MEDIUM**: Sub-optimal patterns, missing engagement features → should fix
- **LOW**: Nice-to-have improvements, polish items
