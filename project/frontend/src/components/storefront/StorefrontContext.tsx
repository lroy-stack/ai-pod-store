'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export interface Artifact {
  id: string
  type: 'product' | 'design' | 'comparison' | 'cart' | 'order' | 'other'
  title: string
  data: any
}

interface StorefrontContextType {
  selectedProduct: string | null
  setSelectedProduct: (id: string | null) => void
  artifacts: Artifact[]
  addArtifact: (artifact: Artifact) => void
  removeArtifact: (id: string) => void
  clearArtifacts: () => void
  activeArtifactId: string | null
  setActiveArtifactId: (id: string | null) => void
  pendingChatMessage: string
  setPendingChatMessage: (message: string) => void
}

const StorefrontContext = createContext<StorefrontContextType | null>(null)

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)
  const [pendingChatMessage, setPendingChatMessage] = useState('')

  const addArtifact = (artifact: Artifact) => {
    setArtifacts((prev) => {
      // Check if artifact already exists
      const exists = prev.find((a) => a.id === artifact.id)
      if (exists) {
        // Update existing artifact
        return prev.map((a) => (a.id === artifact.id ? artifact : a))
      }
      // Add new artifact
      return [...prev, artifact]
    })
    // Set as active
    setActiveArtifactId(artifact.id)
  }

  const removeArtifact = (id: string) => {
    setArtifacts((prev) => {
      const filtered = prev.filter((a) => a.id !== id)
      // If we removed the active artifact, set a new active one
      if (activeArtifactId === id && filtered.length > 0) {
        setActiveArtifactId(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveArtifactId(null)
      }
      return filtered
    })
  }

  const clearArtifacts = () => {
    setArtifacts([])
    setActiveArtifactId(null)
  }

  return (
    <StorefrontContext.Provider
      value={{
        selectedProduct,
        setSelectedProduct,
        artifacts,
        addArtifact,
        removeArtifact,
        clearArtifacts,
        activeArtifactId,
        setActiveArtifactId,
        pendingChatMessage,
        setPendingChatMessage,
      }}
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
