/**
 * Check EU shipping availability for Mug and Shoe blueprints
 * These BPs have never been verified for SKAPARA (EU fulfillment)
 *
 * Usage: node scripts/_check-new-bps.mjs
 */
import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]?.trim()

const EU_COUNTRIES = ['ES', 'DE', 'FR', 'IT', 'NL', 'PL', 'GB', 'AT', 'BE', 'PT', 'IE', 'SE', 'DK', 'FI', 'CZ', 'GR', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY']

const BPS_TO_CHECK = [
  // Mugs
  { id: 175,  name: '11oz Black Mug', category: 'mugs' },
  { id: 68,   name: '15oz White Mug', category: 'mugs' },
  { id: 383,  name: 'Enamel Camping Mug', category: 'mugs' },
  { id: 621,  name: 'Ceramic Mug 11oz', category: 'mugs' },
  { id: 1320, name: 'Magic Mug (color change)', category: 'mugs' },
  // Shoes
  { id: 994,  name: 'AOP Canvas Shoe', category: 'shoes' },
  { id: 1010, name: 'Custom Low-Top', category: 'shoes' },
  { id: 618,  name: 'Lace-Up Canvas Shoe', category: 'shoes' },
  { id: 1289, name: 'Slip-On Canvas Shoe', category: 'shoes' },
  // Phone cases (future)
  { id: 82,   name: 'iPhone Tough Case', category: 'phone-cases' },
  { id: 1182, name: 'Samsung Tough Case', category: 'phone-cases' },
]

async function apiFetch(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function checkBlueprint(bp) {
  try {
    // 1. Get providers
    const providers = await apiFetch(
      `https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers.json`
    )
    if (!Array.isArray(providers) || providers.length === 0) {
      return { ...bp, status: 'NO_PROVIDERS', providers: [] }
    }

    const results = []

    for (const provider of providers) {
      // 2. Check shipping profiles for EU
      let shipsToEU = false
      let shippingCost = null
      let euCountries = []

      try {
        const shipping = await apiFetch(
          `https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers/${provider.id}/shipping.json`
        )
        for (const profile of (shipping.profiles || [])) {
          const countries = profile.countries || []
          const matchedEU = countries.filter(c =>
            EU_COUNTRIES.includes(c) || c === 'REST_OF_WORLD' || c === 'EU'
          )
          if (matchedEU.length > 0) {
            shipsToEU = true
            euCountries = matchedEU
            if (profile.first_item?.cost) {
              shippingCost = (profile.first_item.cost / 100).toFixed(2)
            }
          }
        }
      } catch {}

      // 3. Get variants + print areas
      let variantCount = 0
      let printAreas = ''
      let sampleVariants = []

      try {
        const variantData = await apiFetch(
          `https://api.printify.com/v1/catalog/blueprints/${bp.id}/print_providers/${provider.id}/variants.json`
        )
        variantCount = variantData.variants?.length || 0
        sampleVariants = (variantData.variants || []).slice(0, 3).map(v => v.title)
        const placeholders = variantData.variants?.[0]?.placeholders || []
        printAreas = placeholders.map(p => `${p.position}(${p.width}x${p.height})`).join(', ')
      } catch {}

      if (shipsToEU) {
        results.push({
          providerId: provider.id,
          providerName: provider.title,
          location: provider.location ? `${provider.location.country}/${provider.location.region}` : 'global',
          shippingCost,
          euCountries,
          variantCount,
          printAreas,
          sampleVariants,
        })
      }

      await new Promise(r => setTimeout(r, 250))
    }

    return {
      ...bp,
      status: results.length > 0 ? 'EU_OK' : 'NO_EU_SHIPPING',
      providers: results,
    }
  } catch (e) {
    return { ...bp, status: 'ERROR', error: e.message, providers: [] }
  }
}

async function main() {
  console.log('=' .repeat(70))
  console.log('  SKAPARA — Blueprint EU Shipping Check')
  console.log('  Checking mugs, shoes, and phone cases for EU fulfillment')
  console.log('=' .repeat(70))

  const mugResults = []
  const shoeResults = []
  const phoneResults = []

  for (const bp of BPS_TO_CHECK) {
    console.log(`\nChecking BP ${bp.id}: ${bp.name}...`)
    const result = await checkBlueprint(bp)

    if (result.status === 'EU_OK') {
      const best = result.providers[0]
      console.log(`  ✓ EU OK — Provider: ${best.providerId} "${best.providerName}" (${best.location})`)
      console.log(`    Shipping: $${best.shippingCost || '?'} | Variants: ${best.variantCount} | Areas: ${best.printAreas}`)
      console.log(`    Sample: ${best.sampleVariants.join(' | ')}`)
      console.log(`    EU providers total: ${result.providers.length}`)
    } else if (result.status === 'NO_EU_SHIPPING') {
      console.log(`  ✗ NO EU shipping available`)
    } else if (result.status === 'NO_PROVIDERS') {
      console.log(`  ✗ No providers found for this blueprint`)
    } else {
      console.log(`  ✗ Error: ${result.error}`)
    }

    if (bp.category === 'mugs') mugResults.push(result)
    else if (bp.category === 'shoes') shoeResults.push(result)
    else phoneResults.push(result)

    await new Promise(r => setTimeout(r, 300))
  }

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('  SUMMARY')
  console.log('='.repeat(70))

  console.log('\n--- MUGS ---')
  for (const r of mugResults) {
    const icon = r.status === 'EU_OK' ? '✓' : '✗'
    const detail = r.status === 'EU_OK'
      ? `Provider ${r.providers[0].providerId} | $${r.providers[0].shippingCost} ship | ${r.providers[0].variantCount} vars | ${r.providers[0].printAreas}`
      : r.status
    console.log(`  ${icon} BP ${r.id}: ${r.name} → ${detail}`)
  }

  console.log('\n--- SHOES ---')
  for (const r of shoeResults) {
    const icon = r.status === 'EU_OK' ? '✓' : '✗'
    const detail = r.status === 'EU_OK'
      ? `Provider ${r.providers[0].providerId} | $${r.providers[0].shippingCost} ship | ${r.providers[0].variantCount} vars | ${r.providers[0].printAreas}`
      : r.status
    console.log(`  ${icon} BP ${r.id}: ${r.name} → ${detail}`)
  }

  console.log('\n--- PHONE CASES ---')
  for (const r of phoneResults) {
    const icon = r.status === 'EU_OK' ? '✓' : '✗'
    const detail = r.status === 'EU_OK'
      ? `Provider ${r.providers[0].providerId} | $${r.providers[0].shippingCost} ship | ${r.providers[0].variantCount} vars | ${r.providers[0].printAreas}`
      : r.status
    console.log(`  ${icon} BP ${r.id}: ${r.name} → ${detail}`)
  }

  // Recommendation
  console.log('\n--- RECOMMENDATION ---')
  const bestMug = mugResults.find(r => r.status === 'EU_OK')
  const bestShoe = shoeResults.find(r => r.status === 'EU_OK')

  if (bestMug) {
    console.log(`  MUG: Use BP ${bestMug.id} (${bestMug.name}) with provider ${bestMug.providers[0].providerId}`)
  } else {
    console.log('  MUG: ✗ NO viable mug BP for EU — need alternative strategy')
  }

  if (bestShoe) {
    console.log(`  SHOE: Use BP ${bestShoe.id} (${bestShoe.name}) with provider ${bestShoe.providers[0].providerId}`)
  } else {
    console.log('  SHOE: ✗ NO viable shoe BP for EU — activate contingency plan (laptop sleeve + sticker pack)')
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
