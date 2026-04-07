'use client'

/**
 * useChatTransport — AI SDK 6 transport with CSRF, conversation ID, and engagement interception
 *
 * Extracted from ChatArea.tsx to encapsulate:
 * - Custom fetch wrapper (CSRF token, conversation ID header)
 * - Engagement limit interception (429/403 → modal)
 * - DefaultChatTransport + useChat() invocation
 * - Usage limit check on mount
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import type { SerializedMessage } from './useChatSession'
import { getCsrfToken } from '@/lib/api-fetch'
import { useUsage } from '@/providers/UsageProvider'

interface UseChatTransportOptions {
  initialMessages: SerializedMessage[] | undefined
  conversationIdRef: React.MutableRefObject<string | null>
  persistConversationId: (convId: string) => void
  userName: string | null
}

export function useChatTransport({
  initialMessages,
  conversationIdRef,
  persistConversationId,
  userName,
}: UseChatTransportOptions) {
  // Engagement state
  const [showAuthWall, setShowAuthWall] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isLimitReached, setIsLimitReached] = useState(false)
  const { usage } = useUsage()

  // Keep userName in a ref for stable closure access in customFetch
  const userNameRef = useRef(userName)
  useEffect(() => {
    userNameRef.current = userName
  }, [userName])

  // Custom fetch wrapper — CSRF + conversation ID + engagement intercept
  const customFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers)

      // CSRF token — required by middleware for POST requests
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        headers.set('x-csrf-token', csrfToken)
      }

      // Conversation ID for session continuity
      if (conversationIdRef.current) {
        headers.set('x-conversation-id', conversationIdRef.current)
      }

      const response = await fetch(input, { ...init, headers })

      // Extract conversation ID from response
      const newConvId = response.headers.get('x-conversation-id')
      if (newConvId && newConvId !== conversationIdRef.current) {
        conversationIdRef.current = newConvId
        persistConversationId(newConvId)
      }

      // Intercept engagement limit errors — show modal instead of raw error
      if (response.status === 429 || response.status === 403) {
        try {
          const cloned = response.clone()
          const body = await cloned.json()
          if (body.code === 'LIMIT_REACHED') {
            setIsLimitReached(true)
            if (!userNameRef.current) {
              setShowAuthWall(true)
            } else {
              setShowUpgrade(true)
            }
            // Return a fake empty SSE stream so useChat doesn't show the raw error
            return new Response('', {
              status: 200,
              headers: { 'content-type': 'text/event-stream' },
            })
          }
        } catch { /* non-critical */
          // Failed to parse body — ignore
        }
      }

      return response
    },
    [conversationIdRef]
  )

  // AI SDK 6 transport
  const transport = useMemo(
    () => new DefaultChatTransport({ api: '/api/chat', fetch: customFetch }),
    [customFetch]
  )

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    addToolApprovalResponse,
    error,
  } = useChat({
    transport,
    messages: initialMessages as any,
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Pre-block input for anonymous users when limit is reached (reads from shared UsageProvider)
  useEffect(() => {
    const chatUsage = usage?.usage?.chat
    if (chatUsage && chatUsage.limit > 0 && chatUsage.remaining <= 0) {
      setIsLimitReached(true)
    }
  }, [usage])

  return {
    messages,
    setMessages,
    sendMessage,
    status,
    error,
    isLoading,
    addToolApprovalResponse,
    showAuthWall,
    setShowAuthWall,
    showUpgrade,
    setShowUpgrade,
    isLimitReached,
  }
}
