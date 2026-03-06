import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const env = fs.readFileSync('/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');
const SB_URL = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

const supabase = createClient(SB_URL, SB_KEY);
const DESIGN_DIR = '/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/public/brand-designs/trendi';
const delay = ms => new Promise(r => setTimeout(r, ms));
const SLUG = 'trendi-hoodie';

const pfHeaders = {
  Authorization: `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
  'User-Agent': 'POD-AI-Store/1.0',
};

// Black & White variant IDs for M2580 (catalog 380)
const VARIANTS = [
  { id: 10779, color: 'Black', size: 'S' },
  { id: 10780, color: 'Black', size: 'M' },
  { id: 10781, color: 'Black', size: 'L' },
  { id: 10782, color: 'Black', size: 'XL' },
  { id: 10783, color: 'Black', size: '2XL' },
  { id: 13416, color: 'Black', size: '3XL' },
  { id: 10774, color: 'White', size: 'S' },
  { id: 10775, color: 'White', size: 'M' },
  { id: 10776, color: 'White', size: 'L' },
  { id: 10777, color: 'White', size: 'XL' },
  { id: 10778, color: 'White', size: '2XL' },
  { id: 13421, color: 'White', size: '3XL' },
];

async function uploadToSupabase(localPath, storagePath) {
  const fileData = fs.readFileSync(localPath);
  console.log(`  SB upload: ${storagePath} (${(fileData.length / 1024).toFixed(0)} KB)...`);

  const { error } = await supabase.storage
    .from('designs')
    .upload(storagePath, fileData, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload failed: ${error.message}`);

  const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
  console.log(`  ✓ ${data.publicUrl.split('/').pop()}`);
  return data.publicUrl;
}

async function uploadToPrintful(publicUrl, filename) {
  const ts = Date.now();
  console.log(`  PF upload: ${filename}...`);

  const res = await fetch('https://api.printful.com/files', {
    method: 'POST',
    headers: pfHeaders,
    body: JSON.stringify({ url: `${publicUrl}?v=${ts}`, filename }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`PF upload failed (${res.status}): ${text.slice(0, 300)}`);

  const data = JSON.parse(text);
  const file = data.result;
  console.log(`  ✓ file_id: ${file.id}`);
  return file;
}

async function createSyncProduct(frontFileId, backFileId, sleeveFileId) {
  const syncVariants = VARIANTS.map(v => ({
    variant_id: v.id,
    retail_price: '59.95',
    files: [
      { type: 'front_dtf', id: frontFileId },
      { type: 'back_dtf', id: backFileId },
      { type: 'long_sleeve_left_dtf', id: sleeveFileId },
    ],
    options: [
      { id: 'technique', value: 'dtfilm' },
    ],
  }));

  console.log(`\n  Creating sync product with ${syncVariants.length} variants...`);

  const res = await fetch('https://api.printful.com/store/products', {
    method: 'POST',
    headers: pfHeaders,
    body: JSON.stringify({
      sync_product: { name: 'Trendi Hoodie — SKAPARA' },
      sync_variants: syncVariants,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`Create failed (${res.status}): ${text.slice(0, 800)}`);

  const data = JSON.parse(text);
  return data.result;
}

async function main() {
  console.log('=== TRENDI HOODIE DTFilm — FULL PIPELINE ===\n');
  console.log('Catalog: M2580 (380) | Technique: DTFilm');
  console.log('Colors: Black + White | Sizes: S-3XL | Variants: 12');
  console.log('Placements: front_dtf, back_dtf, long_sleeve_left_dtf');
  console.log('Retail: €59.95\n');

  // Step 1: Upload PNGs to Supabase Storage
  console.log('--- Step 1: Upload to Supabase Storage ---');
  const frontUrl = await uploadToSupabase(`${DESIGN_DIR}/front.png`, `printfiles/${SLUG}/front-1800x1800.png`);
  const backUrl = await uploadToSupabase(`${DESIGN_DIR}/back.png`, `printfiles/${SLUG}/back-1800x2400.png`);
  const sleeveUrl = await uploadToSupabase(`${DESIGN_DIR}/sleeve-left.png`, `printfiles/${SLUG}/sleeve-left-450x1800.png`);

  // Step 2: Upload URLs to Printful File Library
  console.log('\n--- Step 2: Upload to Printful File Library ---');
  const frontFile = await uploadToPrintful(frontUrl, `${SLUG}-front-dtf-1800x1800.png`);
  await delay(3000);
  const backFile = await uploadToPrintful(backUrl, `${SLUG}-back-dtf-1800x2400.png`);
  await delay(3000);
  const sleeveFile = await uploadToPrintful(sleeveUrl, `${SLUG}-sleeve-left-dtf-450x1800.png`);
  await delay(3000);

  console.log(`\n  File IDs: front=${frontFile.id}, back=${backFile.id}, sleeve=${sleeveFile.id}`);

  // Step 3: Create DTFilm sync product
  console.log('\n--- Step 3: Create DTFilm sync product ---');
  const result = await createSyncProduct(frontFile.id, backFile.id, sleeveFile.id);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Sync Product ID: ${result.sync_product.id}`);
  console.log(`Name: ${result.sync_product.name}`);
  console.log(`Variants created: ${result.sync_variants?.length || 0}`);
  console.log(`\nPrintful File IDs:`);
  console.log(`  front_dtf: ${frontFile.id}`);
  console.log(`  back_dtf: ${backFile.id}`);
  console.log(`  long_sleeve_left_dtf: ${sleeveFile.id}`);

  if (result.sync_variants?.length > 0) {
    const sv = result.sync_variants[0];
    console.log(`\nFirst variant:`);
    console.log(`  Sync variant ID: ${sv.id}`);
    console.log(`  Catalog variant: ${sv.variant_id}`);
    console.log(`  Name: ${sv.name}`);
    console.log(`  Retail: ${sv.retail_price}`);
    console.log(`  Files: ${sv.files?.map(f => f.type).join(', ')}`);
  }

  console.log('\n✓ DONE — Next: generate mockups + update Supabase');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
