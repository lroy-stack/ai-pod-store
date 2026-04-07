import { unstable_cache } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { HeroCampaign } from '@/types/marketing'

export const getActiveCampaign = unstable_cache(
  async (): Promise<HeroCampaign | null> => {
    const now = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('hero_campaigns')
      .select(`
        *,
        collection:collections(
          id, slug, name, description,
          collection_products(
            position, is_featured,
            product:products(id, slug, title, base_price_cents, compare_at_price_cents, currency, images, status, avg_rating, review_count)
          )
        )
      `)
      .eq('status', 'active')
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('priority', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      console.warn('[marketing] No active campaign found:', error?.message)
      return null
    }

    // Sort collection products by position
    if (data.collection?.collection_products) {
      data.collection.collection_products.sort(
        (a: { position: number }, b: { position: number }) => a.position - b.position
      )
    }

    return data as unknown as HeroCampaign
  },
  ['active-campaign'],
  { revalidate: 60, tags: ['campaign'] }
)
