import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserTier } from '@/lib/usage-limiter'

export interface ChatToolsContext {
  supabase: SupabaseClient
  chatUserId: string | null
  chatUserTier: UserTier
  chatLocale: string
  cartSessionId: string | null
  fpId: string | null
  ip: string
}

export interface FormattedProduct {
  id: string
  title: string
  description: string
  category: string
  price: number
  compareAtPrice?: number
  currency: string
  image: string | null
  rating: number
  reviewCount: number
  variants?: {
    sizes: string[]
    colors: string[]
    colorImages: Record<string, string>
  }
}
