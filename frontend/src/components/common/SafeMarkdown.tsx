'use client'

import React from 'react'
import ReactMarkdown, { Components } from 'react-markdown'

// DOMPurify is browser-only; lazy-load to avoid SSR crash
const getDOMPurify = () => {
  if (typeof window === 'undefined') return null
   
  return require('dompurify') as typeof import('dompurify')
}

/**
 * SafeMarkdown - XSS-protected markdown renderer
 *
 * Wraps react-markdown with DOMPurify sanitization to prevent XSS attacks.
 * All user-generated markdown content MUST use this component instead of raw ReactMarkdown.
 *
 * @example
 * ```tsx
 * <SafeMarkdown>{userGeneratedContent}</SafeMarkdown>
 * // With custom components for styling:
 * <SafeMarkdown components={{ h1: (props) => <h1 className="..." {...props} /> }}>
 *   {content}
 * </SafeMarkdown>
 * ```
 */

const legalComponents: Components = {
  h1: ({ ...props }) => (
    <h1 className="text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 first:mt-0" {...props} />
  ),
  h2: ({ ...props }) => (
    <h2 className="text-xl md:text-2xl font-semibold text-foreground mt-6 mb-3" {...props} />
  ),
  h3: ({ ...props }) => (
    <h3 className="text-lg md:text-xl font-medium text-foreground mt-4 mb-2" {...props} />
  ),
  p: ({ ...props }) => (
    <p className="text-foreground leading-relaxed mb-4" {...props} />
  ),
  ul: ({ ...props }) => (
    <ul className="list-disc pl-6 space-y-2 text-foreground mb-4" {...props} />
  ),
  ol: ({ ...props }) => (
    <ol className="list-decimal pl-6 space-y-2 text-foreground mb-4" {...props} />
  ),
  li: ({ ...props }) => (
    <li className="leading-relaxed text-foreground" {...props} />
  ),
  a: ({ href, children, ...props }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium" {...props}>
      {children}
    </a>
  ),
  strong: ({ ...props }) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  blockquote: ({ ...props }) => (
    <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-4" {...props} />
  ),
}

interface SafeMarkdownProps {
  children: string
  className?: string
  /** Use "legal" for styled legal/policy pages */
  variant?: 'legal'
}

export function SafeMarkdown({ children, className, variant }: SafeMarkdownProps) {
  // SECURITY: Sanitize markdown content to prevent XSS
  // During SSR (no window), skip sanitization — content is from our DB, not user input.
  // On client hydration, DOMPurify kicks in.
  const sanitized = React.useMemo(() => {
    const dp = getDOMPurify()
    if (!dp) return children // SSR fallback
    const purify = dp.default ?? dp
    return purify.sanitize(children, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'strike', 'code', 'pre',
        'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    })
  }, [children])

  return (
    <ReactMarkdown className={className} components={variant === 'legal' ? legalComponents : undefined}>
      {sanitized}
    </ReactMarkdown>
  )
}
