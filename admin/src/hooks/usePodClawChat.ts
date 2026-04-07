import { useState, useRef, useCallback } from 'react'
import { adminFetch } from '@/lib/admin-api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string
  tool: string
  input: Record<string, unknown>
  result?: string
  status: 'running' | 'completed' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  thinking?: string
  timestamp: Date
  costUsd?: number
  toolCallsCount?: number
}

export interface UsePodClawChatReturn {
  messages: ChatMessage[]
  isStreaming: boolean
  activeTools: ToolCall[]
  send: (message: string) => void
  stop: () => void
  conversationId: string | null
  totalCost: number
  loadConversation: (id: string) => Promise<void>
  newConversation: () => void
}

// ---------------------------------------------------------------------------
// SSE Parser
// ---------------------------------------------------------------------------

interface SSEEvent {
  event: string
  data: string
}

function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const blocks = chunk.split('\n\n')

  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    let event = ''
    let data = ''

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        event = line.slice(7)
      } else if (line.startsWith('data: ')) {
        data = line.slice(6)
      }
    }

    if (event && data) {
      events.push({ event, data })
    }
  }

  return events
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePodClawChat(): UsePodClawChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolCall[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [totalCost, setTotalCost] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)

  const send = useCallback((message: string) => {
    if (isStreaming || !message.trim()) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)
    setActiveTools([])

    // Create assistant message placeholder
    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, assistantMsg])

    // Start SSE connection
    const controller = new AbortController()
    abortControllerRef.current = controller

    adminFetch('/api/agent/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message.trim(),
        conversation_id: conversationId,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE events
          const lastDoubleNewline = buffer.lastIndexOf('\n\n')
          if (lastDoubleNewline === -1) continue

          const complete = buffer.slice(0, lastDoubleNewline + 2)
          buffer = buffer.slice(lastDoubleNewline + 2)

          const events = parseSSEChunk(complete)

          for (const sseEvent of events) {
            try {
              const data = JSON.parse(sseEvent.data)
              handleSSEEvent(assistantId, sseEvent.event, data)
            } catch {
              // Skip malformed events
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const events = parseSSEChunk(buffer)
          for (const sseEvent of events) {
            try {
              const data = JSON.parse(sseEvent.data)
              handleSSEEvent(assistantId, sseEvent.event, data)
            } catch {
              // Skip malformed events
            }
          }
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: msg.content || `Error: ${err.message}` }
              : msg
          )
        )
      })
      .finally(() => {
        setIsStreaming(false)
        setActiveTools([])
        abortControllerRef.current = null
      })
  }, [isStreaming, conversationId])

  const handleSSEEvent = useCallback(
    (assistantId: string, event: string, data: Record<string, unknown>) => {
      switch (event) {
        case 'text_delta': {
          const text = data.text as string
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + text }
                : msg
            )
          )
          break
        }

        case 'thinking': {
          const text = data.text as string
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, thinking: (msg.thinking || '') + text }
                : msg
            )
          )
          break
        }

        case 'tool_start': {
          const toolCall: ToolCall = {
            id: data.id as string,
            tool: data.tool as string,
            input: data.input as Record<string, unknown>,
            status: 'running',
          }
          setActiveTools(prev => [...prev, toolCall])
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, toolCalls: [...(msg.toolCalls || []), toolCall] }
                : msg
            )
          )
          break
        }

        case 'tool_result': {
          const toolId = data.id as string
          const result = data.result_preview as string

          setActiveTools(prev =>
            prev.filter(t => t.id !== toolId)
          )
          setMessages(prev =>
            prev.map(msg => {
              if (msg.id !== assistantId) return msg
              return {
                ...msg,
                toolCalls: msg.toolCalls?.map(tc =>
                  tc.id === toolId
                    ? { ...tc, result, status: 'completed' as const }
                    : tc
                ),
              }
            })
          )
          break
        }

        case 'done': {
          const convId = data.conversation_id as string
          const cost = data.cost_usd as number
          const toolCallsCount = data.tool_calls as number

          if (convId) setConversationId(convId)
          setTotalCost(prev => prev + (cost || 0))
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, costUsd: cost, toolCallsCount }
                : msg
            )
          )
          break
        }

        case 'error': {
          const errorMsg = data.message as string
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: msg.content || `Error: ${errorMsg}` }
                : msg
            )
          )
          break
        }
      }
    },
    []
  )

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setActiveTools([])
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await adminFetch(`/api/agent/chat/conversations/${id}`)
      if (!res.ok) return
      const data = await res.json()

      setConversationId(id)
      setMessages(
        (data.messages || []).map((msg: Record<string, unknown>) => ({
          id: msg.id as string,
          role: msg.role as string,
          content: msg.content as string,
          toolCalls: msg.tool_calls as ToolCall[] | undefined,
          timestamp: new Date(msg.created_at as string),
        }))
      )
    } catch {
      // Silently fail
    }
  }, [])

  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setTotalCost(0)
    setActiveTools([])
  }, [])

  return {
    messages,
    isStreaming,
    activeTools,
    send,
    stop,
    conversationId,
    totalCost,
    loadConversation,
    newConversation,
  }
}
