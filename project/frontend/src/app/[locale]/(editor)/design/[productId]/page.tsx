import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProductTypeFromCategory } from '@/lib/print-area-config'
import { DesignEditorClient } from './DesignEditorClient'
import { BRAND, BASE_URL } from '@/lib/store-config'

interface PageProps {
  params: Promise<{ locale: string; productId: string }>
  searchParams: Promise<{ compositionId?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, productId } = await params
  const title = `Design Editor - ${BRAND.name}`
  const description = 'Create and customize your product design with the SKAPARA design editor.'
  return {
    title,
    description,
    openGraph: { title, description, url: `${BASE_URL}/${locale}/design/${productId}`, siteName: BRAND.name, locale, type: 'website' },
    alternates: {
      canonical: `${BASE_URL}/${locale}/design/${productId}`,
      languages: { en: `${BASE_URL}/en/design/${productId}`, es: `${BASE_URL}/es/design/${productId}`, de: `${BASE_URL}/de/design/${productId}` },
    },
  }
}

export default async function DesignEditorPage({ params, searchParams }: PageProps) {
  const { productId } = await params
  const { compositionId } = await searchParams

  // Fetch product from Supabase (include design_templates for ghost templates)
  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('id, title, description, images, category, base_price_cents, design_templates, product_template_id')
    .eq('id', productId)
    .eq('status', 'active')
    .single()

  if (error || !product) {
    notFound()
  }

  // Fetch ALL enabled variants for this product (colors, sizes, prices)
  const { data: variants } = await supabaseAdmin
    .from('product_variants')
    .select('color, size, price_cents, image_url, blank_image_url, color_hex, is_available')
    .eq('product_id', productId)
    .eq('is_enabled', true)
    .order('color')
    .order('size')

  // Deduplicate colors and sizes
  const uniqueColors = [...new Set(
    (variants || []).filter(v => v.color).map(v => v.color as string)
  )]
  const uniqueSizes = [...new Set(
    (variants || []).filter(v => v.size).map(v => v.size as string)
  )]

  // Build colorImages map: color → first available image_url
  const colorImages: Record<string, string> = {}
  // Build blankImages map: color → blank garment image from Printful Catalog
  const blankImages: Record<string, string> = {}
  // Build colorHexMap: color → hex code from provider
  const colorHexMap: Record<string, string> = {}
  for (const v of (variants || [])) {
    if (v.color) {
      if (v.image_url && !colorImages[v.color]) {
        colorImages[v.color] = v.image_url
      }
      if (v.blank_image_url && !blankImages[v.color]) {
        blankImages[v.color] = v.blank_image_url
      }
      if (v.color_hex && !colorHexMap[v.color]) {
        colorHexMap[v.color] = v.color_hex
      }
    }
  }

  // Build unavailable combinations
  const unavailableCombinations = (variants || [])
    .filter(v => !v.is_available && v.color && v.size)
    .map(v => ({ color: v.color as string, size: v.size as string }))

  // Derive productType from category for blank template selection
  const productType = getProductTypeFromCategory(product.category || '')

  return (
    <DesignEditorClient
      product={{
        id: product.id,
        title: product.title,
        category: product.category || '',
        base_price_cents: product.base_price_cents || 0,
        productType,
      }}
      variants={{
        colors: uniqueColors,
        sizes: uniqueSizes,
        colorImages,
        blankImages,
        colorHexMap,
        unavailableCombinations,
      }}
      designTemplates={product.design_templates || null}
      compositionId={compositionId}
    />
  )
}
