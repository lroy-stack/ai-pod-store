'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

interface ReviewFormProps {
  productId: string
  onReviewSubmitted?: () => void
}

export function ReviewForm({ productId, onReviewSubmitted }: ReviewFormProps) {
  const t = useTranslations('product')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (rating === 0) {
      toast.error(t('pleaseSelectRating'))
      return
    }

    if (comment.trim().length < 10) {
      toast.error(t('reviewTooShort'))
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          rating,
          comment: comment.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to submit review')
      }

      toast.success(t('reviewSubmitted'))
      setRating(0)
      setComment('')
      onReviewSubmitted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('reviewSubmitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStarInput = (index: number) => {
    const filled = index <= (hoverRating || rating)
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        key={index}
        onClick={() => setRating(index)}
        onMouseEnter={() => setHoverRating(index)}
        onMouseLeave={() => setHoverRating(0)}
        className="transition-transform hover:scale-110 h-auto w-auto p-1"
        aria-label={t('ratingStars', { count: index })}
      >
        <Star
          className={`w-8 h-8 ${
            filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          }`}
        />
      </Button>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('writeReview')}</CardTitle>
        <CardDescription>{t('shareYourExperience')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('yourRating')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(renderStarInput)}
            </div>
            {rating > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {rating} {t('outOf')} 5
              </p>
            )}
          </div>

          <div>
            <label htmlFor="review-comment" className="block text-sm font-medium mb-2">
              {t('yourReview')}
            </label>
            <Textarea
              id="review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('reviewPlaceholder')}
              rows={5}
              className="resize-none"
              required
              minLength={10}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('minimumCharacters', { count: 10 })}
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting || rating === 0} className="w-full">
            {isSubmitting ? t('submitting') : t('submitReview')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
