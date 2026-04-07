/**
 * Message Serializer — Convert between DB messages and UIMessage format
 *
 * DB messages: { id, role, content, tool_calls, tool_results, created_at }
 * UIMessages:  { id, role, parts: [{ type: 'text', text }], createdAt }
 *
 * Used by:
 * - useChatSession: load conversation history from DB
 *
 * Note: tool_calls/tool_results are rarely persisted in DB.
 * Historical conversations load as text-only — artifacts are not reconstructed.
 */

import type { SerializedMessage } from '@/hooks/useChatSession'

interface DBMessage {
  id: string
  role: string
  content: string
  tool_calls?: any[] | null
  tool_results?: any[] | null
  parts?: any[] | null
  created_at: string
}

/**
 * Convert DB messages array to the format useChatSession/useChat expects.
 * Only includes user and assistant messages (skips system).
 */
export function dbMessagesToInitialMessages(dbMessages: DBMessage[]): SerializedMessage[] {
  return dbMessages
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => {
      // If parts[] was saved (new format), use it directly
      if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          parts: msg.parts as SerializedMessage['parts'],
          createdAt: msg.created_at,
        }
      }

      // Fallback: reconstruct from content + tool_calls (legacy format)
      const parts: SerializedMessage['parts'] = []

      if (msg.content) {
        parts.push({ type: 'text', text: msg.content })
      }

      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        for (const tc of msg.tool_calls) {
          const toolResult = msg.tool_results?.find(
            (tr: any) => tr.toolCallId === tc.toolCallId
          )
          parts.push({
            type: 'tool-invocation',
            toolCallId: tc.toolCallId || tc.id,
            state: toolResult ? 'output-available' : 'error',
            input: tc.args || tc.input,
            output: toolResult?.result || toolResult?.output,
          })
        }
      }

      return {
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts,
        createdAt: msg.created_at,
      }
    })
}
