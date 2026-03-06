#!/usr/bin/env node
/**
 * Upload redesigned front PNGs to Printful + update branding to v2.
 *
 * Flow per product:
 *   1. Upload PNG to Supabase Storage (public URL)
 *   2. Upload URL to Printful File Library → get file ID + preview_url
 *   3. Update ALL sync variants with new front file + v2 branding
 *
 * Also updates Ghost Tee branding to v2 (no redesign, just branding fix).
 */
import fs from 'fs';
import path from 'path';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

// Printful v2 branding file IDs (already in File Library)
const V2_SLEEVE_FILE_ID = 950410444;
const V2_BACK_FILE_ID = 950410495;

// Products to update
const REDESIGNS = [
  { name: 'Option Two',     syncId: 422030337, png: 'public/meme-redesigns/png/option-two-front.png' },
  { name: 'Dangerous Flag', syncId: 422030313, png: 'public/meme-redesigns/png/dangerous-flag-front.png' },
  { name: 'Scope Creep',    syncId: 422030382, png: 'public/meme-redesigns/png/scope-creep-front.png' },
  { name: 'Three Models',   syncId: 422030406, png: 'public/meme-redesigns/png/three-models-front.png' },
];

// Ghost Tee — no redesign, just needs branding v2
const BRANDING_ONLY = [
  { name: 'Ghost Tee', syncId: 422030327 },
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// --- Printful API ---
const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
  'User-Agent': 'SKAPARA-POD/1.0',
};

async function pfFetch(path, opts = {}) {
  const res = await fetch(`https://api.printful.com${path}`, { headers: pfHeaders, ...opts });
  if (res.status === 429) {
    const reset = parseInt(res.headers.get('x-ratelimit-reset') || '60', 10);
    console.log(`  Rate limited, waiting ${reset}s...`);
    await delay(reset * 1000);
    return pfFetch(path, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

// --- Supabase Storage ---
async function uploadToStorage(storagePath, buffer) {
  const res = await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      apikey: SB_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`Storage upload failed: ${res.status}`);
  return `${SB_URL}/storage/v1/object/public/designs/${storagePath}`;
}

// --- Upload redesigned front to Printful File Library ---
async function uploadToPrintfulLibrary(publicUrl, filename) {
  const data = await pfFetch('/files', {
    method: 'POST',
    body: JSON.stringify({ url: publicUrl, filename }),
  });
  const file = data.result;
  console.log(`  Printful file ID: ${file.id}, preview: ${file.preview_url?.slice(0, 60)}...`);
  return file;
}

// --- Update sync product variants ---
async function updateSyncProduct(syncId, newFrontFileId) {
  // Get current product to extract variant info
  const data = await pfFetch(`/store/products/${syncId}`);
  const variants = data.result.sync_variants;
  console.log(`  ${variants.length} variants to update`);

  // Build updated variants with new front file + v2 branding
  const updatedVariants = variants.map(v => ({
    id: v.id,
    files: [
      // Front design (new or existing)
      ...(newFrontFileId
        ? [{ type: v.product.product_id === 917 ? 'front' : 'default', id: newFrontFileId }]
        : v.files.filter(f => f.type === 'default' || f.type === 'front').map(f => ({ type: f.type, id: f.id }))
      ),
      // v2 branding
      { type: 'back', id: V2_BACK_FILE_ID },
      { type: 'sleeve_left', id: V2_SLEEVE_FILE_ID },
    ],
  }));

  // Bulk update
  const result = await pfFetch(`/store/products/${syncId}`, {
    method: 'PUT',
    body: JSON.stringify({ sync_variants: updatedVariants }),
  });
  console.log(`  Updated ${updatedVariants.length} variants`);
  return result;
}

// --- Main ---
async function main() {
  console.log('=== Upload Redesigned Fronts + Update Branding v2 ===\n');

  // Phase 1: Upload redesigned PNGs
  for (const product of REDESIGNS) {
    console.log(`\n[REDESIGN] ${product.name} (sync ${product.syncId})`);

    // 1. Read local PNG
    const buffer = fs.readFileSync(product.png);
    const filename = `skapara-front-${path.basename(product.png).replace('-front.png', '')}-v2.png`;
    console.log(`  PNG: ${product.png} (${buffer.length} bytes)`);

    // 2. Upload to Supabase Storage (for public URL)
    const storagePath = `redesigns/${filename}`;
    const publicUrl = await uploadToStorage(storagePath, buffer);
    console.log(`  Supabase: ${publicUrl.slice(0, 60)}...`);

    // 3. Upload to Printful File Library
    await delay(2000);
    const pfFile = await uploadToPrintfulLibrary(publicUrl, filename);

    // 4. Update sync product with new front + v2 branding
    await delay(3000);
    await updateSyncProduct(product.syncId, pfFile.id);

    await delay(3000);
  }

  // Phase 2: Update branding v2 only (no redesign)
  for (const product of BRANDING_ONLY) {
    console.log(`\n[BRANDING v2] ${product.name} (sync ${product.syncId})`);
    await updateSyncProduct(product.syncId, null); // null = keep existing front
    await delay(3000);
  }

  console.log('\n=== DONE ===');
  console.log('Next step: run _batch-generate-mockups.mjs to generate Ghost mockups');
}

main().catch(e => console.error('FATAL:', e));
