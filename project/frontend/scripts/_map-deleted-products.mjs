import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(import.meta.dirname, '..')
const envFile = readFileSync(join(ROOT, '.env.local'), 'utf8')
const env = (k) => envFile.match(new RegExp(`${k}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

async function main() {
  const { data: deleted, error } = await sb.from('products')
    .select('id, title, blueprint_id, print_provider_id, category_id, description')
    .eq('status', 'deleted')
    .order('title')

  if (error) { console.error('DB error:', error.message); return }

  // Get variants for pricing
  const ids = deleted.map(d => d.id)
  
  const { data: cats } = await sb.from('categories').select('id, slug')
  const catMap = new Map((cats || []).map(c => [c.id, c.slug]))

  const EU_MAP = {
    'BP6/P103':    { bp: 6, prov: 26, label: 'Gildan 5000 / Textildruck EU' },
    'BP77/P217':   { bp: 77, prov: 26, label: 'Gildan 18500 / Textildruck EU' },
    'BP49/P34':    { bp: 49, prov: 26, label: 'Gildan 18000 / Textildruck EU' },
    'BP879/P217':  { bp: 80, prov: 26, label: 'Gildan 2400 LS / Textildruck EU' },
    'BP1744/P99':  { bp: 1744, prov: 410, label: 'Structured Cap / Printful' },
    'BP1691/P99':  { bp: 1691, prov: 410, label: 'Cuffed Beanie / Printful' },
    'BP1910/P99':  { bp: 1910, prov: 410, label: 'Bucket Hat / Printful' },
    'BP1446/P217': { bp: 1743, prov: 410, label: 'Snapback Trucker / Printful' },
    'BP1447/P217': { bp: 1729, prov: 410, label: 'Dad Hat / Printful' },
    'BP1108/P99':  { bp: 1744, prov: 410, label: 'Structured Cap / Printful' },
    'BP693/P75':   { bp: 1927, prov: 410, label: 'SS Tumbler / Printful' },
    'BP353/P1':    { bp: 966, prov: 86, label: 'Vagabond / Chill' },
    'BP482/P28':   { bp: 854, prov: 23, label: 'SS Bottle / WOYC' },
    'BP794/P73':   { bp: 476, prov: 30, label: 'Square Vinyl / OPT OnDemand' },
  }

  let n = 0
  const batches = []
  let current = []

  for (const p of deleted) {
    if (p.title?.startsWith('[E2E]')) continue
    if (p.title?.includes('Groovy Mushroom')) continue // was already orphaned
    n++
    const oldKey = `BP${p.blueprint_id}/P${p.print_provider_id}`
    const eu = EU_MAP[oldKey]
    const cat = catMap.get(p.category_id) || '??'
    
    current.push({ n, title: p.title, oldKey, eu, cat, desc: p.description?.substring(0, 80) || '' })
    if (current.length === 6) {
      batches.push([...current])
      current = []
    }
  }
  if (current.length > 0) batches.push(current)

  console.log(`Total a recrear: ${n} (${batches.length} batches)\n`)

  for (const [i, batch] of batches.entries()) {
    console.log(`\n═══ BATCH ${i+1} (${batch.length} productos) ═══`)
    for (const p of batch) {
      console.log(`  ${p.n}. ${p.title}`)
      console.log(`     Viejo: ${p.oldKey} → Nuevo: BP${p.eu?.bp || '?'}/P${p.eu?.prov || '?'} (${p.eu?.label || 'MANUAL'})`)
      console.log(`     Cat: ${p.cat}`)
    }
  }
}
main().catch(e => console.error('FATAL:', e.message))
