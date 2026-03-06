/**
 * Verify all active products have correct image format
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

async function main() {
  const { data } = await sb.from('products')
    .select('title, status, images')
    .neq('status', 'deleted')
    .order('title')

  let ok = 0, broken = 0

  for (const p of data) {
    const imgs = Array.isArray(p.images) ? p.images : []
    const first = imgs[0]
    const hasSrc = first && typeof first === 'object' && typeof first.src === 'string' && first.src.startsWith('http')

    if (hasSrc) {
      ok++
    } else {
      broken++
      const ftype = typeof first
      const tag = imgs.length === 0 ? '❌ NO IMGS' : '⚠ BAD FORMAT'
      console.log(`  ${tag}  ${p.title}  |  imgs:${imgs.length}  |  first type: ${ftype}`)
    }
  }

  console.log()
  console.log(`Total active: ${data.length}`)
  console.log(`✓ OK (object with .src): ${ok}`)
  console.log(`❌ Broken: ${broken}`)

  // Also verify the specific products user complained about
  console.log('\n─── Spot check ───')
  const checks = ['SKAPARA Grip', 'SKAPARA Step', 'SKAPARA Pack', 'SKAPARA Noir', 'GPU', 'Mushroom']
  for (const q of checks) {
    const { data: found } = await sb.from('products')
      .select('title, status, images')
      .ilike('title', `%${q}%`)
    for (const p of (found || [])) {
      const imgs = Array.isArray(p.images) ? p.images : []
      const firstSrc = imgs[0]?.src || 'N/A'
      console.log(`  ${p.status === 'deleted' ? '🗑' : '✓'} ${p.title}  |  status:${p.status}  |  imgs:${imgs.length}  |  first: ${firstSrc.substring(0, 60)}...`)
    }
  }

  // Check a sample image URL is actually accessible
  console.log('\n─── URL accessibility ───')
  const sample = data.find(p => p.images?.[0]?.src)
  if (sample) {
    const url = sample.images[0].src
    try {
      const r = await fetch(url, { method: 'HEAD' })
      console.log(`  ${sample.title}: HTTP ${r.status} (${r.headers.get('content-type')})`)
    } catch (e) {
      console.log(`  ${sample.title}: FETCH ERROR — ${e.message}`)
    }
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
