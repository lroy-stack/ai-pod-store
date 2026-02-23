'use client'

import React from 'react'
import DOMPurify from 'dompurify'

/**
 * SafeHTML - XSS-protected HTML renderer
 *
 * Wraps dangerouslySetInnerHTML with DOMPurify sanitization to prevent XSS attacks.
 * All user-generated or admin-generated HTML content MUST use this component
 * instead of raw dangerouslySetInnerHTML.
 *
 * @example
 * ```tsx
 * <SafeHTML html={product.safetyInformation} className="prose" />
 * ```
 */

interface SafeHTMLProps {
  html: string
  className?: string
  /** Custom tag to render (default: 'div') */
  tag?: keyof React.JSX.IntrinsicElements
}

export function SafeHTML({ html, className, tag = 'div' }: SafeHTMLProps) {
  // SECURITY: Sanitize HTML content to prevent XSS
  const sanitized = React.useMemo(() => {
    if (!html) return ''

    return DOMPurify.sanitize(html, {
      // Allow common safe HTML tags
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'strike', 'code', 'pre',
        'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
        'img', 'sup', 'sub', 'abbr', 'cite', 'q', 'kbd', 'samp', 'var',
      ],
      // Allow safe attributes only
      ALLOWED_ATTR: [
        'href', 'title', 'target', 'rel', 'alt', 'src', 'width', 'height',
        'class', 'id', 'aria-label', 'aria-hidden', 'role',
      ],
      // Allow only safe URL protocols
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      // Disallow data: URIs and javascript: URIs
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    })
  }, [html])

  const Tag = tag as any

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
