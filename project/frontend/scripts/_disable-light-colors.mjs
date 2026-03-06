#!/usr/bin/env node
/**
 * Disable light color variants that don't work with white/ghost text designs.
 * CC1717: Ivory
 * MC1087: White, Vintage White
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const url = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_KEY');
const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

// Products by catalog
const CC1717_SYNCS = [422030329, 422030332, 422030396, 422030403, 422030406, 422030411];
const MC1087_SYNCS = [422030462, 422030466, 422030469, 422030473, 422030479];
// Also include Prism Tee (already done but ensure consistency)
const PRISM_SYNC = 422030345;

async function getProductIds(syncIds) {
  const filter = syncIds.map(s => `provider_product_id.eq.${s}`).join(',');
  const res = await fetch(`${url}/rest/v1/products?or=(${filter})&select=id,title,provider_product_id`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return res.json();
}

async function disableColor(productId, productTitle, color) {
  const res = await fetch(`${url}/rest/v1/product_variants?product_id=eq.${productId}&color=eq.${encodeURIComponent(color)}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ is_enabled: false }),
  });
  const data = await res.json();
  const count = Array.isArray(data) ? data.length : 0;
  console.log(`  ${productTitle}: ${color} → disabled ${count} variants`);
  return count;
}

async function main() {
  let totalDisabled = 0;

  // CC1717 products: disable Ivory
  console.log('=== CC1717: Disabling Ivory ===');
  const cc1717 = await getProductIds([...CC1717_SYNCS, PRISM_SYNC]);
  for (const p of cc1717) {
    totalDisabled += await disableColor(p.id, p.title, 'Ivory');
  }

  // MC1087 products: disable White and Vintage White
  console.log('\n=== MC1087: Disabling White + Vintage White ===');
  const mc1087 = await getProductIds(MC1087_SYNCS);
  for (const p of mc1087) {
    totalDisabled += await disableColor(p.id, p.title, 'White');
    totalDisabled += await disableColor(p.id, p.title, 'Vintage White');
  }

  console.log(`\nTotal variants disabled: ${totalDisabled}`);
}

main().catch(e => console.error(e));
