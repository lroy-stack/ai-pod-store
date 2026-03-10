/**
 * Server-side brand config fetcher
 * Used by generateMetadata in layout.tsx for dynamic SEO
 * Uses service key for server-side access
 */

import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getCachedBrandConfig, setCachedBrandConfig } from '@/lib/cached-queries'
import { BRAND } from '@/lib/store-config'

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
  brandName: BRAND.name,
  brandTagline: BRAND.tagline,
  logoLightUrl: BRAND.logoLight,
  logoDarkUrl: BRAND.logoDark,
  seoTitles: {
    en: `${BRAND.name} — ${BRAND.tagline}`,
    es: `${BRAND.name} — Viste lo que sientes`,
    de: `${BRAND.name} — Trag, was du meinst`,
  },
  seoDescriptions: BRAND.description,
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
