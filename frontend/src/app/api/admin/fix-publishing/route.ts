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
import { getProvider, initializeProviders } from '@/lib/pod'
import { requireAdmin, authErrorResponse } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req)

    const report = {
      printifyTotal: 0,
      fixed: 0,
      alreadyOk: 0,
      errors: [] as string[],
      startedAt: new Date().toISOString(),
      completedAt: '',
    }

    try {
      initializeProviders()

      // 1. Fetch ALL products from provider (paginated)
      const allPrintifyProducts: Record<string, unknown>[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const result = await getProvider().listProducts({ offset: (page - 1) * 50, limit: 50 })
        allPrintifyProducts.push(...result.data.map(p => (p as any)._raw || p))

        if (result.data.length < 50) {
          hasMore = false
        } else {
          page++
        }
        if (page > 10) break
      }

      report.printifyTotal = allPrintifyProducts.length

      // 2. Build Supabase product map by provider_product_id
      const { data: supabaseProducts } = await supabaseAdmin
        .from('products')
        .select('id, slug, provider_product_id, status')
        .not('provider_product_id', 'is', null)

      const supabaseMap = new Map<string, { id: string; slug: string; status: string }>()
      for (const p of supabaseProducts || []) {
        const key = p.provider_product_id
        if (key) {
          supabaseMap.set(key, { id: p.id, slug: p.slug, status: p.status })
        }
      }

      // 3. Call publishingSucceeded for each product
      for (const product of allPrintifyProducts) {
        const pid = String(product.id)
        const existing = supabaseMap.get(pid)

        try {
          await getProvider().confirmPublishing!(
            pid,
            existing?.id || pid,
            existing ? `/shop/${existing.slug}` : `/products/${pid}`
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
  } catch (error) {
    return authErrorResponse(error)
  }
}
