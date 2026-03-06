/**
 * Fix variant color/size parsing for hat blueprints
 *
 * BP1744 (Cap): "S/M / White" was parsed as color="S/M", size="White" (WRONG)
 * BP1446 (5-Panel): "Black / White / One size" lost the 3rd part
 *
 * This script re-parses all variant titles for affected BPs using the corrected logic.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))

const SIZE_RE = /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|2X|3X|4X|5X|S\/M|L\/XL|One\s*size|\d+oz|\d+x\d+)$/i

function parseVariantTitle(title) {
  // Split on " / " (space-slash-space) to preserve "S/M" as one token
  const parts = title.split(' / ').map(p => p.trim())

  let color = null
  let size = null

  if (parts.length >= 3) {
    // Bicolor: "Black / White / One size"
    const lastPart = parts[parts.length - 1]
    if (SIZE_RE.test(lastPart)) {
      color = parts.slice(0, -1).join(' / ')
      size = lastPart
    } else {
      color = parts[0]
      size = parts[1]
    }
  } else if (parts.length === 2) {
    if (SIZE_RE.test(parts[0])) {
      // Cap: "S/M / White" → size="S/M", color="White"
      size = parts[0]
      color = parts[1]
    } else {
      // Standard: "Black / S"
      color = parts[0]
      size = parts[1]
    }
  } else {
    const isSize = SIZE_RE.test(parts[0] || '')
    size = isSize ? parts[0] : null
    color = isSize ? null : (parts[0] || null)
  }

  return { color, size }
}

async function main() {
  // Hat blueprints with known parsing issues
  const HAT_BPS = [1744, 1446, 1108, 1447, 1128, 1691, 1910]

  const { data: products } = await sb.from('products')
    .select('id, title, blueprint_id')
    .in('blueprint_id', HAT_BPS)
    .not('status', 'eq', 'deleted')

  console.log(`=== RE-PARSING VARIANTS FOR ${products.length} HAT PRODUCTS ===\n`)

  let fixed = 0, unchanged = 0, errors = 0

  for (const prod of products) {
    const { data: variants } = await sb.from('product_variants')
      .select('id, title, color, size')
      .eq('product_id', prod.id)

    if (!variants || variants.length === 0) continue

    console.log(`\n${prod.title} (BP${prod.blueprint_id}, ${variants.length} variants):`)

    for (const v of variants) {
      const { color: newColor, size: newSize } = parseVariantTitle(v.title)

      if (newColor !== v.color || newSize !== v.size) {
        const { error } = await sb.from('product_variants')
          .update({ color: newColor, size: newSize })
          .eq('id', v.id)

        if (error) {
          console.log(`  ERROR: ${v.title} → ${error.message}`)
          errors++
        } else {
          console.log(`  FIXED: "${v.title}" → color="${newColor}" size="${newSize}" (was: color="${v.color}" size="${v.size}")`)
          fixed++
        }
      } else {
        unchanged++
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`FIXED: ${fixed}`)
  console.log(`UNCHANGED: ${unchanged}`)
  console.log(`ERRORS: ${errors}`)
  console.log('='.repeat(60))
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
