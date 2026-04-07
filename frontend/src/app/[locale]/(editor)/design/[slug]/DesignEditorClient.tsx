'use client'

import dynamic from 'next/dynamic'

const DesignStudioPage = dynamic(
  () => import('@/components/design-studio/DesignStudioPage').then(m => m.DesignStudioPage),
  {
    ssr: false,
    loading: () => (
      <div className="h-dvh w-full flex items-center justify-center bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    ),
  }
)

export interface VariantInfo {
  colors: string[]
  sizes: string[]
  colorImages: Record<string, string>
  blankImages: Record<string, string>
  colorHexMap: Record<string, string>
  unavailableCombinations: Array<{ color: string; size: string }>
}

/** Printful ghost template data from products.design_templates JSONB */
export interface DesignTemplateData {
  version: number
  placements: string[]
  placement_info: Record<string, {
    template_width: number
    template_height: number
    print_area_width: number
    print_area_height: number
    print_area_left: number
    print_area_top: number
  }>
  templates: Record<string, {
    image_url: string | null
    background_color: string | null
    template_width: number
    template_height: number
    print_area_width: number
    print_area_height: number
    print_area_left: number
    print_area_top: number
    is_template_on_front: boolean
  }>
  variant_mapping: Record<string, Record<string, number>>
  color_to_variant_id: Record<string, number>
}

interface DesignEditorClientProps {
  product: {
    id: string
    slug: string
    title: string
    category: string
    base_price_cents: number
    productType: string
  }
  variants: VariantInfo
  designTemplates?: DesignTemplateData | null
  compositionId?: string
  designId?: string
}

export function DesignEditorClient({ product, variants, designTemplates, compositionId, designId }: DesignEditorClientProps) {
  return <DesignStudioPage product={product} variants={variants} designTemplates={designTemplates} compositionId={compositionId} designId={designId} />
}
