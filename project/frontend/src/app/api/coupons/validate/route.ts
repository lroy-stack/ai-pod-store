import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, cartTotal } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Coupon code is required' },
        { status: 400 }
      )
    }

    if (!cartTotal || typeof cartTotal !== 'number' || cartTotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid cart total' },
        { status: 400 }
      )
    }

    // Look up coupon (case-insensitive)
    const { data: coupon, error: fetchError } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .ilike('code', code)
      .eq('active', true)
      .single()

    console.log('Coupon lookup:', { code, fetchError, coupon })

    if (fetchError || !coupon) {
      console.error('Coupon fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Invalid coupon code', valid: false, debug: fetchError?.message },
        { status: 404 }
      )
    }

    // Check if coupon is valid (date range)
    const now = new Date()
    const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null
    const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null

    if (validFrom && now < validFrom) {
      return NextResponse.json(
        { error: 'Coupon is not yet valid', valid: false },
        { status: 400 }
      )
    }

    if (validUntil && now > validUntil) {
      return NextResponse.json(
        { error: 'Coupon has expired', valid: false },
        { status: 400 }
      )
    }

    // Check usage limit
    if (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit) {
      return NextResponse.json(
        { error: 'Coupon usage limit exceeded', valid: false },
        { status: 400 }
      )
    }

    // Check minimum purchase amount
    if (coupon.min_purchase_amount && cartTotal < coupon.min_purchase_amount) {
      return NextResponse.json(
        {
          error: `Minimum purchase amount is $${coupon.min_purchase_amount.toFixed(2)}`,
          valid: false,
        },
        { status: 400 }
      )
    }

    // Calculate discount
    let discountAmount = 0

    if (coupon.discount_type === 'percentage') {
      discountAmount = (cartTotal * coupon.discount_value) / 100

      // Apply max discount cap if specified
      if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
        discountAmount = coupon.max_discount_amount
      }
    } else if (coupon.discount_type === 'fixed_amount') {
      discountAmount = coupon.discount_value
    }

    // Ensure discount doesn't exceed cart total
    discountAmount = Math.min(discountAmount, cartTotal)

    return NextResponse.json({
      valid: true,
      coupon: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
      },
      discount_amount: parseFloat(discountAmount.toFixed(2)),
      new_total: parseFloat((cartTotal - discountAmount).toFixed(2)),
    })
  } catch (error) {
    console.error('Coupon validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate coupon', valid: false },
      { status: 500 }
    )
  }
}
