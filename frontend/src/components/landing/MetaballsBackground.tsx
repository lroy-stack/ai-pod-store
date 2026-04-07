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

interface Colors {
  back: string
  blob1: string
  blob2: string
  blob3: string
}

function readColorsFromDOM(isDark: boolean): Colors {
  return {
    back: getThemeColorHex('--background', isDark ? '#1a1a2e' : '#dcdde0'),
    blob1: getThemeColorHex('--primary', '#2b00ff'),
    blob2: getThemeColorHex('--chart-2', '#ae00ff'),
    blob3: getThemeColorHex('--chart-5', '#ffc105'),
  }
}

export function MetaballsBackground() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [supportsWebGL, setSupportsWebGL] = useState(true)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [colors, setColors] = useState<Colors | null>(null)

  useEffect(() => {
    setMounted(true)
    setSupportsWebGL(hasWebGL())
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }, [])

  // Read CSS variables AFTER DOM commit (useEffect, not useMemo).
  // requestAnimationFrame ensures the browser has fully computed styles
  // after next-themes toggles the .dark class on <html>.
  useEffect(() => {
    if (!mounted) return
    const raf = requestAnimationFrame(() => {
      setColors(readColorsFromDOM(resolvedTheme === 'dark'))
    })
    return () => cancelAnimationFrame(raf)
  }, [mounted, resolvedTheme])

  if (!mounted || !supportsWebGL || !colors) return null

  return (
    <Metaballs
      colors={[colors.blob1, colors.blob2, colors.blob3]}
      colorBack={colors.back}
      count={19.8}
      size={0.05}
      speed={reducedMotion ? 0 : 0.5}
      scale={4}
      offsetX={-0.3}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
