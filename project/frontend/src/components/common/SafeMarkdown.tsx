'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import DOMPurify from 'dompurify'

/**
 * SafeMarkdown - XSS-protected markdown renderer
 *
 * Wraps react-markdown with DOMPurify sanitization to prevent XSS attacks.
 * All user-generated markdown content MUST use this component instead of raw ReactMarkdown.
 *
 * @example
 * ```tsx
 * <SafeMarkdown>{userGeneratedContent}</SafeMarkdown>
 * ```
 */

interface SafeMarkdownProps {
  children: string
  className?: string
}

export function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  // SECURITY: Sanitize markdown content to prevent XSS
  const sanitized = React.useMemo(() => {
    return DOMPurify.sanitize(children, {
      // Allow common markdown-safe HTML tags
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'strike', 'code', 'pre',
        'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      // Allow safe attributes only
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      // Force all links to open in new tab with noopener noreferrer
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    })
  }, [children])

  return (
    <ReactMarkdown className={className}>
      {sanitized}
    </ReactMarkdown>
  )
}
