#!/usr/bin/env node
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const url = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const key = get('SUPABASE_SERVICE_KEY');

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function main() {
  // Get products with null category but valid category_id
  const res = await fetch(`${url}/rest/v1/products?category=is.null&category_id=not.is.null&select=id,title,category_id`, { headers });
  const products = await res.json();
  if (!Array.isArray(products)) {
    console.log('Unexpected response:', JSON.stringify(products).slice(0, 200));
    return;
  }
  console.log(`Products with null category: ${products.length}`);

  if (products.length === 0) {
    console.log('Nothing to fix');
    return;
  }

  // Get all categories
  const catRes = await fetch(`${url}/rest/v1/categories?select=id,slug`, { headers });
  const categories = await catRes.json();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.slug]));

  // Update each product
  let ok = 0, fail = 0;
  for (const p of products) {
    const slug = catMap[p.category_id];
    if (!slug) {
      console.log(`  SKIP ${p.title} - no category slug for ${p.category_id}`);
      fail++;
      continue;
    }

    const upd = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ category: slug }),
    });

    if (upd.ok) {
      console.log(`  OK ${p.title} -> ${slug}`);
      ok++;
    } else {
      console.log(`  FAIL ${p.title} ${upd.status} ${await upd.text()}`);
      fail++;
    }
  }
  console.log(`\nDone: ${ok} ok, ${fail} failed`);
}

main().catch(e => console.error(e));
