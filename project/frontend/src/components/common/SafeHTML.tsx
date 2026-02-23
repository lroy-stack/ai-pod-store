'use client'

import dynamic from 'next/dynamic'

/**
 * SafeHTML - XSS-protected HTML renderer
 *
 * Wraps dangerouslySetInnerHTML with DOMPurify sanitization to prevent XSS attacks.
 * Loaded with ssr:false because DOMPurify requires a browser DOM.
 *
 * @example
 * ```tsx
 * <SafeHTML html={product.safetyInformation} className="prose" />
 * ```
 */

interface SafeHTMLProps {
  html: string
  className?: string
  tag?: keyof React.JSX.IntrinsicElements
}

const SafeHTMLClient = dynamic(() => import('./SafeHTMLClient'), { ssr: false })

export function SafeHTML(props: SafeHTMLProps) {
  return <SafeHTMLClient {...props} />
}
