'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ChatMessageContextType {
  pendingChatMessage: string
  setPendingChatMessage: (message: string) => void
}

const ChatMessageContext = createContext<ChatMessageContextType | null>(null)

export function ChatMessageProvider({ children }: { children: ReactNode }) {
  const [pendingChatMessage, setPendingChatMessage] = useState('')

  return (
    <ChatMessageContext.Provider value={{ pendingChatMessage, setPendingChatMessage }}>
      {children}
    </ChatMessageContext.Provider>
  )
}

export function useChatMessage() {
  const context = useContext(ChatMessageContext)
  if (!context) {
    throw new Error('useChatMessage must be used within a ChatMessageProvider')
  }
  return context
}
