/**
 * Server-side brand config fetcher
 * Used by generateMetadata in layout.tsx for dynamic SEO
 * Uses service key for server-side access
 */

import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCachedBrandConfig, setCachedBrandConfig } from '@/lib/cached-queries'

export interface BrandConfig {
  brandName: string
  brandTagline: string
  logoLightUrl: string
  logoDarkUrl: string
  seoTitles: {
    en: string
    es: string
    de: string
  }
  seoDescriptions: {
    en: string
    es: string
    de: string
  }
}

const fallbackConfig: BrandConfig = {
  brandName: 'SKAPARA',
  brandTagline: 'Wear what you mean',
  logoLightUrl: '/brand/skapara-mark-dark.svg',
  logoDarkUrl: '/brand/skapara-mark-white.svg',
  seoTitles: {
    en: 'SKAPARA — Wear what you mean',
    es: 'SKAPARA — Viste lo que sientes',
    de: 'SKAPARA — Trag, was du meinst',
  },
  seoDescriptions: {
    en: 'Unique fashion & accessories designed with you, made in Europe. Find your next favorite piece.',
    es: 'Moda y accesorios únicos diseñados contigo, hechos en Europa. Encuentra tu próxima pieza favorita.',
    de: 'Einzigartige Mode & Accessoires mit dir gestaltet, hergestellt in Europa. Finde dein nächstes Lieblingsstück.',
  },
}

/**
 * Fetches brand config from database
 * Falls back to hardcoded defaults if fetch fails
 */
export const getBrandConfig = cache(async function getBrandConfig(): Promise<BrandConfig> {
  // Check Redis cache first
  const cached = await getCachedBrandConfig()
  if (cached) return cached as BrandConfig

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Missing Supabase credentials, using fallback brand config')
      return fallbackConfig
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('brand_config')
      .select('brand_name, brand_tagline, logo_light_url, logo_dark_url, seo_titles, seo_descriptions')
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.warn('Failed to fetch brand config, using fallback:', error)
      return fallbackConfig
    }

    const result = {
      brandName: data.brand_name || fallbackConfig.brandName,
      brandTagline: data.brand_tagline || fallbackConfig.brandTagline,
      logoLightUrl: data.logo_light_url || fallbackConfig.logoLightUrl,
      logoDarkUrl: data.logo_dark_url || fallbackConfig.logoDarkUrl,
      seoTitles: data.seo_titles || fallbackConfig.seoTitles,
      seoDescriptions: data.seo_descriptions || fallbackConfig.seoDescriptions,
    }

    // Store in Redis for cross-request caching (fire-and-forget)
    setCachedBrandConfig(result)

    return result
  } catch (error) {
    console.error('Exception fetching brand config:', error)
    return fallbackConfig
  }
})
