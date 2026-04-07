import type { ProductCard } from '@/types/product'

export interface WishlistItem {
  id: string
  product_id: string
  variant_id: string | null
  added_at: string
  products: ProductCard
}

export interface Wishlist {
  id: string
  name: string
  is_public: boolean
  share_token: string | null
  created_at: string
  wishlist_items: WishlistItem[]
}
