'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Star, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import Image from 'next/image'
import { apiFetch } from '@/lib/api-fetch'

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
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const remainingSlots = 3 - photos.length
    const filesToAdd = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      toast.error(t('maxThreePhotos'))
    }

    // Validate file sizes (max 5MB each)
    const validFiles = filesToAdd.filter((file) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('photoTooLarge', { name: file.name }))
        return false
      }
      return true
    })

    setPhotos([...photos, ...validFiles])

    // Create previews
    validFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreviews((prev) => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

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
      // Upload photos if any
      let imageUrls: string[] = []
      if (photos.length > 0) {
        const formData = new FormData()
        photos.forEach((photo) => {
          formData.append('photos', photo)
        })

        const uploadResponse = await apiFetch('/api/reviews/upload-photos', {
          method: 'POST',
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload photos')
        }

        const uploadData = await uploadResponse.json()
        imageUrls = uploadData.urls
      }

      const response = await apiFetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          rating,
          comment: comment.trim(),
          imageUrls,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to submit review')
      }

      toast.success(t('reviewSubmitted'))
      setRating(0)
      setComment('')
      setPhotos([])
      setPhotoPreviews([])
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
            filled ? 'fill-rating text-rating' : 'text-muted-foreground'
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

          <div>
            <label htmlFor="review-photos" className="block text-sm font-medium mb-2">
              {t('addPhotos')} ({t('optional')})
            </label>
            <div className="space-y-3">
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                      <Image
                        src={preview}
                        alt={`Photo ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removePhoto(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 3 && (
                <label
                  htmlFor="review-photos"
                  className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    {t('uploadPhotos', { count: 3 - photos.length })}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {t('maxFileSize', { size: '5MB' })}
                  </span>
                  <input
                    id="review-photos"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || rating === 0} className="w-full">
            {isSubmitting ? t('submitting') : t('submitReview')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
