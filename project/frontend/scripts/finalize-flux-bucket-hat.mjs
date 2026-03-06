#!/usr/bin/env node
/**
 * Finalize Flux Bucket Hat — Download mockups, upload to Supabase Storage, update DB
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// ── Load env ──
const envPath = resolve(import.meta.dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const PF_TOKEN = env.PRINTFUL_API_TOKEN;
const PF_STORE = env.PRINTFUL_STORE_ID;
const PF_PRODUCT_ID = '422456528';

const delay = (ms) => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now() / 1000);

// ── Step 1: Get mockup URLs from Printful ──
async function getProductMockups() {
  // Re-poll the mockup task or get from product
  const res = await fetch(
    `https://api.printful.com/mockup-generator/task?task_key=gt-889787283`,
    {
      headers: {
        'Authorization': `Bearer ${PF_TOKEN}`,
        'X-PF-Store-Id': PF_STORE,
        'User-Agent': 'POD-AI-Store/1.0',
      },
    }
  );
  const data = await res.json();
  return data.result?.mockups || [];
}

// ── Step 2: Download mockup and upload to Supabase Storage ──
async function downloadAndUpload(mockupUrl, storageName) {
  // Download from S3
  const dlRes = await fetch(mockupUrl);
  if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  console.log(`  Downloaded ${storageName}: ${(buffer.length / 1024).toFixed(0)} KB`);

  // Upload to Supabase Storage
  const storagePath = `mockups/flux-bucket/${storageName}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/designs/${storagePath}`;
  const upRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!upRes.ok) {
    const text = await upRes.text();
    throw new Error(`Supabase upload ${storageName}: ${upRes.status} — ${text}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
  console.log(`  ✓ ${storageName} → Supabase`);
  return publicUrl;
}

// ── Step 3: Find or create bucket-hats category ──
async function findCategory() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?slug=eq.bucket-hats&select=id,name,slug`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
    }
  );
  const cats = await res.json();
  if (cats.length > 0) return cats[0].id;

  // Try headwear parent
  const res2 = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?slug=eq.headwear&select=id`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
      },
    }
  );
  const parents = await res2.json();
  return parents[0]?.id || null;
}

// ── Step 4: Upsert product in Supabase ──
async function upsertProduct(productId, mockupUrls, categoryId) {
  const GPSR = `<p><strong>Manufacturer:</strong> Printful Inc., Latvia</p><p><strong>Material:</strong> 100% Polyester (8.1 oz/yd² / 275 g/m²)</p><p><strong>Construction:</strong> Reversible bucket hat, CUT-SEW assembly</p><p><strong>Print technique:</strong> All-over sublimation — dye-sublimation inks</p><p><strong>Care:</strong> Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Do not iron directly on print.</p><p><strong>Compliance:</strong> REACH, EU Regulation 2023/988 (GPSR)</p>`;

  const product = {
    id: productId,
    title: 'Flux — AOP Reversible Bucket Hat',
    description: 'Two hats in one. Outside: cubist geometry in teal, purple and gold. Flip it inside-out for a rainbow zigzag explosion on black. Designed by AI, made to turn heads both ways.',
    translations: {
      es: {
        title: 'Flux — Bucket Hat Reversible AOP',
        description: 'Dos gorros en uno. Exterior: geometría cubista en teal, morado y dorado. Dale la vuelta para una explosión de zigzag arcoíris sobre negro. Diseñado por IA, hecho para girar cabezas en ambos sentidos.',
      },
      de: {
        title: 'Flux — Wendebarer AOP Bucket Hat',
        description: 'Zwei Hüte in einem. Außen: kubistische Geometrie in Teal, Lila und Gold. Umdrehen für eine Regenbogen-Zickzack-Explosion auf Schwarz. Von KI entworfen, um in beide Richtungen Blicke auf sich zu ziehen.',
      },
    },
    category_id: categoryId,
    pod_provider: 'printful',
    product_template_id: '654',
    provider_product_id: PF_PRODUCT_ID,
    base_price_cents: 3999,
    compare_at_price_cents: 4999,
    images: [
      { src: mockupUrls.outside_front, alt: 'Flux Bucket Hat - Outside Front' },
      { src: mockupUrls.outside_back, alt: 'Flux Bucket Hat - Outside Back' },
      { src: mockupUrls.inside_front, alt: 'Flux Bucket Hat - Inside (Reversible)' },
      { src: mockupUrls.inside_back, alt: 'Flux Bucket Hat - Inside Back (Reversible)' },
    ],
    product_details: {
      safety_information: GPSR,
      material: '100% Polyester (275 g/m²)',
      care_instructions: 'Machine wash cold, gentle cycle. Do not bleach. Tumble dry low. Do not iron directly on print.',
      print_technique: 'CUT-SEW (All-Over Sublimation)',
      manufacturing_country: 'Latvia',
      brand: 'SKAPARA',
      blank: 'AOP Reversible Bucket Hat',
      weight: '8.1 oz/yd² (275 g/m²)',
      construction: 'Reversible — both sides independently printed',
    },
    status: 'active',
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(product),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase product upsert: ${res.status} — ${text}`);
  }

  const [inserted] = await res.json();
  console.log(`✓ Product upserted in Supabase: ${inserted.id}`);
  return inserted.id;
}

// ── Step 5: Create product variants ──
async function createVariants(productId, mockupUrl) {
  const sizes = [
    { size: 'XS', variantId: '19255' },
    { size: 'S/M', variantId: '16360' },
    { size: 'L/XL', variantId: '16361' },
  ];

  for (const { size, variantId } of sizes) {
    const variant = {
      product_id: productId,
      color: 'White',
      color_hex: '#ffffff',
      size,
      is_enabled: true,
      external_variant_id: variantId,
      image_url: mockupUrl,
    };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/product_variants`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(variant),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.log(`  ⚠ Variant ${size}: ${res.status} — ${text}`);
    } else {
      console.log(`  ✓ Variant ${size} (${variantId}) created`);
    }
  }
}

// ── Main ──
async function main() {
  console.log('═══ Finalize Flux Bucket Hat ═══\n');

  // Get mockups
  console.log('── Fetching mockups ──');
  const mockups = await getProductMockups();
  console.log(`  Found ${mockups.length} mockup(s)`);

  // Download and re-upload to Supabase Storage
  console.log('\n── Downloading mockups → Supabase Storage ──');
  const mockupUrls = {};
  for (const m of mockups) {
    const name = `${m.placement}.png`;
    mockupUrls[m.placement] = await downloadAndUpload(m.mockup_url, name);
    await delay(500);
  }

  // Find category
  console.log('\n── Finding category ──');
  const categoryId = await findCategory();
  console.log(`  Category: ${categoryId || 'NOT FOUND'}`);

  // Upsert product
  console.log('\n── Upserting product ──');
  const productId = await upsertProduct(
    randomUUID(),
    mockupUrls,
    categoryId
  );

  // Create variants
  console.log('\n── Creating variants ──');
  await createVariants(productId, mockupUrls.outside_front);

  console.log('\n═══ COMPLETE ═══');
  console.log(`Supabase product: ${productId}`);
  console.log(`Printful product: ${PF_PRODUCT_ID}`);
  console.log(`Price: €39.99 (compare at €49.99)`);
  console.log(`Category: ${categoryId}`);
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
