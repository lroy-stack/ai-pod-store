#!/usr/bin/env node
/**
 * Update caps designs (It Works + AI Wrote This) and generate additional mockups for all 4 caps
 * 1. Re-render fixed PNGs with rsvg-convert
 * 2. Upload to Supabase Storage + Printful File Library
 * 3. Update Printful sync variants with new front files
 * 4. Wait for Printful to process, then download ALL mockups (front + additional angles)
 * 5. Update Supabase product images
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

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
const DESIGN_DIR = resolve(import.meta.dirname, '../public/brand-designs/printful-caps');
const ts = Math.floor(Date.now() / 1000);
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const PRODUCTS = [
  { slug: 'assignment', name: 'Assignment', pfId: 422465243, dbId: '919247bf-c114-4455-8275-17c6021ced5a', frontCanvas: { w: 1890, h: 765 }, needsUpdate: false },
  { slug: 'ai-wrote-this', name: 'AI Wrote This', pfId: 422465247, dbId: '151fb51e-e9ae-4971-89cf-7492e4ad55c0', frontCanvas: { w: 1890, h: 765 }, needsUpdate: true },
  { slug: 'dark-mode', name: 'Dark Mode', pfId: 422465253, dbId: '547be69f-e607-4738-9580-9e6fde126150', frontCanvas: { w: 1200, h: 525 }, needsUpdate: false },
  { slug: 'it-works', name: 'It Works', pfId: 422465259, dbId: '6f5d02bc-ec47-47c4-88e4-71d7c32fe095', frontCanvas: { w: 1650, h: 600 }, needsUpdate: true },
];

async function pf(path, opts = {}) {
  const headers = {
    'Authorization': `Bearer ${PF_TOKEN}`,
    'User-Agent': 'POD-AI-Store/1.0',
    'Content-Type': 'application/json',
  };
  if (!path.startsWith('/v2')) headers['X-PF-Store-Id'] = PF_STORE;
  const res = await fetch(`https://api.printful.com${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Printful ${path}: ${res.status} — ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  console.log('═══ Update Caps Designs + Generate Mockups ═══\n');

  // Step 1: Re-render fixed front PNGs with rsvg-convert
  console.log('── Step 1: Re-render PNGs (rsvg-convert) ──');
  for (const p of PRODUCTS) {
    if (!p.needsUpdate) continue;
    const svgPath = resolve(DESIGN_DIR, p.slug, 'front.svg');
    const pngPath = resolve(DESIGN_DIR, p.slug, 'front.png');
    execSync(`rsvg-convert -w ${p.frontCanvas.w} -h ${p.frontCanvas.h} "${svgPath}" -o "${pngPath}"`);
    const size = readFileSync(pngPath).length;
    console.log(`  ✓ ${p.slug}/front: ${(size / 1024).toFixed(0)} KB`);
  }

  // Step 2: Upload fixed PNGs to Supabase Storage + Printful
  console.log('\n── Step 2: Upload fixed designs ──');
  const newFileIds = {};
  for (const p of PRODUCTS) {
    if (!p.needsUpdate) continue;
    const pngPath = resolve(DESIGN_DIR, p.slug, 'front.png');
    const buffer = readFileSync(pngPath);
    const storagePath = `embroidery-sources/caps-${p.slug}/front.png`;

    // Supabase Storage (upsert)
    await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: buffer,
    });
    console.log(`  ✓ ${p.slug} → Supabase Storage`);

    // Printful File Library
    const publicUrl = `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
    await delay(2000);
    const fileData = await pf('/files', {
      method: 'POST',
      body: JSON.stringify({ url: publicUrl, filename: `caps-${p.slug}-embroidery_front-v2.png` }),
    });
    newFileIds[p.slug] = fileData.result?.id;
    console.log(`  ✓ ${p.slug} → Printful file_id=${newFileIds[p.slug]}`);
    await delay(2000);
  }

  // Step 3: Update Printful sync variants with new front files
  console.log('\n── Step 3: Update sync variants ──');
  for (const p of PRODUCTS) {
    if (!p.needsUpdate) continue;
    const pfData = await pf(`/store/products/${p.pfId}`);
    const variants = pfData.result?.sync_variants || [];

    for (const sv of variants) {
      // Build updated files array: replace front, keep back
      const files = sv.files.map(f => {
        if (f.type === 'default' || f.type === 'embroidery_front') {
          return { type: f.type, id: newFileIds[p.slug] };
        }
        return { type: f.type, id: f.id };
      }).filter(f => f.type !== 'preview'); // Remove preview, Printful regenerates it

      const updateBody = {
        files,
      };

      const updateRes = await fetch(`https://api.printful.com/store/variants/${sv.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${PF_TOKEN}`,
          'User-Agent': 'POD-AI-Store/1.0',
          'Content-Type': 'application/json',
          'X-PF-Store-Id': PF_STORE,
        },
        body: JSON.stringify(updateBody),
      });
      const updateData = await updateRes.json();
      if (!updateRes.ok) {
        console.log(`  ⚠ ${sv.name}: ${updateRes.status} — ${JSON.stringify(updateData).slice(0, 200)}`);
      } else {
        console.log(`  ✓ ${sv.name}`);
      }
      await delay(1500);
    }
  }

  // Step 4: Wait for Printful to regenerate previews
  console.log('\n── Step 4: Waiting 20s for Printful to regenerate previews ──');
  await delay(20000);

  // Step 5: Download ALL mockups for all 4 products (front previews)
  console.log('\n── Step 5: Download mockups for all products ──');
  for (const p of PRODUCTS) {
    console.log(`\n  ${p.name} (PF: ${p.pfId}):`);
    const pfData = await pf(`/store/products/${p.pfId}`);
    const variants = pfData.result?.sync_variants || [];
    const images = [];

    for (const sv of variants) {
      const colorParts = sv.name.split(' / ');
      const color = colorParts[1] || 'Unknown';
      const slug = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

      // Get front preview
      const previewFile = sv.files?.find(f => f.type === 'preview');
      if (!previewFile?.preview_url) {
        console.log(`    ⚠ ${color}: no front preview`);
        continue;
      }

      // Download front
      const dlRes = await fetch(previewFile.preview_url);
      if (!dlRes.ok) { console.log(`    ⚠ ${color} front: download failed`); continue; }
      const buffer = Buffer.from(await dlRes.arrayBuffer());

      // Upload front mockup to Supabase
      const storagePath = `mockups/caps-${p.slug}/${slug}-front.png`;
      await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'image/png', 'x-upsert': 'true' },
        body: buffer,
      });
      const frontUrl = `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
      images.push({ src: frontUrl, alt: `${p.name} - ${color}` });
      console.log(`    ✓ ${color} front: ${(buffer.length / 1024).toFixed(0)} KB`);

      // Get back preview (embroidery_back file)
      const backFile = sv.files?.find(f => f.type === 'back');
      if (backFile?.preview_url) {
        const dlBack = await fetch(backFile.preview_url);
        if (dlBack.ok) {
          const backBuffer = Buffer.from(await dlBack.arrayBuffer());
          const backPath = `mockups/caps-${p.slug}/${slug}-back.png`;
          await fetch(`${SB_URL}/storage/v1/object/designs/${backPath}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'image/png', 'x-upsert': 'true' },
            body: backBuffer,
          });
          const backUrl = `${SB_URL}/storage/v1/object/public/designs/${backPath}?v=${ts}`;
          images.push({ src: backUrl, alt: `${p.name} - ${color} - Back` });
          console.log(`    ✓ ${color} back: ${(backBuffer.length / 1024).toFixed(0)} KB`);
        }
      }

      await delay(300);
    }

    // Update product images in Supabase
    if (images.length > 0) {
      const imgRes = await fetch(`${SB_URL}/rest/v1/products?id=eq.${p.dbId}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ images }),
      });
      if (imgRes.ok) {
        console.log(`  ✓ Updated ${images.length} images for ${p.name}`);
      } else {
        console.log(`  ⚠ Image update failed: ${imgRes.status}`);
      }
    }

    // Update variant image_urls with front mockups
    for (const sv of variants) {
      const color = sv.name.split(' / ')[1] || '';
      const slug = color.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
      const frontUrl = `${SB_URL}/storage/v1/object/public/designs/mockups/caps-${p.slug}/${slug}-front.png?v=${ts}`;

      await fetch(`${SB_URL}/rest/v1/product_variants?product_id=eq.${p.dbId}&external_variant_id=eq.${sv.variant_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${SB_KEY}`, 'apikey': SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: frontUrl }),
      });
    }
    console.log(`  ✓ Variant image_urls updated`);

    await delay(1000);
  }

  console.log('\n═══ COMPLETE ═══');
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
