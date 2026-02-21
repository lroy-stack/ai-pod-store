'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Metaballs } from '@paper-design/shaders-react'

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'))
  } catch {
    return false
  }
}

export function MetaballsBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [supportsWebGL, setSupportsWebGL] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSupportsWebGL(hasWebGL())
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }, [])

  if (!mounted || !supportsWebGL) return null

  const colorBack = resolvedTheme === 'dark' ? '#0a0a0b' : '#dcdde0'

  return (
    <Metaballs
      colors={['#2b00ff', '#ae00ff', '#ffc105']}
      colorBack={colorBack}
      count={19.8}
      size={0.05}
      speed={reducedMotion ? 0 : 0.5}
      scale={4}
      offsetX={-0.3}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
