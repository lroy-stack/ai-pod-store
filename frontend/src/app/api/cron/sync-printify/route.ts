/**
 * Provider ↔ Supabase Full Reconciliation Cron
 *
 * GET /api/cron/sync-printify
 *
 * Safety net that runs every 30 minutes (Vercel cron) to catch anything
 * the webhooks or agent sync_hook may have missed.
 *
 * Steps:
 * 1. Fetch ALL products from the active provider (paginated)
 * 2. Fetch ALL products from Supabase with provider_product_id
 * 3. Create missing products (Provider → Supabase)
 * 4. Update stale products (title, images, status differ)
 * 5. Mark orphaned products (in Supabase but not Provider) as deleted
 * 6. Reconcile variant availability (is_available) with provider data
 * 7. Fix margins below 35%
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getProvider, initializeProviders } from '@/lib/pod'
import { syncProductFromProvider } from '@/lib/pod/sync'
import { auditMargins } from '@/lib/pod/sync'
import { verifyCronSecret } from '@/lib/rate-limit'
import { acquireLock, recordRun } from '@/lib/reliability/cron-lock'
import { logSyncStart, logSyncReport, alertOnSyncError, logDivergenceReport } from '@/lib/pod/monitoring'
import type { CanonicalProduct } from '@/lib/pod/models'

const CRON_SECRET = process.env.CRON_SECRET

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
    providerTotal: 0,
    supabaseTotal: 0,
    created: 0,
    updated: 0,
    deleted: 0,
    marginFixed: 0,
    availabilityFixed: 0,
    errors: [] as string[],
    startedAt: new Date().toISOString(),
    completedAt: '',
    timing: { fetchProviderMs: 0, syncProductsMs: 0, availabilityMs: 0, marginAuditMs: 0, totalMs: 0 },
  }

  try {
    initializeProviders()
    const provider = getProvider()
    logSyncStart(provider.providerId)

    // -----------------------------------------------------------------------
    // 1. Fetch ALL products from provider (paginated)
    // -----------------------------------------------------------------------
    const fetchStart = Date.now()
    const allProviderProducts: CanonicalProduct[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const result = await provider.listProducts({ offset: (page - 1) * 50, limit: 50 })
      allProviderProducts.push(...result.data)

      if (result.data.length < 50) {
        hasMore = false
      } else {
        page++
      }

      // Safety: max 10 pages (1000 products)
      if (page > 10) break
    }

    report.providerTotal = allProviderProducts.length
    report.timing.fetchProviderMs = Date.now() - fetchStart

    // Build a Set of provider product IDs for fast lookup
    const providerIdSet = new Set(
      allProviderProducts.map(p => p.externalId)
    )

    // -----------------------------------------------------------------------
    // 2. Fetch ALL Supabase products with provider_product_id
    // -----------------------------------------------------------------------
    const { data: supabaseProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, slug, provider_product_id, title, status, images, cost_cents, base_price_cents')
      .not('provider_product_id', 'is', null)

    if (fetchError) {
      report.errors.push(`Supabase fetch error: ${fetchError.message}`)
      report.completedAt = new Date().toISOString()
      return NextResponse.json(report, { status: 500 })
    }

    const supabaseMap = new Map<string, (typeof supabaseProducts)[0]>()
    for (const product of supabaseProducts || []) {
      if (product.provider_product_id) {
        supabaseMap.set(product.provider_product_id, product)
      }
    }
    report.supabaseTotal = supabaseMap.size

    // -----------------------------------------------------------------------
    // 3. Provider → Supabase: create missing, update stale
    // -----------------------------------------------------------------------
    const syncStart = Date.now()
    for (const canonical of allProviderProducts) {
      const pid = canonical.externalId
      const existing = supabaseMap.get(pid)

      if (!existing) {
        // Missing from Supabase — create via provider-agnostic sync
        const result = await syncProductFromProvider(canonical, supabase, {})
        if (result.error) {
          report.errors.push(`Create ${pid}: ${result.error}`)
        } else {
          report.created++
        }
      } else {
        // Exists — check if key fields differ
        const providerTitle = canonical.title
        const providerImages = canonical.images
        const supabaseImages = Array.isArray(existing.images) ? existing.images : []
        const expectedStatus = canonical.status === 'active' ? 'active' : 'draft'

        const titleChanged = providerTitle && providerTitle !== existing.title
        const hasInvalidImages = supabaseImages.length > 0 && typeof supabaseImages[0] === 'string'
        const hasDuplicateImages = supabaseImages.length > providerImages.length * 1.5
        const imagesChanged = providerImages.length > 0 && (supabaseImages.length === 0 || hasInvalidImages || hasDuplicateImages)
        const statusChanged = existing.status !== expectedStatus && existing.status !== 'deleted'
        const isPublishing = existing.status === 'publishing'

        // If product is stuck in publishing, try to confirm with provider
        if (isPublishing) {
          try {
            await provider.confirmPublishing!(
              pid,
              existing.id,
              `/shop/${existing.slug}`
            )
          } catch {
            // Ignore — product may already be confirmed or not in publishing state
          }
        }

        if (titleChanged || imagesChanged || statusChanged || isPublishing) {
          const result = await syncProductFromProvider(canonical, supabase, {})
          if (result.error) {
            report.errors.push(`Update ${pid}: ${result.error}`)
          } else {
            report.updated++
          }
        }
      }
    }
    report.timing.syncProductsMs = Date.now() - syncStart

    // -----------------------------------------------------------------------
    // 4. Supabase → Provider: mark orphans as deleted
    // -----------------------------------------------------------------------
    for (const [providerProductId, product] of supabaseMap) {
      if (!providerIdSet.has(providerProductId) && product.status !== 'deleted') {
        const { error } = await supabase
          .from('products')
          .update({ status: 'deleted' })
          .eq('id', product.id)

        if (error) {
          report.errors.push(`Mark deleted ${providerProductId}: ${error.message}`)
        } else {
          report.deleted++
        }
      }
    }

    // -----------------------------------------------------------------------
    // 5. Availability reconciliation: compare provider vs DB variant availability
    // -----------------------------------------------------------------------
    const availStart = Date.now()
    try {
      // Build provider truth map: external_variant_id → isAvailable
      const providerAvailMap = new Map<string, boolean>()
      for (const canonical of allProviderProducts) {
        for (const v of canonical.variants) {
          if (v.externalId) {
            providerAvailMap.set(v.externalId, v.isAvailable !== false)
          }
        }
      }

      // Fetch current DB variant availability (only products we know about)
      const { data: dbVariants, error: varErr } = await supabase
        .from('product_variants')
        .select('id, external_variant_id, is_available, product_id')
        .in('product_id', (supabaseProducts || []).map(p => p.id))

      if (varErr) {
        report.errors.push(`Availability fetch error: ${varErr.message}`)
      } else if (dbVariants && dbVariants.length > 0) {
        // Find variants where availability differs
        const toUpdate: { id: string; is_available: boolean }[] = []
        for (const dbv of dbVariants) {
          const extId = dbv.external_variant_id
          if (!extId) continue
          const providerAvail = providerAvailMap.get(extId)
          if (providerAvail === undefined) continue // variant not in provider data
          if (dbv.is_available !== providerAvail) {
            toUpdate.push({ id: dbv.id, is_available: providerAvail })
          }
        }

        // Batch update divergent variants
        if (toUpdate.length > 0) {
          // Group by target availability to minimize queries
          const setTrue = toUpdate.filter(v => v.is_available).map(v => v.id)
          const setFalse = toUpdate.filter(v => !v.is_available).map(v => v.id)

          if (setTrue.length > 0) {
            const { error } = await supabase
              .from('product_variants')
              .update({ is_available: true })
              .in('id', setTrue)
            if (error) report.errors.push(`Availability update (true): ${error.message}`)
          }

          if (setFalse.length > 0) {
            const { error } = await supabase
              .from('product_variants')
              .update({ is_available: false })
              .in('id', setFalse)
            if (error) report.errors.push(`Availability update (false): ${error.message}`)
          }

          report.availabilityFixed = toUpdate.length
          console.log(`[sync] Availability reconciled: ${setTrue.length} restocked, ${setFalse.length} out-of-stock`)
        }
      }
    } catch (availErr) {
      report.errors.push(`Availability reconciliation: ${availErr instanceof Error ? availErr.message : String(availErr)}`)
    }
    report.timing.availabilityMs = Date.now() - availStart

    // -----------------------------------------------------------------------
    // 6. Margin audit: fix products below 35% margin
    // -----------------------------------------------------------------------
    const marginStart = Date.now()
    const marginResult = await auditMargins(supabase)
    report.marginFixed = marginResult.fixed
    report.timing.marginAuditMs = Date.now() - marginStart
    if (marginResult.errors.length > 0) {
      report.errors.push(...marginResult.errors)
    }

    // -----------------------------------------------------------------------
    // 7. Divergence check (10% sampling)
    // -----------------------------------------------------------------------
    if (Math.random() < 0.10) {
      try {
        const { detectDivergence } = await import('@/lib/reliability/divergence-detector')
        const divergenceResult = await detectDivergence()
        logDivergenceReport({
          checked: divergenceResult.totalProductsChecked,
          divergent: divergenceResult.totalDivergencesFound,
          details: divergenceResult.divergences.map(d => `${d.productId}: ${d.field}`),
        })
      } catch (divErr) {
        console.warn('Divergence check failed (non-critical):', divErr)
      }
    }
  } catch (err) {
    report.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  }

  report.completedAt = new Date().toISOString()
  const durationMs = Date.now() - startTime
  report.timing.totalMs = durationMs
  const totalRows = report.created + report.updated + report.deleted + report.marginFixed + report.availabilityFixed
  const status = report.errors.length > 0 ? 'failed' : 'completed'

  // Log sync report via monitoring
  logSyncReport({
    providerTotal: report.providerTotal,
    supabaseTotal: report.supabaseTotal,
    created: report.created,
    updated: report.updated,
    deleted: report.deleted,
    marginFixed: report.marginFixed,
    errors: report.errors,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    durationMs,
  })

  // Alert on critical errors
  await alertOnSyncError({
    providerTotal: report.providerTotal,
    supabaseTotal: report.supabaseTotal,
    created: report.created,
    updated: report.updated,
    deleted: report.deleted,
    marginFixed: report.marginFixed,
    errors: report.errors,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    durationMs,
  })

  // Record run completion
  await recordRun(
    cronName,
    status,
    durationMs,
    report.errors.length > 0 ? report.errors.join('; ') : undefined,
    totalRows
  )

  console.log('provider-sync cron completed:', JSON.stringify(report))
  return NextResponse.json(report)
}
