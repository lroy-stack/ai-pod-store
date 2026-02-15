/**
 * Wishlist Sync API
 *
 * POST /api/wishlist/sync
 * Merges guest wishlist items (from localStorage) into the user's server wishlist.
 * Called once on login when guest items exist.
 */

import { NextRequest } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req)
    const body = await req.json()
    const { items } = body

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'items array required' }, { status: 400 })
    }

    // Cap at 50 items to prevent abuse
    const itemsToSync = items.slice(0, 50)

    // Get or create default wishlist
    let { data: wishlists } = await supabaseAdmin
      .from('wishlists')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)

    let wishlistId: string

    if (!wishlists || wishlists.length === 0) {
      const { data: newWishlist, error: createError } = await supabaseAdmin
        .from('wishlists')
        .insert({ user_id: user.id, name: 'My Wishlist', is_public: false })
        .select('id')
        .single()

      if (createError || !newWishlist) {
        return Response.json({ error: 'Failed to create wishlist' }, { status: 500 })
      }
      wishlistId = newWishlist.id
    } else {
      wishlistId = wishlists[0].id
    }

    // Insert items individually — the partial unique index (idx_wishlist_items_no_variant)
    // correctly prevents duplicates when variant_id IS NULL.
    const insertItems = itemsToSync.map((item: { product_id: string }) => ({
      wishlist_id: wishlistId,
      product_id: item.product_id,
      variant_id: null,
    }))

    let synced = 0
    for (const item of insertItems) {
      const { error } = await supabaseAdmin
        .from('wishlist_items')
        .upsert(item, { onConflict: 'wishlist_id,product_id', ignoreDuplicates: true })
      if (!error) synced++
    }

    // Fetch merged wishlist
    const { data: mergedItems } = await supabaseAdmin
      .from('wishlist_items')
      .select('id, product_id')
      .eq('wishlist_id', wishlistId)

    return Response.json({
      success: true,
      synced,
      wishlistId,
      items: mergedItems || [],
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
