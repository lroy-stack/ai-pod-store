/**
 * Bulk Coupon Generation API
 * POST /api/admin/coupons/generate - Generate multiple coupon codes
 */

import { createClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'
import { withPermission } from '@/lib/rbac'
import { withValidation } from '@/lib/validation'
import { z } from 'zod'
import { generateBulkCodes } from '@/lib/coupon-generator'

const bulkGenerateSchema = z.object({
  count: z.number().int().min(1).max(1000),
  prefix: z.string().max(10).optional(),
  description: z.string().max(200).optional(),
  discount_type: z.enum(['percentage', 'fixed_amount']),
  discount_value: z.number().positive(),
  min_purchase_amount: z.number().nonnegative().nullable().optional(),
  max_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional().default(1),
  per_user_limit: z.number().int().positive().nullable().optional().default(1),
  first_purchase_only: z.boolean().default(false),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  campaign_name: z.string().max(100).optional(),
})

export const POST = withPermission('settings', 'update', withValidation(bulkGenerateSchema, async (req, data, session) => {
  try {
    const supabase = createClient()

    const codes = generateBulkCodes(data.count, data.prefix)

    // Check for collisions with existing codes
    const { data: existing } = await supabase
      .from('coupons')
      .select('code')
      .in('code', codes)

    const existingCodes = new Set((existing || []).map(c => c.code))
    const uniqueCodes = codes.filter(code => !existingCodes.has(code))

    if (uniqueCodes.length === 0) {
      return NextResponse.json({ error: 'Failed to generate unique codes. Try again.' }, { status: 409 })
    }

    // Batch insert
    const couponsToInsert = uniqueCodes.map(code => ({
      code,
      description: data.description || `Bulk: ${data.campaign_name || 'campaign'}`,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_purchase_amount: data.min_purchase_amount || null,
      max_discount_amount: data.max_discount_amount || null,
      usage_limit: data.usage_limit,
      per_user_limit: data.per_user_limit,
      first_purchase_only: data.first_purchase_only,
      valid_from: data.valid_from || new Date().toISOString(),
      valid_until: data.valid_until || null,
      code_type: 'bulk' as const,
      campaign_name: data.campaign_name || null,
    }))

    const { data: created, error } = await supabase
      .from('coupons')
      .insert(couponsToInsert)
      .select('id, code')

    if (error) {
      console.error('Error bulk inserting coupons:', error)
      return NextResponse.json({ error: 'Failed to create coupons' }, { status: 500 })
    }

    return NextResponse.json({
      created: (created || []).length,
      requested: data.count,
      codes: (created || []).map(c => c.code),
      campaign_name: data.campaign_name || null,
    }, { status: 201 })
  } catch (error) {
    console.error('Error in bulk generate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}))
