'use client'

/**
 * ChatHistoryContext — Shared state between ChatArea and Sidebar
 *
 * Manages:
 * - viewMode: 'chat' | 'history' (which view ChatArea renders)
 * - activeConversationId: currently loaded conversation
 * - Handlers for load/new/delete (registered by ChatArea)
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ViewMode = 'chat' | 'history'

interface ChatHistoryContextType {
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  onLoadConversation: ((id: string) => void) | null
  onNewChat: (() => void) | null
  onDeleteConversation: ((id: string) => void) | null
  registerHandlers: (handlers: {
    onLoad: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
  }) => void
}

const ChatHistoryContext = createContext<ChatHistoryContextType | null>(null)

export function ChatHistoryProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>('chat')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [handlers, setHandlers] = useState<{
    onLoad: ((id: string) => void) | null
    onNew: (() => void) | null
    onDelete: ((id: string) => void) | null
  }>({ onLoad: null, onNew: null, onDelete: null })

  const registerHandlers = useCallback((h: {
    onLoad: (id: string) => void
    onNew: () => void
    onDelete: (id: string) => void
  }) => {
    setHandlers({ onLoad: h.onLoad, onNew: h.onNew, onDelete: h.onDelete })
  }, [])

  return (
    <ChatHistoryContext.Provider value={{
      viewMode,
      setViewMode,
      activeConversationId,
      setActiveConversationId,
      onLoadConversation: handlers.onLoad,
      onNewChat: handlers.onNew,
      onDeleteConversation: handlers.onDelete,
      registerHandlers,
    }}>
      {children}
    </ChatHistoryContext.Provider>
  )
}

export function useChatHistory() {
  const ctx = useContext(ChatHistoryContext)
  if (!ctx) throw new Error('useChatHistory must be used within ChatHistoryProvider')
  return ctx
}
