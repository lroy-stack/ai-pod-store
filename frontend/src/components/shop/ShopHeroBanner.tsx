import Image from 'next/image'
import Link from 'next/link'

interface ShopHeroBannerProps {
  title: string
  subtitle: string | null
  productsLabel: string
  heroImage: string | null
  ctaText: string | null
  ctaUrl: string | null
}

export function ShopHeroBanner({ title, subtitle, productsLabel, heroImage, ctaText, ctaUrl }: ShopHeroBannerProps) {
  return (
    <div className="relative overflow-hidden h-[220px] sm:h-[260px] md:h-[300px]" style={{ flexShrink: 0 }}>
      {heroImage ? (
        <Image
          src={heroImage}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-card" />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-black/20" />

      <div className="relative z-10 flex flex-col justify-between h-full max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top: copy block */}
        <div className="flex flex-col justify-center flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white font-[family-name:var(--font-display)] leading-tight">
            {title}
          </h1>

          {subtitle && (
            <span className="mt-2.5 inline-block w-fit text-[10px] sm:text-xs tracking-widest uppercase px-3 py-1 font-medium rounded-md bg-secondary text-secondary-foreground">
              {subtitle}
            </span>
          )}

          <p className="mt-2 text-xs text-white/50">
            {productsLabel}
          </p>
        </div>

        {/* Bottom edge: CTA anchored right */}
        {ctaText && ctaUrl && (
          <div className="flex justify-end pb-4 sm:pb-5">
            <Link
              href={ctaUrl}
              className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-7 sm:py-3 text-xs sm:text-sm font-semibold tracking-wide uppercase rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {ctaText}
              <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
