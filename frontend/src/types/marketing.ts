export interface HeroCampaign {
  id: string
  slug: string
  name: string
  status: 'draft' | 'scheduled' | 'active' | 'archived'
  priority: number
  starts_at: string | null
  ends_at: string | null
  title: Record<string, string>
  subtitle: Record<string, string>
  cta_text: Record<string, string>
  cta_url: string
  sub_cta_text: Record<string, string>
  image_url: string | null
  image_alt: Record<string, string>
  shop_hero_image_url: string | null
  og_image_url: string | null
  collection_id: string | null
  collection: Collection | null
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  slug: string
  name: Record<string, string>
  description: Record<string, string>
  status: 'draft' | 'active' | 'archived'
  sort_order: number
  collection_products: CollectionProduct[]
}

export interface CollectionProduct {
  position: number
  is_featured: boolean
  product: CollectionProductData
}

export interface CollectionProductData {
  id: string
  slug: string
  title: string
  base_price_cents: number
  compare_at_price_cents: number | null
  currency: string
  images: Array<{ src: string; alt?: string }>
  status: string
  avg_rating: number
  review_count: number
}
