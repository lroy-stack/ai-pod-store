import { NextRequest, NextResponse } from 'next/server'
import { couponLimiter } from '@/lib/rate-limit'
import { validateCoupon } from '@/lib/coupon-validation'
import { getAuthUser } from '@/lib/auth-guard'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const { success } = couponLimiter.check(ip)
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await request.json()
    const { code, cartTotal } = body

    // Derive userId from auth token — never trust client-supplied userId
    const authUser = await getAuthUser(request)
    const userId = authUser?.id

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Coupon code is required', valid: false },
        { status: 400 }
      )
    }

    if (!cartTotal || typeof cartTotal !== 'number' || cartTotal <= 0) {
      return NextResponse.json(
        { error: 'Invalid cart total', valid: false },
        { status: 400 }
      )
    }

    const result = await validateCoupon({
      code,
      cartTotal,
      userId: typeof userId === 'string' ? userId : undefined,
    })

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error, valid: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        code: result.coupon.code,
        discount_type: result.coupon.discount_type,
        discount_value: result.coupon.discount_value,
      },
      discount_amount: result.discountAmount,
      new_total: parseFloat((cartTotal - result.discountAmount).toFixed(2)),
    })
  } catch (error) {
    console.error('Coupon validation error:', error)
    return NextResponse.json(
      { error: 'Failed to validate coupon', valid: false },
      { status: 500 }
    )
  }
}
