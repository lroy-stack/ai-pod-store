'use client'

import Image from 'next/image'
import { BRAND } from '@/lib/store-config'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  /** Size of the logo in px */
  size?: number
  /** Show brand name text next to logo */
  showName?: boolean
  /** Text size class for the name */
  nameClass?: string
  /** Extra className on the wrapper */
  className?: string
}

/**
 * BrandMark — centralised brand logo + name component.
 *
 * Renders the correct logo for light/dark mode and optionally
 * the brand name in uppercase bold tracking-tight.
 *
 * All values come from BRAND config (store-config.ts) which reads
 * NEXT_PUBLIC_SITE_NAME at build time. Logo paths are also centralised
 * there and fall back to /brand/skapara-mark-*.svg.
 */
export function BrandMark({
  size = 32,
  showName = false,
  nameClass = 'text-sm',
  className,
}: BrandMarkProps) {
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
        <span className={cn('font-bold tracking-tight uppercase text-foreground', nameClass)}>
          {BRAND.name}
        </span>
      )}
    </div>
  )
}
