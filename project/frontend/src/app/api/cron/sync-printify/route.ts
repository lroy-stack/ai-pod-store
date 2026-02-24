/**
 * Printify ↔ Supabase Full Reconciliation Cron
 *
 * GET /api/cron/sync-printify
 *
 * Safety net that runs every 30 minutes (Vercel cron) to catch anything
 * the webhooks or agent sync_hook may have missed.
 *
 * Steps:
 * 1. Fetch ALL products from Printify (paginated)
 * 2. Fetch ALL products from Supabase with printify_id
 * 3. Create missing products (Printify → Supabase)
 * 4. Update stale products (title, images, status differ)
 * 5. Mark orphaned products (in Supabase but not Printify) as deleted
 * 6. Fix margins below 35%
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { printify } from '@/lib/printify'
import {
  syncProductFromPrintify,
  calculateEngagementPrice,
} from '@/lib/printify-sync'
import { verifyCronSecret } from '@/lib/rate-limit'
import { acquireLock, recordRun } from '@/lib/reliability/cron-lock'

const CRON_SECRET = process.env.CRON_SECRET || process.env.PODCLAW_BRIDGE_AUTH_TOKEN

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  const cronName = 'sync-printify'

  // Auth check — timing-safe
  const authHeader = req.headers.get('authorization')
  if (!verifyCronSecret(authHeader, CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Acquire lock to prevent overlapping executions
  const lock = await acquireLock(cronName)
  if (!lock.acquired) {
    console.log(`[${cronName}] Job already running, skipping`)
    return NextResponse.json({
      skipped: true,
      reason: 'Another instance is already running',
      timestamp: new Date().toISOString()
    })
  }

  const supabase = supabaseAdmin

  const report = {
    printifyTotal: 0,
    supabaseTotal: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    marginFixed: 0,
    errors: [] as string[],
    startedAt: new Date().toISOString(),
    completedAt: '',
  }

  try {
    // -----------------------------------------------------------------------
    // 1. Fetch ALL products from Printify (paginated)
    // -----------------------------------------------------------------------
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

      // Safety: max 10 pages (1000 products)
      if (page > 10) break
    }

    report.printifyTotal = allPrintifyProducts.length

    // Build a Set of Printify IDs for fast lookup
    const printifyIdSet = new Set(
      allPrintifyProducts.map(p => String(p.id))
    )

    // -----------------------------------------------------------------------
    // 2. Fetch ALL Supabase products with printify_id
    // -----------------------------------------------------------------------
    const { data: supabaseProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, printify_id, title, status, images, cost_cents, base_price_cents')
      .not('printify_id', 'is', null)

    if (fetchError) {
      report.errors.push(`Supabase fetch error: ${fetchError.message}`)
      report.completedAt = new Date().toISOString()
      return NextResponse.json(report, { status: 500 })
    }

    const supabaseMap = new Map<string, typeof supabaseProducts[0]>()
    for (const product of supabaseProducts || []) {
      if (product.printify_id) {
        supabaseMap.set(product.printify_id, product)
      }
    }
    report.supabaseTotal = supabaseMap.size

    // -----------------------------------------------------------------------
    // 3. Printify → Supabase: create missing, update stale
    // -----------------------------------------------------------------------
    for (const printifyProduct of allPrintifyProducts) {
      const pid = String(printifyProduct.id)
      const existing = supabaseMap.get(pid)

      if (!existing) {
        // Missing from Supabase — create it
        const result = await syncProductFromPrintify(printifyProduct, supabase)
        if (result.error) {
          report.errors.push(`Create ${pid}: ${result.error}`)
        } else {
          report.created++
        }
      } else {
        // Exists — check if key fields differ
        const printifyTitle = String(printifyProduct.title || '')
        const printifyImages = ((printifyProduct.images as Array<Record<string, unknown>>) || [])
          .filter(img => img.src || img.url)
        const supabaseImages = Array.isArray(existing.images) ? existing.images : []
        const printifyVisible = printifyProduct.visible === true
        const expectedStatus = printifyVisible ? 'active' : 'draft'

        const titleChanged = printifyTitle && printifyTitle !== existing.title
        const imagesChanged = printifyImages.length > 0 && supabaseImages.length === 0
        const statusChanged = existing.status !== expectedStatus && existing.status !== 'deleted'
        // Always reconcile 'publishing' products (transitional status from sync_hook)
        const isPublishing = existing.status === 'publishing'

        // If product is stuck in publishing, try to confirm with Printify
        if (isPublishing) {
          try {
            await printify.publishingSucceeded(
              pid,
              existing.id,
              `/shop/${existing.id}`
            )
          } catch {
            // Ignore — product may already be confirmed or not in publishing state on Printify
          }
        }

        if (titleChanged || imagesChanged || statusChanged || isPublishing) {
          const result = await syncProductFromPrintify(printifyProduct, supabase)
          if (result.error) {
            report.errors.push(`Update ${pid}: ${result.error}`)
          } else {
            report.updated++
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // 4. Supabase → Printify: mark orphans as deleted
    // -----------------------------------------------------------------------
    for (const [printifyId, product] of supabaseMap) {
      if (!printifyIdSet.has(printifyId) && product.status !== 'deleted') {
        const { error } = await supabase
          .from('products')
          .update({ status: 'deleted' })
          .eq('id', product.id)

        if (error) {
          report.errors.push(`Mark deleted ${printifyId}: ${error.message}`)
        } else {
          report.deleted++
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Margin audit: fix products below 35% margin
    // -----------------------------------------------------------------------
    // Re-fetch all products (including newly created ones)
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, title, cost_cents, base_price_cents, status')
      .not('cost_cents', 'is', null)
      .gt('cost_cents', 0)
      .neq('status', 'deleted')

    for (const product of allProducts || []) {
      const cost = product.cost_cents
      const price = product.base_price_cents
      if (!cost || !price) continue

      const margin = (price - cost) / price
      if (margin < 0.35) {
        const newPrice = calculateEngagementPrice(cost, product.title || '')
        const { error } = await supabase
          .from('products')
          .update({ base_price_cents: newPrice })
          .eq('id', product.id)

        if (!error) {
          report.marginFixed++
          console.log(
            `printify-sync: margin fixed for ${product.title?.slice(0, 40)}:`,
            `${price} → ${newPrice} (cost: ${cost})`
          )
        }
      }
    }
  } catch (err) {
    report.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  }

  report.completedAt = new Date().toISOString()
  const durationMs = Date.now() - startTime
  const totalRows = report.created + report.updated + report.deleted + report.marginFixed
  const status = report.errors.length > 0 ? 'failed' : 'completed'

  // Record run completion
  await recordRun(
    cronName,
    status,
    durationMs,
    report.errors.length > 0 ? report.errors.join('; ') : undefined,
    totalRows
  )

  console.log('printify-sync cron completed:', JSON.stringify(report))
  return NextResponse.json(report)
}
