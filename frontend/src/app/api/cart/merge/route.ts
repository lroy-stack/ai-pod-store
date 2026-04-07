import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAuth, authErrorResponse } from '@/lib/auth-guard'
import { STORE_DEFAULTS } from '@/lib/store-config'

const MAX_CART_QUANTITY = STORE_DEFAULTS.maxCartQuantity

/**
 * POST /api/cart/merge
 * Merge anonymous (session-based) cart items into the authenticated user's cart.
 * Called after login to preserve guest cart items.
 *
 * Merge strategy:
 * - If user already has the same product+variant in cart: add quantities (cap at MAX)
 * - If user doesn't have that item: transfer ownership from session_id to user_id
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const cookieStore = await cookies()
    const sessionId = cookieStore.get('cart-session-id')?.value

    if (!sessionId) {
      return NextResponse.json({ success: true, merged: 0 })
    }

    const userId = user.id

    // Fetch all guest cart items for this session
    const { data: guestItems, error: guestError } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('session_id', sessionId)

    if (guestError) {
      console.error('Cart merge - guest fetch error:', guestError)
      return NextResponse.json(
        { error: 'Failed to read guest cart', message: guestError.message },
        { status: 500 }
      )
    }

    if (!guestItems || guestItems.length === 0) {
      return NextResponse.json({ success: true, merged: 0 })
    }

    // Fetch user's existing cart items to detect duplicates
    const { data: userItems, error: userError } = await supabaseAdmin
      .from('cart_items')
      .select('*')
      .eq('user_id', userId)

    if (userError) {
      console.error('Cart merge - user cart fetch error:', userError)
      return NextResponse.json(
        { error: 'Failed to read user cart', message: userError.message },
        { status: 500 }
      )
    }

    const existingUserItems = userItems || []
    let mergedCount = 0
    const itemsToDelete: string[] = []

    for (const guestItem of guestItems) {
      // Check if user already has this product+variant+personalization combo
      const duplicate = existingUserItems.find(
        (ui) =>
          ui.product_id === guestItem.product_id &&
          ui.variant_id === guestItem.variant_id &&
          (ui.personalization_id ?? null) === (guestItem.personalization_id ?? null) &&
          (ui.composition_id ?? null) === (guestItem.composition_id ?? null)
      )

      if (duplicate) {
        // Merge quantities into existing user item
        const newQuantity = Math.min(duplicate.quantity + guestItem.quantity, MAX_CART_QUANTITY)
        await supabaseAdmin
          .from('cart_items')
          .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
          .eq('id', duplicate.id)

        // Mark guest item for deletion
        itemsToDelete.push(guestItem.id)
      } else {
        // Transfer ownership from session to user
        await supabaseAdmin
          .from('cart_items')
          .update({
            user_id: userId,
            session_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', guestItem.id)
      }

      mergedCount++
    }

    // Delete duplicate guest items
    if (itemsToDelete.length > 0) {
      await supabaseAdmin
        .from('cart_items')
        .delete()
        .in('id', itemsToDelete)
    }

    return NextResponse.json({ success: true, merged: mergedCount })
  } catch (error) {
    if (error instanceof Error && 'status' in error) return authErrorResponse(error)
    console.error('Cart merge error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
