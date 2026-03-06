'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface DesignContextType {
  activeProductId: string | null
  setActiveProductId: (id: string | null) => void
  latestDesignUrl: string | null
  setLatestDesignUrl: (url: string | null) => void
  latestGenerationId: string | null
  setLatestGenerationId: (id: string | null) => void
}

const DesignContext = createContext<DesignContextType | undefined>(undefined)

export function DesignProvider({ children }: { children: ReactNode }) {
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [latestDesignUrl, setLatestDesignUrl] = useState<string | null>(null)
  const [latestGenerationId, setLatestGenerationId] = useState<string | null>(null)

  return (
    <DesignContext.Provider value={{
      activeProductId,
      setActiveProductId,
      latestDesignUrl,
      setLatestDesignUrl,
      latestGenerationId,
      setLatestGenerationId,
    }}>
      {children}
    </DesignContext.Provider>
  )
}

export function useDesign() {
  const context = useContext(DesignContext)
  if (!context) {
    throw new Error('useDesign must be used within a DesignProvider')
  }
  return context
}
