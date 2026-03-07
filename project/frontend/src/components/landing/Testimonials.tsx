import { Star, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
  locale?: string
}

const i18n: Record<string, { outOf5: string; happyCustomers: string; verified: string }> = {
  en: { outOf5: 'out of 5', happyCustomers: 'Happy Customers', verified: 'Verified' },
  es: { outOf5: 'de 5', happyCustomers: 'Clientes Felices', verified: 'Verificado' },
  de: { outOf5: 'von 5', happyCustomers: 'Zufriedene Kunden', verified: 'Verifiziert' },
}

export function Testimonials({ reviews, totalOrders, averageRating, locale = 'en' }: TestimonialsProps) {
  const t = i18n[locale] ?? i18n.en
  if (reviews.length === 0) return null

  return (
    <section className="px-6 py-24 md:py-32 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Trust Signals */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-16">
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
              <span className="font-semibold text-foreground">{averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground ml-1">{t.outOf5}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-border hidden md:block" />

          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-foreground">
              {totalOrders.toLocaleString()}+
            </div>
            <div className="text-sm text-muted-foreground">{t.happyCustomers}</div>
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="border-border/50 hover:border-primary/20 hover:shadow-lg transition-all duration-300"
            >
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
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>{t.verified}</span>
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
          ))}
        </div>
      </div>
    </section>
  )
}
