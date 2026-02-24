/**
 * Server-side brand config fetcher
 * Used by generateMetadata in layout.tsx for dynamic SEO
 * Uses service key for server-side access
 */

import { createClient } from '@supabase/supabase-js'

export interface BrandConfig {
  brandName: string
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
  brandName: 'Skapara',
  seoTitles: {
    en: 'Skapara — AI-Powered Print on Demand Store',
    es: 'Skapara — Tienda de Impresión bajo Demanda con IA',
    de: 'Skapara — KI-gestützter Print-on-Demand-Shop',
  },
  seoDescriptions: {
    en: 'Create custom designs with AI and get them printed on premium products. Your AI-powered print-on-demand marketplace.',
    es: 'Crea diseños personalizados con IA e imprímelos en productos premium. Tu tienda de impresión bajo demanda impulsada por IA.',
    de: 'Erstelle individuelle Designs mit KI und lass sie auf Premium-Produkte drucken. Dein KI-gesteuerter Print-on-Demand-Marktplatz.',
  },
}

/**
 * Fetches brand config from database
 * Falls back to hardcoded defaults if fetch fails
 */
export async function getBrandConfig(): Promise<BrandConfig> {
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
      .select('brand_name, seo_titles, seo_descriptions')
      .eq('is_active', true)
      .single()

    if (error || !data) {
      console.warn('Failed to fetch brand config, using fallback:', error)
      return fallbackConfig
    }

    return {
      brandName: data.brand_name || fallbackConfig.brandName,
      seoTitles: data.seo_titles || fallbackConfig.seoTitles,
      seoDescriptions: data.seo_descriptions || fallbackConfig.seoDescriptions,
    }
  } catch (error) {
    console.error('Exception fetching brand config:', error)
    return fallbackConfig
  }
}
