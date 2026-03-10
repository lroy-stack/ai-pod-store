/**
 * Single Coupon Admin API
 * PATCH  /api/admin/coupons/[id] - Update a coupon
 * DELETE /api/admin/coupons/[id] - Soft-delete (deactivate) a coupon
 */

import { createClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { z } from 'zod'

const couponUpdateSchema = z.object({
  description: z.string().max(200).optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']).optional(),
  discount_value: z.number().positive().optional(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  max_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional(),
  first_purchase_only: z.boolean().optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
  code_type: z.enum(['public', 'personal', 'bulk']).optional(),
  user_id: z.string().uuid().nullable().optional(),
  campaign_name: z.string().max(100).nullable().optional(),
  // NOTE: code is intentionally NOT updatable after creation
})

export const PATCH = withPermission('settings', 'update', withValidation(couponUpdateSchema, async (req, data, session) => {
  try {
    const supabase = createClient()
    const id = req.url.split('/coupons/')[1]?.split('/')[0]?.split('?')[0]

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID required' }, { status: 400 })
    }

    const { data: coupon, error } = await supabase
      .from('coupons')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating coupon:', error)
      return NextResponse.json({ error: 'Failed to update coupon' }, { status: 500 })
    }

    if (!coupon) {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    return NextResponse.json(coupon)
  } catch (error) {
    console.error('Error in coupon PATCH:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}))

export const DELETE = withPermission('settings', 'update', async (req: NextRequest, session: any) => {
  try {
    const supabase = createClient()
    const id = req.url.split('/coupons/')[1]?.split('/')[0]?.split('?')[0]

    if (!id) {
      return NextResponse.json({ error: 'Coupon ID required' }, { status: 400 })
    }

    // Soft delete: deactivate instead of removing (preserve audit trail)
    const { data: coupon, error } = await supabase
      .from('coupons')
      .update({ active: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error deactivating coupon:', error)
      return NextResponse.json({ error: 'Failed to deactivate coupon' }, { status: 500 })
    }

    return NextResponse.json({ success: true, coupon })
  } catch (error) {
    console.error('Error in coupon DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
