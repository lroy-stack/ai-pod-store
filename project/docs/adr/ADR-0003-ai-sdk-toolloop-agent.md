# ADR-0003: AI SDK 6 with ToolLoopAgent for Chat System

## Status

Accepted

## Context

POD AI is a **chat-first e-commerce platform** where the AI agent (PodClaw) is the primary interface for product discovery, checkout, and customer service. The chat system needs to:

1. **Execute complex tool sequences**: Product search → add to cart → update quantity → checkout (4+ tool calls)
2. **Handle UI updates reactively**: Stream partial results to update product grids, cart counts, and order status in real-time
3. **Support user approval gates**: Checkout and returns require explicit user confirmation before executing
4. **Maintain conversation context**: Multi-turn conversations with memory across sessions
5. **Gracefully handle errors**: Network failures, Supabase errors, Stripe errors must not crash the chat

We evaluated three options:
- **LangChain.js**: Heavy framework with complex abstractions, poor TypeScript support, over-engineered for our use case
- **Custom Anthropic SDK integration**: Full control but requires implementing streaming, tool loop, retry logic, and UI integration from scratch
- **Vercel AI SDK 6**: Lightweight, React-native, built-in streaming, tool calling, and UI helpers

## Decision

We will use **Vercel AI SDK 6 with the `streamText()` API and custom ToolLoopAgent pattern**.

**Architecture**:
1. **API route** (`/api/chat`): Handles chat requests, executes tools, returns stream
2. **ToolLoopAgent**: Custom agent loop that executes tool calls until completion or max iterations (10)
3. **Tool definitions** (22 tools): `search_products`, `add_to_cart`, `update_cart_item`, `remove_from_cart`, `view_cart`, `create_checkout`, `confirm_order`, `check_order_status`, `initiate_return`, `confirm_return`, `get_product_details`, `list_categories`, `get_recommendations`, `apply_discount`, `save_for_later`, `view_wishlist`, `add_to_wishlist`, `remove_from_wishlist`, `get_shipping_estimate`, `get_size_guide`, `subscribe_newsletter`, `contact_support`
4. **User approval tools**: `create_checkout`, `confirm_order`, `initiate_return`, `confirm_return` require `needsApproval: true`
5. **React hooks**: `useChat()` from AI SDK for streaming, message history, and optimistic updates

**Tool execution flow**:
```
User: "Add this shirt to my cart and checkout"
  ↓
Agent calls: search_products({ query: "shirt" })
  ↓
Agent calls: add_to_cart({ product_id: "123", variant_id: "456", quantity: 1 })
  ↓
Agent calls: create_checkout({ needsApproval: true })
  ↓
UI shows approval button
  ↓
User clicks "Confirm"
  ↓
Agent calls: confirm_order()
  ↓
Stripe PaymentIntent created, order saved
```

## Consequences

**Positive**:
- ✅ **React-native streaming**: `useChat()` hook handles optimistic updates, error states, and retry logic out-of-the-box
- ✅ **Type-safe tools**: Zod schemas for all 22 tools with auto-generated TypeScript types
- ✅ **Built-in token counting**: AI SDK tracks token usage per request for cost monitoring
- ✅ **Streaming UI**: Product cards, cart updates, and order confirmations render as the agent streams text
- ✅ **Minimal boilerplate**: 150 lines of agent code vs 500+ with custom Anthropic SDK integration
- ✅ **Framework agnostic**: AI SDK works with Next.js, but tool definitions can be reused in PodClaw agent system

**Negative**:
- ❌ **Vendor lock-in**: AI SDK abstractions make it harder to switch LLM providers (locked to Anthropic's API format)
- ❌ **Limited control**: Cannot customize retry logic or streaming format without forking AI SDK
- ❌ **Bundle size**: AI SDK adds 50KB to client bundle (though most is tree-shaken)
- ❌ **Version churn**: AI SDK has aggressive release cycle (v5 → v6 had breaking changes)

**Mitigations**:
- Keep tool schemas in separate file (`frontend/src/lib/chat/tools.ts`) to enable porting to other frameworks
- Use AI SDK's provider abstraction to support fallback models (Claude 3.5 Sonnet → Claude 3 Haiku)
- Pin AI SDK version and test upgrades in staging before production
- Use dynamic imports for chat components to defer AI SDK bundle load

## Implementation Details

**Tool definition example**:
```typescript
{
  name: 'add_to_cart',
  description: 'Add a product variant to the shopping cart',
  parameters: z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  }),
  execute: async ({ product_id, variant_id, quantity }, context) => {
    const { userId } = context;
    const result = await addToCart(userId, product_id, variant_id, quantity);
    return {
      success: true,
      cart_item_id: result.id,
      cart_total: result.cart.total,
    };
  },
}
```

**Approval tool pattern**:
```typescript
{
  name: 'create_checkout',
  needsApproval: true,
  description: 'Create a Stripe checkout session (requires user confirmation)',
  execute: async ({ cart_id }, context) => {
    // Only execute if user approved
    if (!context.userApproved) {
      return { needsApproval: true, message: 'Please confirm checkout' };
    }
    const session = await createStripeSession(cart_id);
    return { checkout_url: session.url };
  },
}
```

**ToolLoopAgent pattern**:
```typescript
let iteration = 0;
while (iteration < 10) {
  const { toolCalls } = await streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages,
    tools,
  });

  if (!toolCalls || toolCalls.length === 0) break;

  for (const call of toolCalls) {
    const result = await tools[call.name].execute(call.args, context);
    messages.push({ role: 'tool', toolCallId: call.id, result });
  }

  iteration++;
}
```

## References

- Vercel AI SDK: https://sdk.vercel.ai/docs
- Chat API implementation: `frontend/src/app/api/chat/route.ts`
- Tool definitions: `frontend/src/lib/chat/tools.ts`
- useChat hook usage: `frontend/src/components/chat/ChatInterface.tsx`
