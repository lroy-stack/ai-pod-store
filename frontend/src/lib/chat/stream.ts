/**
 * Streaming utilities and onFinish callback for the chat endpoint.
 * Handles response persistence, token tracking, and cost alerting.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { incrementTokenUsage, UserTier } from '@/lib/usage-limiter'

/** Per-response output token cap by tier */
export const TOKEN_BUDGET: Record<UserTier, number> = {
  anonymous: 2048,
  free: 4096,
  premium: 8192,
}

interface OnFinishContext {
  writeClient: SupabaseClient
  conversationId: string
  chatIdentifier: string
  chatUserTier: UserTier
  messages: any[]
}

/**
 * Creates the onFinish callback for streamText.
 * Persists the assistant response, sets conversation title on first message,
 * tracks token usage, and logs cost alerts for expensive responses.
 */
export function createOnFinishCallback(ctx: OnFinishContext) {
  const { writeClient, conversationId, chatIdentifier, chatUserTier, messages } = ctx

  return async ({ text, toolCalls, toolResults, usage, steps }: {
    text: string
    toolCalls?: any[]
    toolResults?: any[]
    usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number }
    steps?: any[]
  }) => {
    // Build parts array for artifact reconstruction
    const parts: any[] = []
    if (text) parts.push({ type: 'text', text })

    // Extract tool calls/results from steps (AI SDK 6 tool loop)
    if (steps && Array.isArray(steps)) {
      for (const step of steps) {
        if (step.toolCalls) {
          for (const tc of step.toolCalls) {
            const result = step.toolResults?.find((tr: any) => tr.toolCallId === tc.toolCallId)
            parts.push({
              type: `tool-invocation`,
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              state: result ? 'output-available' : 'partial-call',
              input: tc.args,
              output: result?.result,
            })
          }
        }
      }
    }

    // Persist assistant response
    // Use writeClient (user JWT for authenticated, service key for anonymous) (#42)
    try {
      await writeClient.from('messages').insert({
        id: crypto.randomUUID(),
        conversation_id: conversationId,
        role: 'assistant',
        content: text || '',
        tool_calls: toolCalls?.length ? toolCalls : null,
        tool_results: toolResults?.length ? toolResults : null,
        parts: parts.length > 1 ? parts : null,
        tokens_used: usage?.totalTokens || null,
        created_at: new Date().toISOString(),
      })

      // Set conversation title from first assistant response
      if (messages.length <= 2 && text) {
        const title = text.substring(0, 100)
        await writeClient.from('conversations')
          .update({ title, updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      }
    } catch (err) {
      console.error('Assistant message save error (non-critical):', err)
    }

    // Token budget tracking (best-effort, non-blocking)
    const totalTokens = usage?.totalTokens || 0
    if (totalTokens > 0) {
      incrementTokenUsage(chatIdentifier, chatUserTier, totalTokens).catch(() => {})

      // Cost alert for expensive responses
      const inputTk = usage?.inputTokens || 0
      const outputTk = usage?.outputTokens || 0
      const estimatedCost = (inputTk * 0.30 + outputTk * 1.25) / 1_000_000
      if (estimatedCost > 0.05) {
        console.warn('[CostAlert] expensive_response', {
          identifier: chatIdentifier.slice(0, 20),
          tier: chatUserTier,
          inputTokens: inputTk,
          outputTokens: outputTk,
          totalTokens,
          estimatedCost: `$${estimatedCost.toFixed(4)}`,
        })
      }
    }
  }
}
