'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface StorefrontContextType {
  selectedProduct: string | null
  setSelectedProduct: (id: string | null) => void
  pendingChatMessage: string
  setPendingChatMessage: (message: string) => void
}

const StorefrontContext = createContext<StorefrontContextType | null>(null)

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [pendingChatMessage, setPendingChatMessage] = useState('')

  return (
    <StorefrontContext.Provider
      value={{ selectedProduct, setSelectedProduct, pendingChatMessage, setPendingChatMessage }}
    >
      {children}
    </StorefrontContext.Provider>
  )
}

export function useStorefront() {
  const context = useContext(StorefrontContext)
  if (!context) {
    throw new Error('useStorefront must be used within a StorefrontProvider')
  }
  return context
}
