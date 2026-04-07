'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

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
}

const StorefrontContext = createContext<StorefrontContextType | null>(null)

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null)

  const addArtifact = useCallback((artifact: Artifact) => {
    setArtifacts((prev) => {
      const exists = prev.find((a) => a.id === artifact.id)
      if (exists) {
        return prev.map((a) => (a.id === artifact.id ? artifact : a))
      }
      return [...prev, artifact]
    })
    setActiveArtifactId(artifact.id)
  }, [])

  const removeArtifact = useCallback((id: string) => {
    setArtifacts((prev) => {
      const filtered = prev.filter((a) => a.id !== id)
      return filtered
    })
    setActiveArtifactId((currentId) => {
      if (currentId === id) return null
      return currentId
    })
  }, [])

  const clearArtifacts = useCallback(() => {
    setArtifacts([])
    setActiveArtifactId(null)
  }, [])

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
