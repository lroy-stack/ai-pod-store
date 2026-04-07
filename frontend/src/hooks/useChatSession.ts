'use client'

/**
 * useChatSession — Chat persistence with dual strategy
 *
 * AUTH USERS:
 *   Source of truth: Supabase DB (conversations + messages tables)
 *   localStorage: NOT USED (security — no data leakage on shared devices)
 *   On mount: fetch last conversation from DB
 *   On message: backend persists via onFinish callback (no client-side writes)
 *
 * ANON USERS:
 *   Source of truth: localStorage with 3-hour TTL
 *   Keys prefixed with random UUID to prevent cross-session leakage
 *   Unchanged from previous implementation
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { dbMessagesToInitialMessages } from '@/lib/chat/message-serializer'

// --- Types (shared) ---

export type SerializedPart =
  | { type: 'text'; text: string }
  | { type: string; toolCallId: string; state: string; input?: any; output?: any }

export type SerializedMessage = {
  id: string
  role: 'user' | 'assistant'
  parts: SerializedPart[]
  createdAt?: string
}

// --- Anonymous helpers (localStorage) ---

const CHAT_TTL_MS = 3 * 60 * 60 * 1000 // 3 hours

function getStorage(): Storage | null {
  return typeof window !== 'undefined' ? localStorage : null
}

function getAnonPrefix(): string {
  const storage = getStorage()
  if (!storage) return 'pod-chat-anon'
  let sid = storage.getItem('pod-chat-session-id')
  if (!sid) {
    sid = crypto.randomUUID()
    storage.setItem('pod-chat-session-id', sid)
  }
  return `pod-chat-${sid}`
}

function anonKey(suffix: string): string {
  return `${getAnonPrefix()}-${suffix}`
}

function clearAnonSession() {
  const s = getStorage()
  if (!s) return
  const prefix = getAnonPrefix()
  s.removeItem(`${prefix}-messages`)
  s.removeItem(`${prefix}-ts`)
  s.removeItem(`${prefix}-cid`)
}

function isAnonExpired(): boolean {
  const s = getStorage()
  if (!s) return false
  const ts = s.getItem(anonKey('ts'))
  if (!ts) return false
  const epoch = Number(ts) || new Date(ts).getTime()
  if (isNaN(epoch)) return true
  return Date.now() - epoch > CHAT_TTL_MS
}

function serializeMessages(
  messages: Array<{ id: string; role: string; parts: any[]; createdAt?: any }>
): string {
  return JSON.stringify(messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: m.parts
      .filter((p: any) => p.type === 'text' || (p.type.startsWith('tool-') && p.state === 'output-available'))
      .map((p: any) => {
        if (p.type === 'text') return { type: 'text' as const, text: p.text }
        return { type: p.type, toolCallId: p.toolCallId, state: p.state, input: p.input, output: p.output }
      }),
    createdAt: m.createdAt ? String(m.createdAt) : undefined,
  })))
}

function deserializeAnonMessages(): SerializedMessage[] | undefined {
  try {
    const s = getStorage()
    if (!s) return undefined
    const raw = s.getItem(anonKey('messages'))
    if (!raw) return undefined
    if (isAnonExpired()) {
      clearAnonSession()
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

export function useChatSession(isLoggedIn: boolean, _userId: string | null) {
  const [sessionExpired, setSessionExpired] = useState(false)
  const [dbLoading, setDbLoading] = useState(isLoggedIn)
  const conversationIdRef = useRef<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Initial messages (different source per auth state) ---

  const [initialMessages, setInitialMessages] = useState<SerializedMessage[] | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    // Auth users: will be loaded async from DB (see useEffect below)
    if (isLoggedIn) return undefined
    // Anon users: read from localStorage
    return deserializeAnonMessages()
  })

  // --- Auth users: init conversationId from anon cache for first load ---
  useMemo(() => {
    if (typeof window === 'undefined') return
    if (!isLoggedIn) {
      // Anon: restore conversationId from localStorage
      conversationIdRef.current = getStorage()?.getItem(anonKey('cid')) ?? null
    }
    // Auth: conversationIdRef will be set by the DB fetch below
  }, [isLoggedIn])

  // --- Auth users: load last conversation from DB ---
  useEffect(() => {
    if (!isLoggedIn) {
      setDbLoading(false)
      return
    }

    let cancelled = false

    async function loadFromDB() {
      try {
        // 1. Get conversation list (most recent first)
        const listRes = await fetch('/api/conversations', { credentials: 'include' })
        if (!listRes.ok) { setDbLoading(false); return }
        const listData = await listRes.json()
        const conversations = listData.conversations || []

        if (cancelled) return

        if (conversations.length === 0) {
          // No previous conversations — start fresh
          setDbLoading(false)
          return
        }

        // 2. Load most recent conversation's messages
        const lastConv = conversations[0]
        const msgRes = await fetch(`/api/conversations/${lastConv.id}`, { credentials: 'include' })
        if (!msgRes.ok) { setDbLoading(false); return }
        const msgData = await msgRes.json()

        if (cancelled) return

        // 3. Convert DB messages to UIMessage format
        const formatted = dbMessagesToInitialMessages(msgData.messages || [])
        if (formatted.length > 0) {
          conversationIdRef.current = lastConv.id
          setInitialMessages(formatted)
        }
      } catch (err) {
        console.error('Failed to load conversation from DB:', err)
      } finally {
        if (!cancelled) setDbLoading(false)
      }
    }

    loadFromDB()
    return () => { cancelled = true }
  }, [isLoggedIn])

  // --- Reset sessionExpired when user logs in ---
  useEffect(() => {
    if (isLoggedIn && sessionExpired) setSessionExpired(false)
  }, [isLoggedIn, sessionExpired])

  // --- persistMessages: no-op for auth, localStorage for anon ---
  const persistMessages = useCallback(
    (messages: Array<{ id: string; role: string; parts: any[]; createdAt?: any }>) => {
      // Auth users: backend persists messages — no client-side storage
      if (isLoggedIn) return

      // Anon: check TTL
      if (isAnonExpired()) {
        clearAnonSession()
        conversationIdRef.current = null
        setSessionExpired(true)
        return
      }

      // Anon: debounced write to localStorage
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        if (messages.length > 0) {
          const s = getStorage()
          if (!s) return
          try {
            s.setItem(anonKey('messages'), serializeMessages(messages))
            if (!s.getItem(anonKey('ts'))) {
              s.setItem(anonKey('ts'), String(Date.now()))
            }
          } catch { /* quota exceeded */ }
        }
      }, 500)
    },
    [isLoggedIn]
  )

  // --- persistConversationId: ref-only for auth, localStorage for anon ---
  const persistConversationId = useCallback(
    (convId: string) => {
      conversationIdRef.current = convId
      // Anon: also save to localStorage
      if (!isLoggedIn) {
        try { getStorage()?.setItem(anonKey('cid'), convId) } catch { /* ignore */ }
      }
    },
    [isLoggedIn]
  )

  // --- Anon TTL expiry lifecycle ---
  useEffect(() => {
    if (isLoggedIn) return

    function checkExpiry() {
      if (isAnonExpired()) {
        clearAnonSession()
        conversationIdRef.current = null
        setSessionExpired(true)
      }
    }
    checkExpiry()

    const onVisibility = () => { if (document.visibilityState === 'visible') checkExpiry() }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', checkExpiry)
    const interval = setInterval(checkExpiry, 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', checkExpiry)
      clearInterval(interval)
    }
  }, [isLoggedIn])

  // --- Cleanup debounce on unmount ---
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  // --- loadConversation: switch to a different conversation (auth only) ---
  const loadConversation = useCallback(async (convId: string): Promise<SerializedMessage[] | null> => {
    try {
      const res = await fetch(`/api/conversations/${convId}`, { credentials: 'include' })
      if (!res.ok) return null
      const data = await res.json()
      const formatted = dbMessagesToInitialMessages(data.messages || [])
      conversationIdRef.current = convId
      return formatted
    } catch {
      return null
    }
  }, [])

  // --- startNewChat: clear current conversation ---
  const startNewChat = useCallback(() => {
    conversationIdRef.current = null
  }, [])

  return {
    initialMessages,
    conversationIdRef,
    persistMessages,
    persistConversationId,
    sessionExpired,
    dbLoading,
    loadConversation,
    startNewChat,
  }
}
