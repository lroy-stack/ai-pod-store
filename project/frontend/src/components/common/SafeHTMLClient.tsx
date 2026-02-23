'use client'

import React from 'react'
import DOMPurify from 'dompurify'

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 'strike', 'code', 'pre',
    'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div',
    'img', 'sup', 'sub', 'abbr', 'cite', 'q', 'kbd', 'samp', 'var',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'alt', 'src', 'width', 'height',
    'class', 'id', 'aria-label', 'aria-hidden', 'role',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
} as const

interface SafeHTMLClientProps {
  html: string
  className?: string
  tag?: keyof React.JSX.IntrinsicElements
}

export default function SafeHTMLClient({ html, className, tag = 'div' }: SafeHTMLClientProps) {
  const sanitized = React.useMemo(() => {
    if (!html) return ''
    return DOMPurify.sanitize(html, PURIFY_CONFIG)
  }, [html])

  const Tag = tag as any

  return (
    <Tag
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
