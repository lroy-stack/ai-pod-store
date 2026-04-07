/**
 * Coupons Admin API
 * GET  /api/admin/coupons - List coupons with pagination, filters, stats
 * POST /api/admin/coupons - Create a new coupon
 */

import { createClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { z } from 'zod'
import { generateSecureCode } from '@/lib/coupon-generator'

export const GET = withPermission('settings', 'read', async (req, session) => {
  try {
    const supabase = createClient()
    const url = new URL(req.url)

    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') // active, inactive, expired
    const codeType = url.searchParams.get('code_type') // public, personal, bulk
    const discountType = url.searchParams.get('discount_type') // percentage, fixed_amount
    const search = url.searchParams.get('search')?.replace(/[.,()%_*\\]/g, '').trim() || null
    const campaign = url.searchParams.get('campaign')

    const offset = (page - 1) * limit

    let query = supabase
      .from('coupons')
      .select('*', { count: 'exact' })

    // Filters
    if (status === 'active') {
      query = query.eq('active', true).or('valid_until.is.null,valid_until.gt.now()')
    } else if (status === 'inactive') {
      query = query.eq('active', false)
    } else if (status === 'expired') {
      query = query.lt('valid_until', new Date().toISOString()).eq('active', true)
    }

    if (codeType) query = query.eq('code_type', codeType)
    if (discountType) query = query.eq('discount_type', discountType)
    if (campaign) query = query.eq('campaign_name', campaign)
    if (search) query = query.ilike('code', `%${search}%`)

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: coupons, error, count } = await query

    if (error) {
      console.error('Error fetching coupons:', error)
      return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 })
    }

    // Get usage stats per coupon
    const couponIds = (coupons || []).map(c => c.id)
    let usageStats: Record<string, { total_uses: number; total_discount: number; last_used: string | null }> = {}

    if (couponIds.length > 0) {
      const { data: uses } = await supabase
        .from('coupon_uses')
        .select('coupon_id, discount_cents, created_at')
        .in('coupon_id', couponIds)

      for (const use of uses || []) {
        if (!usageStats[use.coupon_id]) {
          usageStats[use.coupon_id] = { total_uses: 0, total_discount: 0, last_used: null }
        }
        usageStats[use.coupon_id].total_uses++
        usageStats[use.coupon_id].total_discount += use.discount_cents || 0
        if (!usageStats[use.coupon_id].last_used || use.created_at > usageStats[use.coupon_id].last_used!) {
          usageStats[use.coupon_id].last_used = use.created_at
        }
      }
    }

    // Get unique campaign names for filter dropdown
    const { data: campaigns } = await supabase
      .from('coupons')
      .select('campaign_name')
      .not('campaign_name', 'is', null)

    const uniqueCampaigns = [...new Set((campaigns || []).map(c => c.campaign_name).filter(Boolean))]

    const couponsWithStats = (coupons || []).map(coupon => ({
      ...coupon,
      stats: usageStats[coupon.id] || { total_uses: 0, total_discount: 0, last_used: null },
    }))

    return NextResponse.json({
      coupons: couponsWithStats,
      total: count || 0,
      page,
      limit,
      campaigns: uniqueCampaigns,
    })
  } catch (error) {
    console.error('Error in coupons GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

const couponCreateSchema = z.object({
  code: z.string().min(3).max(50).optional(),
  description: z.string().max(200).optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  max_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().nullable().optional().default(1),
  first_purchase_only: z.boolean().default(false),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  code_type: z.enum(['public', 'personal', 'bulk']).default('public'),
  user_id: z.string().uuid().nullable().optional(),
  campaign_name: z.string().max(100).nullable().optional(),
})

export const POST = withPermission('settings', 'update', withValidation(couponCreateSchema, async (req, data, session) => {
  try {
    const supabase = createClient()

    // Auto-generate code if not provided
    const code = data.code
      ? data.code.toUpperCase().trim()
      : generateSecureCode(data.campaign_name || undefined)

    // Check for duplicate code
    const { data: existing } = await supabase
      .from('coupons')
      .select('id')
      .ilike('code', code)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'Coupon code already exists' }, { status: 409 })
    }

    const { data: coupon, error } = await supabase
      .from('coupons')
      .insert({
        code,
        description: data.description || null,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        min_purchase_amount: data.min_purchase_amount || null,
        max_discount_amount: data.max_discount_amount || null,
        usage_limit: data.usage_limit || null,
        per_user_limit: data.per_user_limit,
        first_purchase_only: data.first_purchase_only,
        valid_from: data.valid_from || new Date().toISOString(),
        valid_until: data.valid_until || null,
        code_type: data.code_type,
        user_id: data.user_id || null,
        campaign_name: data.campaign_name || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating coupon:', error)
      return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
    }

    return NextResponse.json(coupon, { status: 201 })
  } catch (error) {
    console.error('Error in coupons POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}))
