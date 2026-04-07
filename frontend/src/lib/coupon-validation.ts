/**
 * Shared coupon validation logic
 *
 * Used by:
 * - POST /api/coupons/validate (cart preview)
 * - POST /api/checkout/create-session (server-side re-validation)
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface CouponData {
  id: string
  code: string
  discount_type: 'percentage' | 'fixed_amount'
  discount_value: number
  min_purchase_amount: number | null
  max_discount_amount: number | null
  usage_limit: number | null
  times_used: number
  per_user_limit: number | null
  first_purchase_only: boolean
  user_id: string | null
  valid_from: string | null
  valid_until: string | null
  active: boolean
}

export type ValidationResult =
  | { valid: true; coupon: CouponData; discountAmount: number }
  | { valid: false; error: string }

export async function validateCoupon(params: {
  code: string
  cartTotal: number
  userId?: string | null
}): Promise<ValidationResult> {
  const { code, cartTotal, userId } = params

  // Look up coupon (case-insensitive)
  const { data: coupon, error: fetchError } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .ilike('code', code.trim())
    .eq('active', true)
    .single()

  if (fetchError || !coupon) {
    return { valid: false, error: 'Invalid coupon code' }
  }

  // Personal code enforcement — same error as "not found" to prevent enumeration
  if (coupon.user_id && coupon.user_id !== userId) {
    return { valid: false, error: 'Invalid coupon code' }
  }

  // Date range validation
  const now = new Date()
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, error: 'Coupon is not yet valid' }
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, error: 'Coupon has expired' }
  }

  // Global usage limit
  if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
    return { valid: false, error: 'Coupon usage limit reached' }
  }

  // Per-user limit
  if (userId && coupon.per_user_limit !== null) {
    const { count } = await supabaseAdmin
      .from('coupon_uses')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)

    if ((count || 0) >= coupon.per_user_limit) {
      return { valid: false, error: 'You have already used this coupon' }
    }
  }

  // First-purchase-only
  if (coupon.first_purchase_only && userId) {
    const { count } = await supabaseAdmin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['paid', 'processing', 'shipped', 'delivered'])

    if ((count || 0) > 0) {
      return { valid: false, error: 'This coupon is for first purchases only' }
    }
  }

  // Minimum purchase amount
  if (coupon.min_purchase_amount && cartTotal < Number(coupon.min_purchase_amount)) {
    return {
      valid: false,
      error: `Minimum purchase amount is €${Number(coupon.min_purchase_amount).toFixed(2)}`,
    }
  }

  // Calculate discount
  let discountAmount = 0
  if (coupon.discount_type === 'percentage') {
    discountAmount = (cartTotal * Number(coupon.discount_value)) / 100
    if (coupon.max_discount_amount && discountAmount > Number(coupon.max_discount_amount)) {
      discountAmount = Number(coupon.max_discount_amount)
    }
  } else if (coupon.discount_type === 'fixed_amount') {
    discountAmount = Number(coupon.discount_value)
  }

  // Cap at cart total
  discountAmount = Math.min(discountAmount, cartTotal)

  return {
    valid: true,
    coupon: coupon as CouponData,
    discountAmount: parseFloat(discountAmount.toFixed(2)),
  }
}
