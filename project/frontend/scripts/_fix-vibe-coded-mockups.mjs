#!/usr/bin/env node
/**
 * Fix Vibe·Coded Beanie — Download Printful mockups, upload to Supabase, update DB
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
const PRODUCT_ID = '97e082fb-f6ec-4408-af10-853323b43c03';
const PF_PRODUCT_ID = '422460297';
const ts = Math.floor(Date.now() / 1000);

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const SLUG_MAP = {
  'Black': 'black',
  'Navy': 'navy',
  'Olive': 'olive',
  'Mustard': 'mustard',
  'Light Grey Melange': 'lt-grey',
  'Beige': 'beige',
  'Light Blue': 'lt-blue',
  'Acid Green': 'acid-green',
};

async function main() {
  console.log('═══ Fix Vibe·Coded Mockups ═══\n');

  // Step 1: Get preview URLs from Printful
  console.log('── Fetching Printful previews ──');
  const pfRes = await fetch(`https://api.printful.com/store/products/${PF_PRODUCT_ID}`, {
    headers: {
      'Authorization': `Bearer ${PF_TOKEN}`,
      'X-PF-Store-Id': PF_STORE,
      'User-Agent': 'POD-AI-Store/1.0',
    },
  });
  const pfData = await pfRes.json();
  const variants = pfData.result.sync_variants;

  const mockupUrls = {};
  for (const v of variants) {
    const color = v.name.split(' / ')[1];
    const slug = SLUG_MAP[color];
    const previewFile = v.files.find(f => f.type === 'preview');
    if (previewFile) {
      mockupUrls[slug] = { color, previewUrl: previewFile.preview_url, variantId: v.variant_id };
      console.log(`  ${color}: ${previewFile.preview_url.slice(0, 70)}...`);
    }
  }

  // Step 2: Download each preview and upload to Supabase Storage
  console.log('\n── Download → Supabase Storage ──');
  const supabaseMockups = {};

  for (const [slug, info] of Object.entries(mockupUrls)) {
    // Download from Printful CDN
    const dlRes = await fetch(info.previewUrl);
    if (!dlRes.ok) {
      console.log(`  ⚠ ${info.color}: download failed ${dlRes.status}`);
      continue;
    }
    const buffer = Buffer.from(await dlRes.arrayBuffer());
    console.log(`  Downloaded ${info.color}: ${(buffer.length / 1024).toFixed(0)} KB`);

    // Upload to Supabase Storage
    const storagePath = `mockups/vibe-coded-beanie/${slug}.png`;
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
      console.log(`  ⚠ ${info.color} upload: ${upRes.status} — ${text}`);
      continue;
    }

    const publicUrl = `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
    supabaseMockups[slug] = { ...info, publicUrl };
    console.log(`  ✓ ${info.color} → Supabase`);
    await delay(300);
  }

  // Step 3: Update product images
  console.log('\n── Update product images ──');
  const images = Object.entries(supabaseMockups).map(([slug, info]) => ({
    src: info.publicUrl,
    alt: `Vibe Coded Beanie - ${info.color}`,
  }));

  const imgRes = await fetch(`${SB_URL}/rest/v1/products?id=eq.${PRODUCT_ID}`, {
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

  // Step 4: Update variant image_urls
  console.log('\n── Update variant images ──');
  for (const [slug, info] of Object.entries(supabaseMockups)) {
    const vRes = await fetch(
      `${SB_URL}/rest/v1/product_variants?product_id=eq.${PRODUCT_ID}&external_variant_id=eq.${info.variantId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SB_KEY}`,
          'apikey': SB_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ image_url: info.publicUrl }),
      }
    );

    if (!vRes.ok) {
      const text = await vRes.text();
      console.log(`  ⚠ ${info.color}: ${vRes.status} — ${text}`);
    } else {
      console.log(`  ✓ ${info.color}`);
    }
  }

  console.log('\n═══ COMPLETE ═══');
  console.log(`Updated ${Object.keys(supabaseMockups).length} mockups`);
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
