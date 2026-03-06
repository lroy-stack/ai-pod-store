import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DOMPurify from 'dompurify'
import { SafeMarkdown } from '@/components/common/SafeMarkdown'

// Mock DOMPurify to verify it's being called
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((input: string) => {
      // Simple mock implementation that removes script tags
      return input.replace(/<script[^>]*>.*?<\/script>/gi, '')
    }),
  },
}))

describe('SafeMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render basic markdown content', () => {
    const content = '# Hello World\n\nThis is a **test**.'
    render(<SafeMarkdown>{content}</SafeMarkdown>)

    // DOMPurify.sanitize should be called
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      content,
      expect.objectContaining({
        ALLOWED_TAGS: expect.arrayContaining([
          'p',
          'br',
          'strong',
          'em',
          'h1',
          'h2',
          'h3',
        ]),
      })
    )
  })

  it('should sanitize content with DOMPurify', () => {
    const maliciousContent = '<script>alert("XSS")</script>Hello'
    render(<SafeMarkdown>{maliciousContent}</SafeMarkdown>)

    // DOMPurify.sanitize should be called with the malicious content
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      maliciousContent,
      expect.any(Object)
    )
  })

  it('should allow safe HTML tags', () => {
    const content = '# Heading\n\nParagraph with **bold** and *italic*.'
    render(<SafeMarkdown>{content}</SafeMarkdown>)

    // Verify DOMPurify is configured with allowed tags
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      content,
      expect.objectContaining({
        ALLOWED_TAGS: expect.arrayContaining([
          'p',
          'br',
          'strong',
          'em',
          'u',
          'strike',
          'code',
          'pre',
          'a',
          'ul',
          'ol',
          'li',
          'blockquote',
          'h1',
          'h2',
          'h3',
          'h4',
          'h5',
          'h6',
          'table',
          'thead',
          'tbody',
          'tr',
          'th',
          'td',
        ]),
      })
    )
  })

  it('should allow safe attributes', () => {
    const content = '[Link](https://example.com)'
    render(<SafeMarkdown>{content}</SafeMarkdown>)

    // Verify DOMPurify is configured with allowed attributes
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      content,
      expect.objectContaining({
        ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
      })
    )
  })

  it('should apply custom className', () => {
    const content = 'Test content'
    const { container } = render(
      <SafeMarkdown className="custom-class">{content}</SafeMarkdown>
    )

    // The ReactMarkdown component should have the className
    const markdownContainer = container.firstChild as HTMLElement
    expect(markdownContainer.className).toContain('custom-class')
  })

  it('should memoize sanitized content', () => {
    const content = '# Test'
    const { rerender } = render(<SafeMarkdown>{content}</SafeMarkdown>)

    // Clear the mock calls
    vi.clearAllMocks()

    // Re-render with the same content
    rerender(<SafeMarkdown>{content}</SafeMarkdown>)

    // DOMPurify.sanitize should not be called again because of memoization
    expect(DOMPurify.sanitize).not.toHaveBeenCalled()
  })

  it('should re-sanitize when content changes', () => {
    const content1 = '# Test 1'
    const content2 = '# Test 2'

    const { rerender } = render(<SafeMarkdown>{content1}</SafeMarkdown>)

    // Clear the mock calls
    vi.clearAllMocks()

    // Re-render with different content
    rerender(<SafeMarkdown>{content2}</SafeMarkdown>)

    // DOMPurify.sanitize should be called again with new content
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(content2, expect.any(Object))
  })

  it('should handle empty content', () => {
    const content = ''
    render(<SafeMarkdown>{content}</SafeMarkdown>)

    expect(DOMPurify.sanitize).toHaveBeenCalledWith('', expect.any(Object))
  })

  it('should handle multiline markdown', () => {
    const content = `# Heading

This is a paragraph.

- List item 1
- List item 2

**Bold text** and *italic text*.`

    render(<SafeMarkdown>{content}</SafeMarkdown>)

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(content, expect.any(Object))
  })

  it('should configure URI regexp for link safety', () => {
    const content = '[Safe Link](https://example.com)'
    render(<SafeMarkdown>{content}</SafeMarkdown>)

    // Verify DOMPurify is configured with URI regexp
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(
      content,
      expect.objectContaining({
        ALLOWED_URI_REGEXP: expect.any(RegExp),
      })
    )
  })

  it('should render with legal variant', () => {
    const content = '# Heading'

    render(<SafeMarkdown variant="legal">{content}</SafeMarkdown>)

    // Just verify the component renders without error
    expect(DOMPurify.sanitize).toHaveBeenCalled()
  })
})
