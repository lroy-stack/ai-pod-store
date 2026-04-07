'use client'

/**
 * MessageActions — Hover toolbar for chat messages
 *
 * Assistant messages: like, dislike, copy, retry
 * User messages: copy, edit & resend
 *
 * Only shown for authenticated users.
 * Feedback persists via /api/chat/feedback.
 */

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Copy, RefreshCw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import { apiFetch } from '@/lib/api-fetch'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface MessageActionsProps {
  messageId: string
  conversationId: string | null
  role: 'user' | 'assistant'
  text: string
  onRetry?: () => void
  isAuthenticated: boolean
}

export function MessageActions({
  messageId,
  conversationId,
  role,
  text,
  onRetry,
  isAuthenticated,
}: MessageActionsProps) {
  const t = useTranslations('chat')
  const [feedback, setFeedback] = useState<1 | -1 | null>(null)
  const [copied, setCopied] = useState(false)

  if (!isAuthenticated) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const handleFeedback = async (rating: 1 | -1) => {
    if (!conversationId) return
    const newRating = feedback === rating ? null : rating

    // Optimistic update
    setFeedback(newRating)

    if (newRating !== null) {
      try {
        await apiFetch('/api/chat/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            conversationId,
            rating: newRating,
          }),
        })
      } catch {
        setFeedback(null)
      }
    }
  }

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {/* Copy */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
        onClick={handleCopy}
        aria-label={t('copy')}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      {role === 'assistant' && (
        <>
          {/* Like */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              feedback === 1
                ? 'text-success'
                : 'text-muted-foreground/60 hover:text-foreground'
            )}
            onClick={() => handleFeedback(1)}
            aria-label={t('like')}
          >
            <ThumbsUp className={cn('h-3.5 w-3.5', feedback === 1 && 'fill-current')} />
          </Button>

          {/* Dislike */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-7 w-7',
              feedback === -1
                ? 'text-destructive'
                : 'text-muted-foreground/60 hover:text-foreground'
            )}
            onClick={() => handleFeedback(-1)}
            aria-label={t('dislike')}
          >
            <ThumbsDown className={cn('h-3.5 w-3.5', feedback === -1 && 'fill-current')} />
          </Button>

          {/* Retry */}
          {onRetry && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground/60 hover:text-foreground"
              onClick={onRetry}
              aria-label={t('retry')}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  )
}
