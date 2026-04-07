'use client'

import Image from 'next/image'
import { BRAND } from '@/lib/store-config'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  /** Size of the S mark in px */
  size?: number
  /** Show brand wordmark next to logo */
  showName?: boolean
  /** Height of the wordmark in px (default: size * 0.5) */
  nameHeight?: number
  /** Extra className on the wrapper */
  className?: string
}

/**
 * BrandMark — centralised brand logo + wordmark component.
 *
 * Renders the S mark for light/dark mode and optionally
 * the full wordmark SVG image (not plain text).
 *
 * All paths come from BRAND config in store-config.ts.
 */
export function BrandMark({
  size = 32,
  showName = false,
  nameHeight,
  className,
}: BrandMarkProps) {
  const wordmarkH = nameHeight || Math.round(size * 0.45)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <Image
          src={BRAND.logoLight}
          alt={BRAND.name}
          fill
          className="object-contain transition-opacity duration-300 opacity-100 dark:opacity-0"
        />
        <Image
          src={BRAND.logoDark}
          alt={BRAND.name}
          fill
          className="object-contain transition-opacity duration-300 opacity-0 dark:opacity-100"
        />
      </div>
      {showName && (
        <div className="relative flex-shrink min-w-0" style={{ height: wordmarkH, width: wordmarkH * (13998 / 1692), maxWidth: '100%' }}>
          <Image
            src={BRAND.logoFullLight}
            alt={BRAND.name}
            fill
            className="object-contain transition-opacity duration-300 opacity-100 dark:opacity-0"
          />
          <Image
            src={BRAND.logoFullDark}
            alt={BRAND.name}
            fill
            className="object-contain transition-opacity duration-300 opacity-0 dark:opacity-100"
          />
        </div>
      )}
    </div>
  )
}
