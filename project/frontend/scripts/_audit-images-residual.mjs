import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()

const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP = env('PRINTIFY_SHOP_ID')
const SB_URL = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL')
const SB_KEY = env('SUPABASE_SERVICE_KEY')
const sb = createClient(SB_URL, SB_KEY)

const PRODUCTS = {
  2: { name: 'Bug Reporter',    pid: '69a38b2546730b56700a4018', sid: '743f1925-cb78-4ad9-a73d-3c29be80464d' },
  3: { name: 'Sudo Ice Cream',  pid: '69a38b5d1ec5ca402c0352e0', sid: '8982c0a2-1761-44bd-884f-d861592099aa' },
  4: { name: 'Bedtime 404',     pid: '69a38b853b12a90c8e089201', sid: '8aa671b9-5dad-41b8-887f-27c27e8520c7' },
  5: { name: 'Ctrl+Z Homework', pid: '69a38bac5a653e214b0be2f4', sid: '2c0e6015-6b4c-4713-948a-a58efb96cbb0' },
  6: { name: 'AI Raised Me',    pid: '69a38bda3b12a90c8e08920c', sid: '62c85f65-3d67-4961-9024-ab45e7100b57' },
  7: { name: 'Code Works',      pid: '69a38c03874d66e74c0ea105', sid: '9805dca8-5179-4312-8963-0018248aa315' },
}

async function api(endpoint) {
  const r = await fetch(`https://api.printify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  return r.json()
}

async function main() {
  for (const [num, p] of Object.entries(PRODUCTS)) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  #${num} ${p.name}`)
    console.log('═'.repeat(60))

    // ── Printify images ──
    const prod = await api(`/shops/${SHOP}/products/${p.pid}.json`)
    const pImages = (prod.images || []).filter(i => i.src)
    console.log(`\n  PRINTIFY (${pImages.length} images):`)
    pImages.forEach((img, i) => {
      const label = img.src.match(/camera_label=([^&]+)/)?.[1] || 'no-label'
      const varCount = img.variant_ids?.length || 0
      console.log(`    [${i}] default:${img.is_default} label:${label} variants:${varCount}`)
      // Show truncated URL to identify old vs new
      const urlId = img.src.match(/\/([a-f0-9-]+)\.(jpg|png)/)?.[1]?.slice(0,12) || img.src.slice(-40)
      console.log(`         url_id: ...${urlId}`)
    })

    // ── Supabase images ──
    const { data: sbProd } = await sb.from('products').select('images').eq('id', p.sid).single()
    const sbImages = sbProd?.images || []
    console.log(`\n  SUPABASE (${sbImages.length} images):`)
    sbImages.forEach((img, i) => {
      const label = (img.src || '').match(/camera_label=([^&]+)/)?.[1] || 'no-label'
      const varCount = img.variant_ids?.length || 0
      console.log(`    [${i}] default:${img.is_default} label:${label} variants:${varCount}`)
      const urlId = (img.src || '').match(/\/([a-f0-9-]+)\.(jpg|png)/)?.[1]?.slice(0,12) || (img.src || '').slice(-40)
      console.log(`         url_id: ...${urlId}`)
    })

    // ── Check mismatches ──
    const pUrls = new Set(pImages.map(i => i.src))
    const sbUrls = new Set(sbImages.map(i => i.src))
    
    const residualInSb = sbImages.filter(i => !pUrls.has(i.src))
    const missingInSb = pImages.filter(i => !sbUrls.has(i.src))
    
    if (residualInSb.length > 0) {
      console.log(`\n  ⚠ RESIDUAL in Supabase (not in Printify): ${residualInSb.length}`)
      residualInSb.forEach(img => {
        const label = (img.src || '').match(/camera_label=([^&]+)/)?.[1] || 'no-label'
        console.log(`    - label:${label}`)
      })
    }
    if (missingInSb.length > 0) {
      console.log(`\n  ⚠ MISSING in Supabase (in Printify but not synced): ${missingInSb.length}`)
      missingInSb.forEach(img => {
        const label = img.src.match(/camera_label=([^&]+)/)?.[1] || 'no-label'
        console.log(`    - label:${label}`)
      })
    }
    if (residualInSb.length === 0 && missingInSb.length === 0) {
      console.log(`\n  ✓ Images in sync`)
    }

    // ── Check variant image_urls ──
    const { data: vars } = await sb.from('product_variants')
      .select('title, image_url, color')
      .eq('product_id', p.sid)
      .eq('is_enabled', true)
    
    const backUrls = (vars || []).filter(v => v.image_url?.includes('camera_label=back'))
    const noUrl = (vars || []).filter(v => !v.image_url)
    
    if (backUrls.length > 0) {
      console.log(`\n  ⚠ VARIANTS pointing to BACK mockup: ${backUrls.length}/${vars.length}`)
      backUrls.slice(0,3).forEach(v => console.log(`    - "${v.title}" → back`))
    }
    if (noUrl.length > 0) {
      console.log(`  ⚠ VARIANTS with NO image_url: ${noUrl.length}/${vars.length}`)
    }
    if (backUrls.length === 0 && noUrl.length === 0) {
      console.log(`  ✓ All variant image_urls point to front`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
