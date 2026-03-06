/**
 * Sync ALL variant images from Printify → Supabase
 *
 * The frontend maps images to color variants by matching printify_variant_id
 * in the image URL. So we need images for EVERY enabled variant, not just 8.
 *
 * Strategy: For each product, fetch from Printify, get all images with
 * variant_ids, save the `is_default` image for each variant + up to 2 extra
 * angles per variant. Also update product_variants.image_url with the default.
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const env = (key) => envFile.match(new RegExp(`${key}=(.*)`))?.[1]?.trim()
const sb = createClient(env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_KEY'))
const TOKEN = env('PRINTIFY_API_TOKEN')
const SHOP_ID = env('PRINTIFY_SHOP_ID')
const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  // Get all active products with printify_id
  const { data: products } = await sb.from('products').select('id, title, printify_id, images')
    .not('status', 'eq', 'deleted')
    .not('printify_id', 'is', null)
    .order('title')

  console.log(`=== SYNCING VARIANT IMAGES FOR ${products.length} PRODUCTS ===\n`)

  let updated = 0, variantsUpdated = 0, errors = 0

  for (const [i, prod] of products.entries()) {
    if (!prod.printify_id) continue

    try {
      await delay(600)
      const r = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/products/${prod.printify_id}.json`, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      })
      if (!r.ok) { console.log(`  [${i+1}] ${prod.title}: Printify ${r.status}`); errors++; continue }
      const pData = await r.json()

      const allPrintifyImages = pData.images || []
      if (allPrintifyImages.length === 0) {
        console.log(`  [${i+1}] ${prod.title}: 0 images in Printify`)
        continue
      }

      // Get our enabled variants from Supabase
      const { data: ourVariants } = await sb.from('product_variants')
        .select('id, printify_variant_id, color')
        .eq('product_id', prod.id)

      // Build a set of our enabled variant IDs
      const ourVarIds = new Set(ourVariants.map(v => Number(v.printify_variant_id)))

      // Collect images: for each variant, take default + up to 2 extra angles
      // Filter out size-chart images
      const relevantImages = allPrintifyImages.filter(img =>
        img.src && !img.src.includes('size-chart')
      )

      // Group by variant_id
      const byVariant = {}
      for (const img of relevantImages) {
        for (const vid of (img.variant_ids || [])) {
          if (!ourVarIds.has(vid)) continue
          if (!byVariant[vid]) byVariant[vid] = { default: null, extras: [] }
          if (img.is_default) {
            byVariant[vid].default = img.src
          } else {
            byVariant[vid].extras.push(img.src)
          }
        }
      }

      // Build final image array: default first per variant, then extras (max 3 per variant)
      const MAX_PER_VARIANT = 3
      const finalImages = []
      const variantDefaults = {} // variant_id → default image URL

      for (const [vid, imgs] of Object.entries(byVariant)) {
        const defaultImg = imgs.default || imgs.extras[0]
        if (defaultImg) {
          variantDefaults[vid] = defaultImg
          finalImages.push({ src: defaultImg, alt: prod.title, variant_id: Number(vid), is_default: true })
        }
        // Add extras
        const extras = imgs.extras.filter(e => e !== defaultImg).slice(0, MAX_PER_VARIANT - 1)
        for (const e of extras) {
          finalImages.push({ src: e, alt: prod.title, variant_id: Number(vid), is_default: false })
        }
      }

      // Check if we need to update
      const currentCount = Array.isArray(prod.images) ? prod.images.length : 0
      const newCount = finalImages.length

      if (newCount > 0) {
        // Update product images
        await sb.from('products').update({ images: finalImages }).eq('id', prod.id)

        // Update each variant's image_url
        for (const v of ourVariants) {
          const defaultUrl = variantDefaults[v.printify_variant_id]
          if (defaultUrl) {
            await sb.from('product_variants').update({ image_url: defaultUrl }).eq('id', v.id)
            variantsUpdated++
          }
        }

        if (newCount !== currentCount) {
          console.log(`  [${i+1}] ${prod.title}: ${currentCount} → ${newCount} images (${Object.keys(byVariant).length} variants)`)
          updated++
        }
      }
    } catch (e) {
      console.log(`  [${i+1}] ${prod.title}: ERROR ${e.message}`)
      errors++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`PRODUCTS UPDATED: ${updated}`)
  console.log(`VARIANTS WITH IMAGE: ${variantsUpdated}`)
  console.log(`ERRORS: ${errors}`)
  console.log('='.repeat(60))

  // Verify: check a sample product
  console.log('\n=== VERIFICATION: Dark Mode ===')
  const { data: dm } = await sb.from('products').select('images').eq('title', 'Dark Mode').single()
  const imgs = dm?.images || []
  console.log(`Images: ${imgs.length}`)
  const vids = [...new Set(imgs.map(i => i.variant_id).filter(Boolean))]
  console.log(`Variant IDs covered: ${vids.join(', ')}`)

  const { data: dmVars } = await sb.from('product_variants')
    .select('color, printify_variant_id, image_url')
    .eq('product_id', (await sb.from('products').select('id').eq('title', 'Dark Mode').single()).data?.id)
  for (const v of dmVars || []) {
    console.log(`  ${v.color}: image_url=${v.image_url ? 'YES' : 'NULL'} (pvid=${v.printify_variant_id})`)
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
