'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import DOMPurify from 'isomorphic-dompurify'
import type { Components } from 'react-markdown'

interface SafeMarkdownProps {
  children: string
  remarkPlugins?: any[]
  components?: Partial<Components>
  className?: string
}

/**
 * SafeMarkdown - XSS-protected markdown renderer
 *
 * Wraps react-markdown with DOMPurify sanitization to prevent XSS attacks.
 * All markdown content is sanitized before rendering to remove malicious HTML/JS.
 *
 * @param children - The markdown string to render
 * @param remarkPlugins - Optional remark plugins (defaults to [remarkGfm])
 * @param components - Optional component overrides for ReactMarkdown
 * @param className - Optional CSS class
 */
export function SafeMarkdown({
  children,
  remarkPlugins = [remarkGfm],
  components,
  className
}: SafeMarkdownProps) {
  // Sanitize the markdown content before rendering
  // DOMPurify config: allows markdown-safe tags, removes scripts/event handlers
  const sanitized = DOMPurify.sanitize(children, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'b', 'i', 'u', 's', 'del', 'mark',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
      'input', // for GFM task lists
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', // links
      'src', 'alt', 'title', 'width', 'height', // images
      'type', 'checked', 'disabled', // task lists
      'class', 'id', // styling
      'align', 'colspan', 'rowspan', // tables
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  })

  const markdown = (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      components={components}
    >
      {sanitized}
    </ReactMarkdown>
  )

  // If className is provided, wrap in a div
  if (className) {
    return <div className={className}>{markdown}</div>
  }

  return markdown
}
