import { readFileSync } from 'fs'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const TOKEN = envFile.match(/PRINTIFY_API_TOKEN=(.*)/)?.[1]
const SHOP_ID = envFile.match(/PRINTIFY_SHOP_ID=(.*)/)?.[1]

// Known EU-friendly providers from our existing products:
// - 26: Textildruck Europa (German name = EU fulfillment)
// - 99: Printify Choice (global routing, has EU warehouses)
// - 410: Printful (has EU/Latvian warehouses)
// - 217: Fulfill Engine
// - 41: Duplium

// Top candidates with EU-friendly providers + unique product types:
const CANDIDATES = [
  { bp: 457,  provider: 26,  name: 'Crew Neck Sweatshirt EU (Textildruck Europa)', area: 'front(3366x4230)' },
  { bp: 455,  provider: 26,  name: 'Hooded Zip Sweatshirt (Textildruck Europa)', area: 'front(2776x2285)' },
  { bp: 879,  provider: 217, name: 'Long Sleeve Crewneck (Fulfill Engine)', area: 'front(2752x3142)' },
  { bp: 1192, provider: 217, name: 'Lightweight Long Sleeve (Fulfill Engine)', area: 'front(2728x3092)' },
  { bp: 97,   provider: 99,  name: 'Satin Poster (Printify Choice)', area: 'front(4200x3300)' },
  { bp: 969,  provider: 90,  name: 'LED Gaming Mouse Pad (Smart Printee)', area: 'front(7205x3661)' },
  { bp: 429,  provider: 1,   name: 'Laptop Sleeve (SPOKE)', area: 'front(3600x2700)' },
  { bp: 220,  provider: 10,  name: 'Square Pillow (MWW)', area: 'front(4650x2325)' },
  { bp: 794,  provider: 73,  name: 'Stickers Square (Printed Simply)', area: 'front(600x600)' },
  { bp: 1130, provider: 66,  name: 'Framed Poster (Prima Printing)', area: 'front(4276x3366)' },
  { bp: 442,  provider: 30,  name: 'Mouse Pad EU (OPT OnDemand)', area: 'front(2894x2421)' },
  { bp: 49,   provider: 26,  name: 'Heavy Crewneck Sweatshirt (Textildruck EU)', area: 'front(4091x4624)' },
]

// Check shipping to a EU country (Spain) for each
async function main() {
  console.log('Checking EU shipping availability (to ES/Spain)...\n')

  for (const c of CANDIDATES) {
    try {
      // Get first variant for this bp+provider
      const vr = await fetch(`https://api.printify.com/v1/catalog/blueprints/${c.bp}/print_providers/${c.provider}/variants.json`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      })
      const vd = await vr.json()
      const firstVariant = vd.variants?.[0]
      if (!firstVariant) {
        console.log(`✗ BP ${c.bp}: no variants`)
        continue
      }

      // Try shipping calc to Spain
      const sr = await fetch(`https://api.printify.com/v1/catalog/blueprints/${c.bp}/print_providers/${c.provider}/shipping.json`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      })
      const shipping = await sr.json()

      // Check if there's EU/ES/REST_OF_WORLD shipping profile
      const hasEU = shipping.profiles?.some(p =>
        p.countries?.some(ct => ct === 'ES' || ct === 'DE' || ct === 'EU' || ct === 'REST_OF_WORLD')
      )
      const euProfile = shipping.profiles?.find(p =>
        p.countries?.some(ct => ct === 'ES' || ct === 'DE' || ct === 'EU' || ct === 'REST_OF_WORLD')
      )

      if (hasEU && euProfile) {
        const cost = euProfile.first_item?.cost ? (euProfile.first_item.cost / 100).toFixed(2) : '?'
        console.log(`✓ BP ${c.bp} ${c.name} → Ships to EU! Cost: $${cost} | ${c.area} | Variants: ${vd.variants.length}`)
      } else {
        // Check all profiles for any EU country
        const allCountries = shipping.profiles?.flatMap(p => p.countries || []) || []
        const anyEU = allCountries.some(c => ['ES','DE','FR','IT','NL','PL','GB','AT','BE','PT'].includes(c))
        if (anyEU) {
          console.log(`✓ BP ${c.bp} ${c.name} → Has EU countries in profiles | ${c.area}`)
        } else {
          console.log(`? BP ${c.bp} ${c.name} → Countries: ${allCountries.slice(0, 5).join(',')}...`)
        }
      }
    } catch (e) {
      console.log(`✗ BP ${c.bp}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 400))
  }
}

main().catch(console.error)
