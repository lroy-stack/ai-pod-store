#!/usr/bin/env node
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

async function query(table, params = '') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
  });
  return res.json();
}

async function main() {
  // Find the product by title (no slug column)
  const products = await query('products', 'select=id,printify_id,title,status,images,provider_product_id,pod_provider,category_id,category,base_price_cents&title=ilike.*just*for*you*');

  if (!products.length) {
    console.log('Product not found by title search');
    return;
  }

  const product = products[0];
  console.log('=== PRODUCT ===');
  console.log('ID:', product.id);
  console.log('Title:', product.title);
  console.log('Status:', product.status);
  console.log('Provider:', product.pod_provider);
  console.log('Provider Product ID:', product.provider_product_id);
  console.log('Printify ID:', product.printify_id);
  console.log('Price cents:', product.base_price_cents);
  console.log('Category:', product.category);
  console.log('Category ID:', product.category_id);

  console.log('\n=== IMAGES ===');
  const images = product.images || [];
  console.log('Total images:', images.length);
  images.forEach((img, i) => {
    const src = typeof img === 'string' ? img : img.src;
    const alt = typeof img === 'string' ? '' : img.alt;
    const filename = src ? src.substring(src.lastIndexOf('/') + 1) : 'null';
    console.log(`  [${i}] alt="${alt}" => ${filename}`);
  });

  // Get variants
  const variants = await query('product_variants', `select=id,color,color_hex,size,is_enabled,is_available,price_cents,image_url,external_variant_id&product_id=eq.${product.id}&order=color,size`);

  console.log('\n=== VARIANTS ===');
  console.log('Total variants:', variants.length);

  // Group by color
  const byColor = {};
  for (const v of variants) {
    const c = v.color || 'unknown';
    if (!byColor[c]) byColor[c] = [];
    byColor[c].push(v);
  }

  for (const [color, vs] of Object.entries(byColor)) {
    const enabled = vs.filter(v => v.is_enabled);
    const withImg = vs.filter(v => v.image_url);
    const sizes = vs.map(v => v.size).join(', ');
    const imgStatus = withImg.length > 0
      ? `...${vs[0].image_url.substring(vs[0].image_url.lastIndexOf('/'))}`
      : 'NULL';
    console.log(`  ${color} (${vs[0].color_hex}): ${vs.length} total, ${enabled.length} enabled, ${withImg.length} with image_url`);
    console.log(`    Sizes: ${sizes}`);
    console.log(`    image_url: ${imgStatus}`);
  }
}

main().catch(e => console.error(e));
