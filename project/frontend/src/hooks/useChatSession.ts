'use client'

/**
 * useChatSession — Session persistence, TTL expiry, and serialization for chat
 *
 * Extracted from ChatArea.tsx to encapsulate:
 * - Message serialization/deserialization to sessionStorage
 * - 3-hour TTL for anonymous users
 * - Conversation ID tracking
 * - Debounced persistence (avoids writing on every streaming token)
 */

import { useState, useRef, useEffect, useCallback } from 'react'

// --- Types ---

export type SerializedPart =
  | { type: 'text'; text: string }
  | { type: string; toolCallId: string; state: string; input?: any; output?: any }

export type SerializedMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: SerializedPart[]
  createdAt?: string
}

// --- Internal helpers ---

const CHAT_TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function serializeMessages(
  messages: Array<{
    id: string
    role: string
    parts: Array<{ type: string; [key: string]: any }>
    createdAt?: Date | string
  }>
): string {
  const slim: SerializedMessage[] = messages.map((m) => ({
    id: m.id,
    role: m.role as 'user' | 'assistant',
    parts: m.parts
      .filter(
        (p: any) =>
          p.type === 'text' ||
          (p.type.startsWith('tool-') && p.state === 'output-available')
      )
      .map((p: any) => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text }
        return {
          type: p.type,
          toolCallId: p.toolCallId,
          state: p.state,
          input: p.input,
          output: p.output,
        }
      }),
    createdAt: m.createdAt ? String(m.createdAt) : undefined,
  }))
  return JSON.stringify(slim)
}

function clearChatSession() {
  sessionStorage.removeItem('pod-chat-messages')
  sessionStorage.removeItem('pod-chat-ts')
  sessionStorage.removeItem('pod-conversation-id')
}

function isChatExpired(): boolean {
  const ts = sessionStorage.getItem('pod-chat-ts')
  if (!ts) return true
  const epoch = Number(ts) || new Date(ts).getTime()
  if (isNaN(epoch)) return true
  return Date.now() - epoch > CHAT_TTL_MS
}

function deserializeMessages(isLoggedIn: boolean): SerializedMessage[] | undefined {
  try {
    const raw = sessionStorage.getItem('pod-chat-messages')
    if (!raw) return undefined
    if (!isLoggedIn && isChatExpired()) {
      clearChatSession()
      return undefined
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined
    return parsed
  } catch {
    return undefined
  }
}

// --- Hook ---

export function useChatSession(isLoggedIn: boolean) {
  // Track session expiration — ChatArea uses this to clear messages once
  const [sessionExpired, setSessionExpired] = useState(false)

  // Reset sessionExpired when user logs in (allows new chat after auth)
  useEffect(() => {
    if (isLoggedIn && sessionExpired) {
      setSessionExpired(false)
    }
  }, [isLoggedIn, sessionExpired])

  // Restore messages from sessionStorage (read once on mount)
  const [initialMessages] = useState<SerializedMessage[] | undefined>(() => {
    const hasAuthCookie =
      typeof document !== 'undefined' &&
      document.cookie.includes('sb-access-token')
    return deserializeMessages(hasAuthCookie)
  })

  // Conversation ID — persists across navigation via sessionStorage
  const conversationIdRef = useRef<string | null>(
    typeof window !== 'undefined'
      ? sessionStorage.getItem('pod-conversation-id')
      : null
  )

  // Debounced persistence — avoids writing on every streaming token
  // IMPORTANT: persistMessages must NEVER call setMessages to avoid infinite loops
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const persistMessages = useCallback(
    (messages: Array<{ id: string; role: string; parts: any[]; createdAt?: any }>) => {
      // Skip persistence if session is expired for anonymous users
      if (!isLoggedIn && isChatExpired()) {
        clearChatSession()
        conversationIdRef.current = null
        setSessionExpired(true)
        return
      }

      // Debounce the actual write (500ms)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (messages.length > 0) {
          try {
            sessionStorage.setItem(
              'pod-chat-messages',
              serializeMessages(messages)
            )
            if (!sessionStorage.getItem('pod-chat-ts')) {
              sessionStorage.setItem('pod-chat-ts', String(Date.now()))
            }
          } catch {
            /* quota exceeded — ignore */
          }
        }
      }, 500)
    },
    [isLoggedIn]
  )

  // Expiry lifecycle — check on mount, tab visibility, focus, and periodic interval
  useEffect(() => {
    function checkExpiry() {
      if (isLoggedIn) return
      if (isChatExpired()) {
        clearChatSession()
        conversationIdRef.current = null
        setSessionExpired(true)
      }
    }

    checkExpiry()

    function onVisibility() {
      if (document.visibilityState === 'visible') checkExpiry()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', checkExpiry)
    const interval = setInterval(checkExpiry, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', checkExpiry)
      clearInterval(interval)
    }
  }, [isLoggedIn])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return {
    initialMessages,
    conversationIdRef,
    persistMessages,
    sessionExpired,
  }
}
