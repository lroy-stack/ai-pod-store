import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]

// First, let's see what providers our existing products use (we know they ship to EU)
const EXISTING_BPS = [6, 793, 1446, 1447, 1108, 482, 854, 353, 693]

// New candidates to check
const NEW_BPS = [
  97,   // Satin Poster
  937,  // Matte Canvas
  220,  // Square Pillow
  429,  // Laptop Sleeve
  969,  // LED Gaming Mouse Pad
  794,  // Stickers
  879,  // Long Sleeve Crewneck
  457,  // Crew Neck Sweatshirt EU
  49,   // Heavy Blend Crewneck Sweatshirt
  648,  // Laptop Sleeve 2
  1226, // Canvas Stretched 1.5
  1380, // Custom Shaped Pillows
  45,   // Long Sleeve Crew Tee
  455,  // Hooded Zip Sweatshirt
  1192, // Lightweight Long Sleeve
  442,  // Mouse Pad EU
  1130, // Framed Poster
  608,  // Mouse Pad EU 2
  223,  // Faux Suede Pillow
  1310, // Acrylic Ornament
  531,  // Ceramic Ornament
  1434, // LED Mouse Pad 2
  1528, // Long Sleeve 3
  83,   // Tote bag (alternative ID)
  168,  // Canvas Tote (could be tote)
  474,  // Long Sleeve EU
]

async function main() {
  console.log('=== Checking existing BPs for provider pattern ===')
  const euProviderIds = new Set()

  for (const bpId of EXISTING_BPS) {
    const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bpId}/print_providers.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const providers = await r.json()
    if (!Array.isArray(providers)) continue

    for (const p of providers) {
      const loc = p.location ? `${p.location.country || '?'}/${p.location.region || '?'}` : 'no-loc'
      if (loc !== 'no-loc') euProviderIds.add(p.id)
      console.log(`  BP ${bpId}: provider ${p.id} "${p.title}" → ${loc}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }

  console.log('\n=== Known EU-capable provider IDs:', [...euProviderIds].join(', '))

  console.log('\n=== Checking NEW blueprints ===')
  for (const bpId of NEW_BPS) {
    const r = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bpId}/print_providers.json`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    })
    const providers = await r.json()
    if (!Array.isArray(providers)) {
      console.log(`✗ BP ${bpId}: API error`)
      continue
    }

    // Check if any provider ships to EU region or is a known EU provider
    const details = providers.map(p => {
      const loc = p.location ? `${p.location.country}` : 'global'
      return `${p.id}:"${p.title}" (${loc})`
    })

    // For "Printify Choice" and other providers without location, they typically ship globally
    const hasGlobal = providers.some(p => !p.location || p.title.includes('Choice') || p.title.includes('EU'))
    const hasKnownEU = providers.some(p => euProviderIds.has(p.id))

    if (hasGlobal || hasKnownEU || providers.length > 0) {
      // Get print area info
      const provider = providers[0]
      let printAreas = ''
      try {
        const vr = await fetch(`https://api.printify.com/v1/catalog/blueprints/${bpId}/print_providers/${provider.id}/variants.json`, {
          headers: { Authorization: `Bearer ${TOKEN}` }
        })
        const vd = await vr.json()
        const phs = vd.variants?.[0]?.placeholders || []
        printAreas = phs.map(p => `${p.position}(${p.width}x${p.height})`).join(', ')
      } catch {}

      console.log(`✓ BP ${bpId}: ${providers.length} providers [${details.slice(0,2).join('; ')}] | Areas: ${printAreas || '?'}`)
    } else {
      console.log(`✗ BP ${bpId}: no suitable providers`)
    }
    await new Promise(r => setTimeout(r, 400))
  }
}

main().catch(console.error)
