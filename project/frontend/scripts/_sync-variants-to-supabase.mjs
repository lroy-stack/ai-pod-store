#!/usr/bin/env node
/**
 * Sync Printful sync variants to Supabase product_variants.
 * Creates rows for any Printful variants that don't exist in Supabase.
 * Also updates image_url from storage mockups.
 */
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const T = get('PRINTFUL_API_TOKEN'), S = get('PRINTFUL_STORE_ID');
const SB = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SK = get('SUPABASE_SERVICE_KEY');
const pfH = { Authorization: `Bearer ${T}`, 'X-PF-Store-Id': S, 'Content-Type': 'application/json', 'User-Agent': 'POD-AI-Store/1.0' };
const sbH = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

const delay = ms => new Promise(r => setTimeout(r, ms));

// All CC1717 + MC1087 products
const PRODUCTS = [
  { name: 'Just For You',      sync: 422030329 },
  { name: 'Next Line',         sync: 422030332 },
  { name: 'Shadow Tee',        sync: 422030396 },
  { name: 'Strawberry Count',  sync: 422030403 },
  { name: 'Three Models',      sync: 422030406 },
  { name: 'Under Where',       sync: 422030411 },
  { name: 'Option Two',        sync: 422030337 },
  { name: 'Dangerous Flag',    sync: 422030313 },
  { name: 'Ghost Tee',         sync: 422030327 },
  { name: 'Scope Creep',       sync: 422030382 },
  { name: 'Prism Tee',         sync: 422030345 },
  { name: 'Existential Dread', sync: 422030462 },
  { name: 'Plans Cancelled',   sync: 422030466 },
  { name: 'Self-Care Mode',    sync: 422030469 },
  { name: 'Social Battery',    sync: 422030473 },
  { name: 'Soup Fork',         sync: 422030479 },
];

const LIGHT_COLORS = ['Ivory', 'White', 'Vintage White'];

async function pfFetch(path) {
  const res = await fetch(`https://api.printful.com${path}`, { headers: pfH });
  const data = await res.json();
  if (data.code === 429) {
    const wait = parseInt(data.error?.message?.match(/(\d+) seconds/)?.[1] || '60');
    console.log(`    Rate limited, waiting ${wait}s...`);
    await delay(wait * 1000 + 2000);
    return pfFetch(path);
  }
  return data;
}

async function processProduct(product) {
  console.log(`\n=== ${product.name} (sync ${product.sync}) ===`);

  // 1. Find Supabase product by provider_product_id
  const dbProducts = await (await fetch(
    `${SB}/rest/v1/products?provider_product_id=eq.${product.sync}&select=id,title`,
    { headers: sbH }
  )).json();

  if (!dbProducts?.length) {
    console.log(`  ERROR: Product not found in Supabase`);
    return { name: product.name, ok: false, error: 'not in DB' };
  }
  const dbId = dbProducts[0].id;
  const slug = dbProducts[0].title.toLowerCase().replace(/\s+/g, '-');

  // 2. Get existing Supabase variants
  const existing = await (await fetch(
    `${SB}/rest/v1/product_variants?product_id=eq.${dbId}&select=external_variant_id`,
    { headers: sbH }
  )).json();
  const existingSet = new Set((existing || []).map(v => String(v.external_variant_id)));

  // 3. Get Printful sync variants
  const pfData = await pfFetch(`/store/products/${product.sync}`);
  if (pfData.code !== 200) {
    console.log(`  ERROR: Printful API error — ${pfData.error?.message || pfData.result}`);
    return { name: product.name, ok: false, error: 'pf error' };
  }
  const syncVariants = pfData.result.sync_variants;
  console.log(`  Printful variants: ${syncVariants.length}, Supabase existing: ${existingSet.size}`);

  // 4. Create missing variants
  let created = 0;
  const ts = Math.floor(Date.now() / 1000);
  const storageBase = `${SB}/storage/v1/object/public/designs/mockups/${slug}`;

  for (const sv of syncVariants) {
    if (existingSet.has(String(sv.id))) continue;

    const parts = sv.name.split(' / ');
    const color = parts[1];
    const size = parts[2];
    if (!color || !size) continue;

    const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
    const sku = `SKP-${product.name.substring(0, 8).replace(/\s/g, '-').toUpperCase()}-${color.substring(0, 4).toUpperCase()}-${size}`;
    const imageUrl = `${storageBase}/${colorSlug}-front.png?v=${ts}`;

    const row = {
      product_id: dbId,
      title: `${color} / ${size}`,
      color, size,
      is_enabled: !LIGHT_COLORS.includes(color),
      is_available: true,
      price_cents: Math.round(parseFloat(sv.retail_price) * 100),
      image_url: imageUrl,
      external_variant_id: String(sv.id),
      sku,
    };

    const res = await fetch(`${SB}/rest/v1/product_variants`, {
      method: 'POST',
      headers: { ...sbH, Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (res.ok) {
      created++;
    } else {
      const err = await res.text();
      console.log(`    FAIL: ${color}/${size} — ${res.status} ${err}`);
    }
  }

  // 5. Also update image_url for existing variants that might be missing it
  const allVariants = await (await fetch(
    `${SB}/rest/v1/product_variants?product_id=eq.${dbId}&select=id,color,image_url&is_enabled=eq.true`,
    { headers: sbH }
  )).json();

  let updated = 0;
  for (const v of allVariants || []) {
    if (v.image_url && v.image_url.includes('/mockups/')) continue;
    const colorSlug = v.color.toLowerCase().replace(/\s+/g, '-');
    const newUrl = `${storageBase}/${colorSlug}-front.png?v=${ts}`;
    const res = await fetch(`${SB}/rest/v1/product_variants?id=eq.${v.id}`, {
      method: 'PATCH',
      headers: { ...sbH, Prefer: 'return=minimal' },
      body: JSON.stringify({ image_url: newUrl }),
    });
    if (res.ok) updated++;
  }

  // 6. Disable light colors
  for (const lc of LIGHT_COLORS) {
    await fetch(`${SB}/rest/v1/product_variants?product_id=eq.${dbId}&color=eq.${encodeURIComponent(lc)}`, {
      method: 'PATCH',
      headers: { ...sbH, Prefer: 'return=minimal' },
      body: JSON.stringify({ is_enabled: false }),
    });
  }

  console.log(`  Created: ${created}, Updated image_url: ${updated}`);
  return { name: product.name, ok: true, created, updated };
}

// --only=syncId for single product
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const onlySync = onlyArg ? parseInt(onlyArg.split('=')[1], 10) : null;

let products = PRODUCTS;
if (onlySync) {
  products = PRODUCTS.filter(p => p.sync === onlySync);
}

console.log(`Syncing ${products.length} products to Supabase`);

const results = [];
for (const p of products) {
  results.push(await processProduct(p));
  await delay(2000);
}

console.log('\n=== SUMMARY ===');
results.forEach(r => {
  console.log(`  ${r.name}: ${r.ok ? 'OK' : 'FAIL'} — ${r.created || 0} created, ${r.updated || 0} updated`);
});
