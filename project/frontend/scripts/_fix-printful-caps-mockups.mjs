#!/usr/bin/env node
/**
 * Fix Printful Caps Mockups — Download previews, upload to Supabase, update DB
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(import.meta.dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SB_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_KEY;
const PF_TOKEN = env.PRINTFUL_API_TOKEN;
const PF_STORE = env.PRINTFUL_STORE_ID || '17795695';
const ts = Math.floor(Date.now() / 1000);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const PRODUCTS = [
  {
    name: 'Assignment',
    pfId: '422465243',
    dbId: '919247bf-c114-4455-8275-17c6021ced5a',
    storagePath: 'mockups/caps-assignment',
  },
  {
    name: 'AI Wrote This',
    pfId: '422465247',
    dbId: '151fb51e-e9ae-4971-89cf-7492e4ad55c0',
    storagePath: 'mockups/caps-ai-wrote-this',
  },
  {
    name: 'Dark Mode',
    pfId: '422465253',
    dbId: '547be69f-e607-4738-9580-9e6fde126150',
    storagePath: 'mockups/caps-dark-mode',
  },
  {
    name: 'It Works',
    pfId: '422465259',
    dbId: '6f5d02bc-ec47-47c4-88e4-71d7c32fe095',
    storagePath: 'mockups/caps-it-works',
  },
];

async function main() {
  console.log('═══ Fix Printful Caps Mockups ═══\n');

  for (const product of PRODUCTS) {
    console.log(`── ${product.name} (PF: ${product.pfId}) ──`);

    // Get sync variants with preview URLs
    const pfRes = await fetch(`https://api.printful.com/store/products/${product.pfId}`, {
      headers: {
        'Authorization': `Bearer ${PF_TOKEN}`,
        'X-PF-Store-Id': PF_STORE,
        'User-Agent': 'POD-AI-Store/1.0',
      },
    });
    const pfData = await pfRes.json();
    const variants = pfData.result?.sync_variants || [];

    if (variants.length === 0) {
      console.log(`  ⚠ No variants found — skipping`);
      continue;
    }

    const images = [];
    const variantUpdates = [];

    for (const v of variants) {
      const colorParts = v.name.split(' / ');
      const color = colorParts[1] || 'Unknown';
      const slug = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      // Find preview file
      const previewFile = v.files?.find(f => f.type === 'preview');
      if (!previewFile?.preview_url) {
        console.log(`  ⚠ ${color}: no preview URL`);
        continue;
      }

      // Download from Printful CDN
      const dlRes = await fetch(previewFile.preview_url);
      if (!dlRes.ok) {
        console.log(`  ⚠ ${color}: download failed ${dlRes.status}`);
        continue;
      }
      const buffer = Buffer.from(await dlRes.arrayBuffer());
      console.log(`  Downloaded ${color}: ${(buffer.length / 1024).toFixed(0)} KB`);

      // Upload to Supabase Storage
      const storagePath = `${product.storagePath}/${slug}.png`;
      const upRes = await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SB_KEY}`,
          'apikey': SB_KEY,
          'Content-Type': 'image/png',
          'x-upsert': 'true',
        },
        body: buffer,
      });

      if (!upRes.ok) {
        const text = await upRes.text();
        console.log(`  ⚠ ${color} upload: ${upRes.status} — ${text}`);
        continue;
      }

      const publicUrl = `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
      images.push({ src: publicUrl, alt: `${product.name} - ${color}` });
      variantUpdates.push({ color, publicUrl, variantId: v.variant_id });
      console.log(`  ✓ ${color} → Supabase`);
      await delay(300);
    }

    if (images.length === 0) {
      console.log(`  ⚠ No images to update — skipping`);
      continue;
    }

    // Update product images
    const imgRes = await fetch(`${SB_URL}/rest/v1/products?id=eq.${product.dbId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ images }),
    });

    if (!imgRes.ok) {
      const text = await imgRes.text();
      console.log(`  ⚠ Product images: ${imgRes.status} — ${text}`);
    } else {
      console.log(`  ✓ Product images updated (${images.length} mockups)`);
    }

    // Update variant image_urls
    for (const vu of variantUpdates) {
      const vRes = await fetch(
        `${SB_URL}/rest/v1/product_variants?product_id=eq.${product.dbId}&external_variant_id=eq.${vu.variantId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${SB_KEY}`,
            'apikey': SB_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({ image_url: vu.publicUrl }),
        }
      );

      if (!vRes.ok) {
        const text = await vRes.text();
        console.log(`  ⚠ Variant ${vu.color}: ${vRes.status} — ${text}`);
      } else {
        console.log(`  ✓ Variant image: ${vu.color}`);
      }
    }

    console.log('');
    await delay(1000);
  }

  console.log('═══ COMPLETE ═══');
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
