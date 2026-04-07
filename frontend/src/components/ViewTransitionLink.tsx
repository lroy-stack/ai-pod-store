'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ComponentProps } from 'react'

/**
 * Link component with View Transitions API support
 *
 * Uses React 19's View Transitions for smooth page navigation.
 * Falls back gracefully if browser doesn't support View Transitions.
 *
 * Usage: Same as next/link, but with automatic view transitions
 */
export function ViewTransitionLink({
  children,
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const router = useRouter()

  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        // Check if browser supports View Transitions API
        if (typeof document !== 'undefined' && 'startViewTransition' in document) {
          e.preventDefault()

          // Start view transition with Next.js router navigation
          ;(document as any).startViewTransition(() => {
            router.push(href.toString())
          })
        }

        // Call original onClick if provided
        props.onClick?.(e)
      }}
    >
      {children}
    </Link>
  )
}
