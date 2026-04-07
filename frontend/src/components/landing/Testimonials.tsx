'use client'

import React, { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Star, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  motion,
  useInView,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react'
import { STAGGER_CONTAINER } from '@/hooks/useMotionConfig'

interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  user_name: string | null
  is_verified_purchase: boolean
  created_at: string
}

interface TestimonialsProps {
  reviews: Review[]
  totalOrders: number
  averageRating: number
}

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const prefersReducedMotion = useReducedMotion()
  const hasAnimated = useRef(false)

  const spring = useSpring(0, { stiffness: 50, damping: 20 })
  const display = useTransform(spring, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.floor(v).toLocaleString()
  )

  // Trigger spring only once when in view, inside useEffect to avoid side effects in render
  React.useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true
      spring.set(value)
    }
  }, [isInView, spring, value])

  if (prefersReducedMotion) {
    return <span ref={ref}>{decimals > 0 ? value.toFixed(decimals) : value.toLocaleString()}</span>
  }

  return <motion.span ref={ref}>{display}</motion.span>
}

export function Testimonials({ reviews, totalOrders, averageRating }: TestimonialsProps) {
  const t = useTranslations('landing.testimonials')
  if (reviews.length === 0) return null

  return (
    <section className="px-6 py-24 md:py-32 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Trust Signals */}
        <motion.div
          className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn(
                    'h-5 w-5',
                    i < Math.floor(averageRating)
                      ? 'fill-rating text-rating'
                      : 'text-muted-foreground/30'
                  )}
                />
              ))}
            </div>
            <div className="text-sm">
              <span className="font-semibold text-foreground">
                <AnimatedNumber value={averageRating} decimals={1} />
              </span>
              <span className="text-muted-foreground ml-1">{t('outOf5')}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-border hidden md:block" />

          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-foreground">
              <AnimatedNumber value={totalOrders} />+
            </div>
            <div className="text-sm text-muted-foreground">{t('happyCustomers')}</div>
          </div>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={STAGGER_CONTAINER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
        >
          {reviews.map((review, idx) => (
            <motion.div
              key={review.id}
              variants={{
                hidden: { opacity: 0, x: idx % 2 === 0 ? -30 : 30 },
                visible: {
                  opacity: 1,
                  x: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              <Card className="border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300 h-full">
                <CardContent className="p-6 space-y-4">
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            'h-4 w-4',
                            i < review.rating
                              ? 'fill-rating text-rating'
                              : 'text-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                    {review.is_verified_purchase && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span>{t('verified')}</span>
                      </div>
                    )}
                  </div>

                  {/* Title */}
                  {review.title && (
                    <h3 className="font-semibold text-sm leading-snug line-clamp-2 text-foreground">
                      {review.title}
                    </h3>
                  )}

                  {/* Body */}
                  {review.body && (
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                      {review.body}
                    </p>
                  )}

                  {/* Author */}
                  {review.user_name && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">— {review.user_name}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
