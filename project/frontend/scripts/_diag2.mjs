import { readFileSync } from 'fs'
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const API = 'https://api.printify.com/v1'
const headers = { Authorization: `Bearer ${TOKEN}` }
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // BP 77 + Fulfill Engine (217) — Gildan Heavy Blend Hoodie
  console.log('═══ BP 77 + Fulfill Engine (217) ═══\n')
  const vr = await fetch(`${API}/catalog/blueprints/77/print_providers/217/variants.json`, { headers })
  const vd = await vr.json()
  const colors = [...new Set((vd.variants || []).map(v => v.options?.color || v.title?.split('/')[0]?.trim()))]
  console.log(`Variants: ${vd.variants?.length || 0}`)
  console.log(`Colors: ${colors.join(', ')}`)

  // Check a few variant titles
  if (vd.variants?.length) {
    console.log('\nSample variants:')
    for (const v of vd.variants.slice(0, 6)) {
      console.log(`  ${v.id}: ${v.title} | ${v.options?.color || '?'} / ${v.options?.size || '?'}`)
    }
  }

  await delay(500)

  // Now create a dummy product with BP 77 to see print areas
  // Actually, let's check an existing BP 77 product — or just look at what positions are available
  // We can check by looking at the blueprint info
  const br = await fetch(`${API}/catalog/blueprints/77.json`, { headers })
  const bd = await br.json()
  console.log(`\nBlueprint: ${bd.title}`)
  console.log(`Description: ${(bd.description || '').slice(0, 200)}`)

  await delay(500)

  // Check BP 455 dimensions / print area details
  console.log('\n═══ BP 455 — Checking print spec ═══\n')
  const vr455 = await fetch(`${API}/catalog/blueprints/455/print_providers/26/variants.json`, { headers })
  const vd455 = await vr455.json()
  const colors455 = [...new Set((vd455.variants || []).map(v => v.options?.color || '?'))]
  console.log(`BP 455 colors: ${colors455.join(', ')}`)
  console.log(`BP 455 variants: ${vd455.variants?.length}`)

  // Check dark colors available
  const darkColors455 = colors455.filter(c => {
    const lc = c.toLowerCase()
    return ['black', 'navy', 'dark', 'charcoal', 'anthracite'].some(k => lc.includes(k))
  })
  console.log(`Dark colors: ${darkColors455.join(', ')}`)
}

main().catch(e => console.error(e.message))
