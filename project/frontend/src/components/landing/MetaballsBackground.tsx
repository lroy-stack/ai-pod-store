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

/** Resolve any CSS color (including oklch) to hex via canvas */
function cssColorToHex(cssColor: string): string {
  if (cssColor.startsWith('#')) return cssColor
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#000000'
  ctx.fillStyle = cssColor
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
}

/** Read a CSS variable from :root and resolve to hex */
function getThemeColorHex(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!raw) return fallback
  return cssColorToHex(raw)
}

export function MetaballsBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [supportsWebGL, setSupportsWebGL] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSupportsWebGL(hasWebGL())
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    // Check if viewport is mobile (<768px)
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()

    // Re-check on resize
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Disable canvas on mobile, no WebGL, or if not mounted
  if (!mounted || !supportsWebGL || isMobile) return null

  // Read unprefixed theme variables from :root and convert oklch→hex for shader
  const colorBack = getThemeColorHex('--background', resolvedTheme === 'dark' ? '#0a0a0b' : '#dcdde0')
  const blobColor1 = getThemeColorHex('--primary', '#2b00ff')
  const blobColor2 = getThemeColorHex('--chart-2', '#ae00ff')
  const blobColor3 = getThemeColorHex('--chart-5', '#ffc105')

  return (
    <Metaballs
      colors={[blobColor1, blobColor2, blobColor3]}
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
