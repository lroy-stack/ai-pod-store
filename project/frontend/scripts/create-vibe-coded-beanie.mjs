#!/usr/bin/env node
/**
 * Create Vibe·Coded Beanie — Atlantis RIO (Catalog 519) Embroidery
 * Pipeline: Render SVG→PNG → Supabase Storage → Printful File Library → Create Sync Product → Supabase DB
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

// ── Load env ──
const envPath = resolve(import.meta.dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_KEY;
const PF_TOKEN = env.PRINTFUL_API_TOKEN;
const PF_STORE = env.PRINTFUL_STORE_ID || '17795695';

const DESIGN_DIR = resolve(import.meta.dirname, '../public/hat-designs/vibe-coded');
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now() / 1000);

// ── Variant definitions ──
const VARIANTS = [
  { color: 'Black',              slug: 'black',             variantId: 13238, colorCode: '#0a0a0a',  threads: ['#FFFFFF', '#FFCC00', '#3399FF'] },
  { color: 'Navy',               slug: 'navy',              variantId: 13241, colorCode: '#052438',  threads: ['#FFFFFF', '#FFCC00', '#CC3366'] },
  { color: 'Olive',              slug: 'olive',             variantId: 13242, colorCode: '#655b3b',  threads: ['#FFFFFF', '#A67843', '#7BA35A'] },
  { color: 'Mustard',            slug: 'mustard',           variantId: 13240, colorCode: '#f19f00',  threads: ['#000000', '#660000', '#333366'] },
  { color: 'Light Grey Melange', slug: 'lt-grey',           variantId: 13239, colorCode: '#b8b3af',  threads: ['#000000', '#005397', '#660000'] },
  { color: 'Beige',              slug: 'beige',             variantId: 15016, colorCode: '#f4d8b5',  threads: ['#000000', '#A67843', '#660000'] },
  { color: 'Light Blue',         slug: 'lt-blue',           variantId: 15019, colorCode: '#e4f3ff',  threads: ['#333366', '#005397', '#FFFFFF'] },
  { color: 'Acid Green',         slug: 'acid-green',        variantId: 15020, colorCode: '#e3ff82',  threads: ['#000000', '#660000', '#01784E'] },
];

// ── Printful API helper ──
async function pf(path, opts = {}) {
  const base = path.startsWith('/v2') ? 'https://api.printful.com' : 'https://api.printful.com';
  const headers = {
    'Authorization': `Bearer ${PF_TOKEN}`,
    'User-Agent': 'POD-AI-Store/1.0',
    'Content-Type': 'application/json',
  };
  if (!path.startsWith('/v2')) headers['X-PF-Store-Id'] = PF_STORE;

  const res = await fetch(`${base}${path}`, { ...opts, headers: { ...headers, ...opts.headers } });
  const data = await res.json();
  if (!res.ok) throw new Error(`Printful ${path}: ${res.status} — ${JSON.stringify(data)}`);
  return data;
}

// ── Supabase helper ──
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': opts.contentType || 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${path}: ${res.status} — ${text}`);
  }
  const ct = res.headers.get('content-type');
  return ct?.includes('json') ? res.json() : res.text();
}

// ── Step 1: Render SVGs to PNG ──
function renderPNGs() {
  console.log('── Step 1: Render SVGs → PNG ──');
  for (const v of VARIANTS) {
    const svgPath = resolve(DESIGN_DIR, `front-${v.slug}.svg`);
    const pngPath = resolve(DESIGN_DIR, `front-${v.slug}.png`);

    if (!existsSync(svgPath)) {
      throw new Error(`SVG not found: ${svgPath}`);
    }

    execSync(`rsvg-convert -w 1500 -h 525 "${svgPath}" -o "${pngPath}"`);
    const size = readFileSync(pngPath).length;
    console.log(`  ✓ ${v.slug}: ${(size / 1024).toFixed(0)} KB`);
  }
}

// ── Step 2: Upload PNGs to Supabase Storage ──
async function uploadToSupabase(slug) {
  const pngPath = resolve(DESIGN_DIR, `front-${slug}.png`);
  const buffer = readFileSync(pngPath);
  const storagePath = `embroidery-sources/vibe-coded-beanie/front-${slug}.png`;

  await fetch(`${SUPABASE_URL}/storage/v1/object/designs/${storagePath}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
  console.log(`  ✓ Supabase: front-${slug}.png`);
  return publicUrl;
}

// ── Step 3: Upload to Printful File Library ──
async function uploadToPrintful(publicUrl, slug) {
  const data = await pf('/files', {
    method: 'POST',
    body: JSON.stringify({
      url: publicUrl,
      filename: `vibe-coded-front-${slug}.png`,
    }),
  });
  const fileId = data.result?.id;
  console.log(`  ✓ Printful: front-${slug} → file_id=${fileId}`);
  return fileId;
}

// ── Step 4: Create Sync Product ──
async function createSyncProduct(fileIds) {
  const sync_variants = VARIANTS.map(v => ({
    variant_id: v.variantId,
    retail_price: '34.99',
    is_enabled: true,
    files: [
      { type: 'embroidery_front', id: fileIds[v.slug] },
    ],
    options: [
      { id: 'thread_colors', value: v.threads },
    ],
  }));

  const data = await pf('/store/products', {
    method: 'POST',
    body: JSON.stringify({
      sync_product: {
        name: 'Vibe·Coded — Ribbed Knit Beanie',
      },
      sync_variants,
    }),
  });

  const productId = data.result?.id;
  const extId = data.result?.external_id;
  console.log(`\n✓ Printful product created: ID=${productId}, external=${extId}`);
  console.log(`  Variants: ${data.result?.sync_variants?.length || 0}`);
  return data.result;
}

// ── Step 5: Find beanies category ──
async function findCategory() {
  const cats = await sb('/rest/v1/categories?slug=eq.beanies&select=id,slug');
  if (cats.length > 0) return cats[0].id;

  const headwear = await sb('/rest/v1/categories?slug=eq.headwear&select=id');
  return headwear[0]?.id || null;
}

// ── Step 6: Create product in Supabase ──
async function createSupabaseProduct(pfProduct, categoryId, supabaseUrls) {
  const GPSR = `<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p><p><strong>Material:</strong> 50% recycled polyester, 50% acrylic</p><p><strong>Print technique:</strong> Embroidery</p><p><strong>Care:</strong> Spot clean only.</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100, GRS (Global Recycled Standard)</p>`;

  const images = VARIANTS.map(v => ({
    src: supabaseUrls[v.slug],
    alt: `Vibe Coded Beanie - ${v.color}`,
  }));

  const productId = randomUUID();
  const product = {
    id: productId,
    title: 'Vibe·Coded — Ribbed Knit Beanie',
    description: 'VIBE·CODED, embroidered on a sustainable ribbed knit beanie made from 50% recycled polyester and 50% acrylic. Three-color threadwork on every colorway. Certified GRS and OEKO-TEX — designed by vibe, built to last.',
    translations: {
      es: {
        title: 'Vibe·Coded — Gorro de Punto Acanalado',
        description: 'VIBE·CODED, bordado en un gorro sostenible de punto acanalado fabricado con 50% poliéster reciclado y 50% acrílico. Tres colores de hilo en cada variante. Certificado GRS y OEKO-TEX — diseñado por vibe, hecho para durar.',
      },
      de: {
        title: 'Vibe·Coded — Gerippte Strickmütze',
        description: 'VIBE·CODED, gestickt auf einer nachhaltigen gerippten Strickmütze aus 50% recyceltem Polyester und 50% Acryl. Drei Garnfarben in jeder Variante. GRS- und OEKO-TEX-zertifiziert — vom Vibe entworfen, gebaut um zu bestehen.',
      },
    },
    category_id: categoryId,
    pod_provider: 'printful',
    product_template_id: '519',
    provider_product_id: String(pfProduct?.id || ''),
    base_price_cents: 3499,
    compare_at_price_cents: 3999,
    images,
    product_details: {
      safety_information: GPSR,
      brand: 'SKAPARA',
      model: 'Atlantis RIO',
      material: '50% recycled polyester, 50% acrylic (GRS + OEKO-TEX certified)',
      print_technique: 'Embroidery',
      manufacturing_country: 'LV',
      care_instructions: 'Spot clean only.',
    },
    status: 'active',
  };

  await sb('/rest/v1/products', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(product),
  });

  console.log(`✓ Supabase product: ${productId}`);
  return productId;
}

// ── Step 7: Create variants in Supabase ──
async function createSupabaseVariants(productId, supabaseUrls) {
  for (const v of VARIANTS) {
    const variant = {
      product_id: productId,
      title: `Vibe·Coded Beanie / ${v.color} / One size`,
      color: v.color,
      size: 'One size',
      price_cents: 3499,
      is_enabled: true,
      is_available: true,
      external_variant_id: String(v.variantId),
      image_url: supabaseUrls[v.slug],
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/product_variants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(variant),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`  ⚠ Variant ${v.color}: ${res.status} — ${text}`);
    } else {
      console.log(`  ✓ Variant: ${v.color} (${v.variantId})`);
    }
  }
}

// ── Main ──
async function main() {
  console.log('═══ Vibe·Coded Beanie — Atlantis RIO (CAT 519) ═══\n');

  // Step 1: Render PNGs
  renderPNGs();

  // Step 2: Upload to Supabase Storage
  console.log('\n── Step 2: Upload → Supabase Storage ──');
  const supabaseUrls = {};
  for (const v of VARIANTS) {
    supabaseUrls[v.slug] = await uploadToSupabase(v.slug);
    await delay(300);
  }

  // Step 3: Upload to Printful File Library
  console.log('\n── Step 3: Upload → Printful File Library ──');
  const fileIds = {};
  for (const v of VARIANTS) {
    fileIds[v.slug] = await uploadToPrintful(supabaseUrls[v.slug], v.slug);
    await delay(2000);
  }

  // Step 4: Create Sync Product
  console.log('\n── Step 4: Create Sync Product ──');
  const pfProduct = await createSyncProduct(fileIds);

  // Step 5: Find category
  console.log('\n── Step 5: Find category ──');
  const categoryId = await findCategory();
  console.log(`  Category: ${categoryId || 'NOT FOUND'}`);

  // Step 6: Create Supabase product
  console.log('\n── Step 6: Create Supabase product ──');
  const productId = await createSupabaseProduct(pfProduct, categoryId, supabaseUrls);

  // Step 7: Create Supabase variants
  console.log('\n── Step 7: Create Supabase variants ──');
  await createSupabaseVariants(productId, supabaseUrls);

  // Summary
  console.log('\n═══ COMPLETE ═══');
  console.log(`Printful product: ${pfProduct?.id}`);
  console.log(`Supabase product: ${productId}`);
  console.log(`Variants: 8 colors × One size`);
  console.log(`Price: €34.99 (compare at €39.99)`);
  console.log(`Category: ${categoryId}`);
  console.log(`Catalog: 519 (Atlantis RIO)`);
  console.log(`Technique: Embroidery (3 thread colors per variant)`);
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
