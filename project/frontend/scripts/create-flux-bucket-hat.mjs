#!/usr/bin/env node
/**
 * Create Flux Bucket Hat — AOP Reversible Bucket Hat (Catalog 654)
 * Pipeline: Upload PNGs → Supabase Storage → Printful File Library → Create Sync Product
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const DESIGN_DIR = resolve(import.meta.dirname, '../public/hat-designs/flux-bucket');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Files to upload ──
const PLACEMENTS = [
  { name: 'outside-front', placement: 'outside_front' },
  { name: 'outside-back', placement: 'outside_back' },
  { name: 'inside-front', placement: 'inside_front' },
  { name: 'inside-back', placement: 'inside_back' },
  { name: 'label-outside', placement: 'label_outside' },
  { name: 'label-inside', placement: 'label_inside' },
];

// ── Step 1: Upload to Supabase Storage ──
async function uploadToSupabase(filename, buffer) {
  const storagePath = `uploads/flux-bucket/${filename}`;
  const url = `${SUPABASE_URL}/storage/v1/object/designs/${storagePath}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload ${filename}: ${res.status} — ${text}`);
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}`;
  console.log(`  ✓ Supabase: ${filename} → ${publicUrl.slice(0, 80)}...`);
  return publicUrl;
}

// ── Step 2: Upload to Printful File Library ──
async function uploadToPrintful(publicUrl, filename) {
  const res = await fetch('https://api.printful.com/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PF_TOKEN}`,
      'X-PF-Store-Id': PF_STORE,
      'Content-Type': 'application/json',
      'User-Agent': 'POD-AI-Store/1.0',
    },
    body: JSON.stringify({ url: publicUrl, filename }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful file upload ${filename}: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const fileId = data.result?.id;
  const previewUrl = data.result?.preview_url || data.result?.thumbnail_url || publicUrl;
  console.log(`  ✓ Printful: ${filename} → file_id=${fileId}`);
  return { fileId, previewUrl };
}

// ── Step 3: Create Sync Product ──
async function createSyncProduct(fileMap) {
  const files = PLACEMENTS.map(p => ({
    type: p.placement,
    id: fileMap[p.placement].fileId,
  }));

  const body = {
    sync_product: {
      name: 'Flux — AOP Reversible Bucket Hat',
    },
    sync_variants: [
      { variant_id: 19255, retail_price: '39.99', files },  // XS
      { variant_id: 16360, retail_price: '39.99', files },  // S/M
      { variant_id: 16361, retail_price: '39.99', files },  // L/XL
    ],
  };

  const res = await fetch('https://api.printful.com/store/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PF_TOKEN}`,
      'X-PF-Store-Id': PF_STORE,
      'Content-Type': 'application/json',
      'User-Agent': 'POD-AI-Store/1.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful create product: ${res.status} — ${text}`);
  }

  const data = await res.json();
  const productId = data.result?.id;
  const externalId = data.result?.external_id;
  console.log(`\n✓ Product created! Printful ID: ${productId}, External ID: ${externalId}`);
  console.log(`  Variants: ${data.result?.sync_variants?.length || 0}`);
  return data.result;
}

// ── Step 4: Generate Mockups ──
async function generateMockups(fileMap) {
  const mockupFiles = PLACEMENTS
    .filter(p => !p.placement.startsWith('label_'))
    .map(p => ({
      placement: p.placement,
      image_url: fileMap[p.placement].previewUrl,
      position: {
        area_width: 2700, area_height: 3150,
        width: 2700, height: 3150,
        top: 0, left: 0,
      },
    }));

  const res = await fetch('https://api.printful.com/mockup-generator/create-task/654', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PF_TOKEN}`,
      'X-PF-Store-Id': PF_STORE,
      'Content-Type': 'application/json',
      'User-Agent': 'POD-AI-Store/1.0',
    },
    body: JSON.stringify({
      variant_ids: [16360],
      format: 'png',
      width: 1000,
      files: mockupFiles,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.log(`  ⚠ Mockup task failed: ${res.status} — ${text}`);
    return null;
  }

  const data = await res.json();
  const taskKey = data.result?.task_key;
  console.log(`\n✓ Mockup task created: ${taskKey}`);

  // Poll for completion
  for (let i = 0; i < 20; i++) {
    await delay(5000);
    const pollRes = await fetch(
      `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`,
      {
        headers: {
          'Authorization': `Bearer ${PF_TOKEN}`,
          'X-PF-Store-Id': PF_STORE,
          'User-Agent': 'POD-AI-Store/1.0',
        },
      }
    );
    const pollData = await pollRes.json();
    const status = pollData.result?.status;
    console.log(`  Mockup status: ${status} (attempt ${i + 1}/20)`);

    if (status === 'completed') {
      const mockups = pollData.result?.mockups || [];
      console.log(`  ✓ ${mockups.length} mockup(s) generated:`);
      for (const m of mockups) {
        console.log(`    - ${m.placement}: ${m.mockup_url?.slice(0, 80)}...`);
      }
      return mockups;
    }
    if (status === 'failed') {
      console.log(`  ✗ Mockup generation failed: ${JSON.stringify(pollData.result?.error)}`);
      return null;
    }
  }
  console.log('  ⚠ Mockup polling timed out');
  return null;
}

// ── Main ──
async function main() {
  console.log('═══ Flux Bucket Hat — Product Creation Pipeline ═══\n');

  // Upload all 6 files
  const fileMap = {};
  for (const p of PLACEMENTS) {
    const pngPath = resolve(DESIGN_DIR, `${p.name}.png`);
    const buffer = readFileSync(pngPath);
    console.log(`[${p.name}] (${(buffer.length / 1024).toFixed(0)} KB)`);

    // Upload to Supabase
    const publicUrl = await uploadToSupabase(`${p.name}.png`, buffer);
    await delay(500);

    // Upload to Printful File Library
    const { fileId, previewUrl } = await uploadToPrintful(publicUrl, `flux-bucket-${p.name}.png`);
    fileMap[p.placement] = { fileId, previewUrl: publicUrl };
    await delay(2000); // Rate limit
  }

  console.log('\n── All files uploaded ──');
  for (const [placement, data] of Object.entries(fileMap)) {
    console.log(`  ${placement}: file_id=${data.fileId}`);
  }

  // Create sync product
  console.log('\n── Creating sync product ──');
  const product = await createSyncProduct(fileMap);

  // Generate mockups
  console.log('\n── Generating mockups ──');
  const mockups = await generateMockups(fileMap);

  // Summary
  console.log('\n═══ DONE ═══');
  console.log(`Product: ${product?.id}`);
  console.log(`Variants: XS(19255), S/M(16360), L/XL(16361)`);
  console.log(`Price: €39.99`);
  console.log(`Mockups: ${mockups?.length || 'pending'}`);
  console.log('\nNext steps:');
  console.log('  1. Run cron sync to populate Supabase');
  console.log('  2. Update category, translations, product_details in Supabase');
  console.log('  3. Download mockup images and re-upload to Supabase Storage');
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
