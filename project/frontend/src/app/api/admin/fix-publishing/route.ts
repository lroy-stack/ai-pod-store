/**
 * Admin: Fix Stuck "Publishing" Products
 *
 * GET /api/admin/fix-publishing
 *
 * One-time utility to call publishingSucceeded for all products that are
 * stuck in Printify's "publishing" state. This is needed because the codebase
 * was missing the publishing_succeeded.json call required by custom integrations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { printify } from '@/lib/printify'

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

export async function GET(req: NextRequest) {
  // Auth check — requires CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const report = {
    printifyTotal: 0,
    fixed: 0,
    alreadyOk: 0,
    errors: [] as string[],
    startedAt: new Date().toISOString(),
    completedAt: '',
  }

  try {
    // 1. Fetch ALL products from Printify (paginated)
    const allPrintifyProducts: Record<string, unknown>[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await printify.listProducts(page, 100)
      const products = result.data || []
      allPrintifyProducts.push(...products)

      if (products.length < 100) {
        hasMore = false
      } else {
        page++
      }
      if (page > 10) break
    }

    report.printifyTotal = allPrintifyProducts.length

    // 2. Build Supabase product map by printify_id
    const { data: supabaseProducts } = await supabaseAdmin
      .from('products')
      .select('id, printify_id, status')
      .not('printify_id', 'is', null)

    const supabaseMap = new Map<string, { id: string; status: string }>()
    for (const p of supabaseProducts || []) {
      if (p.printify_id) {
        supabaseMap.set(p.printify_id, { id: p.id, status: p.status })
      }
    }

    // 3. Call publishingSucceeded for each product
    for (const product of allPrintifyProducts) {
      const pid = String(product.id)
      const existing = supabaseMap.get(pid)

      try {
        await printify.publishingSucceeded(
          pid,
          existing?.id || pid,
          existing ? `/shop/${existing.id}` : `/products/${pid}`
        )
        report.fixed++

        // Also update Supabase status if it was stuck in 'publishing'
        if (existing?.status === 'publishing') {
          await supabaseAdmin
            .from('products')
            .update({
              status: 'active',
              published_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // 4xx errors are expected for products not in publishing state
        if (msg.includes('400') || msg.includes('404')) {
          report.alreadyOk++
        } else {
          report.errors.push(`${pid}: ${msg}`)
        }
      }
    }
  } catch (err) {
    report.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  }

  report.completedAt = new Date().toISOString()
  console.log('fix-publishing completed:', JSON.stringify(report))
  return NextResponse.json(report)
}
