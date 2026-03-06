#!/usr/bin/env node
/**
 * Create 4 Printful Cap Products — Full Pipeline
 * 1. Assignment (Yupoong 6089M, Cat 99)
 * 2. AI Wrote This (Yupoong 6089M, Cat 99)
 * 3. Dark Mode (Beechfield B682, Cat 532)
 * 4. It Works (Otto Cap 104-1018, Cat 396)
 *
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

const SB_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_KEY;
const PF_TOKEN = env.PRINTFUL_API_TOKEN;
const PF_STORE = env.PRINTFUL_STORE_ID || '17795695';

const DESIGN_DIR = resolve(import.meta.dirname, '../public/brand-designs/printful-caps');
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now() / 1000);

// ══════════════════════════════════════════════════
// PRODUCT DEFINITIONS
// ══════════════════════════════════════════════════

const PRODUCTS = [
  {
    slug: 'assignment',
    name: 'Assignment',
    catalogId: 99,
    model: 'Yupoong 6089M',
    category: 'snapbacks',
    frontCanvas: { w: 1890, h: 765 },
    backCanvas: { w: 600, h: 300 },
    threadOptionFront: 'thread_colors',  // embroidery_front (default) → thread_colors
    priceCents: 3499,
    compareAtCents: 3999,
    description: {
      en: 'UNDERSTOOD. The checkmark says it all. Embroidered on a Yupoong 6089M wool blend snapback — flat brim, structured crown, classic snap closure.',
      es: 'ENTENDIDO. El check lo dice todo. Bordado sobre una Yupoong 6089M snapback de mezcla de lana — visera plana, corona estructurada, cierre snap clasico.',
      de: 'VERSTANDEN. Das Hakchen sagt alles. Gestickt auf einer Yupoong 6089M Snapback aus Wollmischung — flacher Schirm, strukturierte Krone, klassischer Snap-Verschluss.',
    },
    variants: [
      { color: 'Black', variantId: 4792, threads: { front: ['#FFFFFF', '#3399FF'], back: ['#FFFFFF'] } },
      { color: 'Dark Navy', variantId: 4798, threads: { front: ['#FFFFFF', '#3399FF'], back: ['#FFFFFF'] } },
      { color: 'Dark Grey', variantId: 4797, threads: { front: ['#FFFFFF', '#3399FF'], back: ['#FFFFFF'] } },
      { color: 'Maroon', variantId: 4799, threads: { front: ['#FFFFFF', '#3399FF'], back: ['#FFFFFF'] } },
      { color: 'Royal Blue', variantId: 4807, threads: { front: ['#FFFFFF', '#3399FF'], back: ['#FFFFFF'] } },
    ],
    gpsr: '<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p><p><strong>Material:</strong> 80% acrylic, 20% wool</p><p><strong>Print technique:</strong> Embroidery</p><p><strong>Care:</strong> Spot clean only.</p><p><strong>Compliance:</strong> REACH</p>',
    material: '80% acrylic, 20% wool (Yupoong 6089M)',
  },
  {
    slug: 'ai-wrote-this',
    name: 'AI Wrote This',
    catalogId: 99,
    model: 'Yupoong 6089M',
    category: 'snapbacks',
    frontCanvas: { w: 1890, h: 765 },
    backCanvas: { w: 600, h: 300 },
    threadOptionFront: 'thread_colors',  // embroidery_front (default) → thread_colors
    priceCents: 3499,
    compareAtCents: 3999,
    description: {
      en: 'AI WROTE THIS. You just wore it. Embroidered on a Yupoong 6089M wool blend snapback — flat brim, structured crown, classic snap closure.',
      es: 'AI WROTE THIS. Tu solo te la pusiste. Bordado sobre una Yupoong 6089M snapback de mezcla de lana — visera plana, corona estructurada, cierre snap clasico.',
      de: 'AI WROTE THIS. Du hast sie nur getragen. Gestickt auf einer Yupoong 6089M Snapback aus Wollmischung — flacher Schirm, strukturierte Krone, klassischer Snap-Verschluss.',
    },
    variants: [
      { color: 'Black/ Teal', variantId: 4796, threads: { front: ['#FFFFFF', '#FFCC00'], back: ['#FFFFFF'] } },
      { color: 'Heather Grey', variantId: 7836, threads: { front: ['#000000', '#FFCC00'], back: ['#000000'] } },
      { color: 'Navy', variantId: 4802, threads: { front: ['#FFFFFF', '#FFCC00'], back: ['#FFFFFF'] } },
      { color: 'Spruce', variantId: 4809, threads: { front: ['#FFFFFF', '#FFCC00'], back: ['#FFFFFF'] } },
      { color: 'Silver', variantId: 4808, threads: { front: ['#000000', '#FFCC00'], back: ['#000000'] } },
    ],
    gpsr: '<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p><p><strong>Material:</strong> 80% acrylic, 20% wool</p><p><strong>Print technique:</strong> Embroidery</p><p><strong>Care:</strong> Spot clean only.</p><p><strong>Compliance:</strong> REACH</p>',
    material: '80% acrylic, 20% wool (Yupoong 6089M)',
  },
  {
    slug: 'dark-mode',
    name: 'Dark Mode',
    catalogId: 532,
    model: 'Beechfield B682',
    category: 'caps',
    frontCanvas: { w: 1200, h: 525 },
    backCanvas: { w: 600, h: 300 },
    threadOptionFront: 'thread_colors',  // Cat 532 uses thread_colors
    priceCents: 3499,
    compareAtCents: 3999,
    description: {
      en: 'DARK MODE. Crescent moon, clean type, premium corduroy. Embroidered on a Beechfield B682 — soft-touch cord, unstructured crown, brass buckle closure.',
      es: 'DARK MODE. Luna creciente, tipografia limpia, pana premium. Bordado sobre una Beechfield B682 — pana suave al tacto, corona desestructurada, cierre de hebilla de laton.',
      de: 'DARK MODE. Mondsichel, klare Typografie, Premium-Cord. Gestickt auf einer Beechfield B682 — weicher Cord, unstrukturierte Krone, Messingschnallenverschluss.',
    },
    variants: [
      { color: 'Black', variantId: 13351, threads: { front: ['#FFFFFF', '#6B5294'], back: ['#FFFFFF'] } },
      { color: 'Camel', variantId: 13352, threads: { front: ['#000000', '#333366'], back: ['#000000'] } },
      { color: 'Dark Olive', variantId: 13353, threads: { front: ['#FFFFFF', '#6B5294'], back: ['#FFFFFF'] } },
      { color: 'Oxford Navy', variantId: 13354, threads: { front: ['#FFFFFF', '#6B5294'], back: ['#FFFFFF'] } },
    ],
    gpsr: '<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p><p><strong>Material:</strong> 100% cotton corduroy</p><p><strong>Print technique:</strong> Embroidery</p><p><strong>Care:</strong> Spot clean only.</p><p><strong>Compliance:</strong> REACH</p>',
    material: '100% cotton corduroy (Beechfield B682)',
  },
  {
    slug: 'it-works',
    name: 'It Works',
    catalogId: 396,
    model: 'Otto Cap 104-1018',
    category: 'dad-hats',
    frontCanvas: { w: 1650, h: 600 },
    backCanvas: { w: 600, h: 300 },
    threadOptionFront: 'thread_colors',  // Cat 396 uses thread_colors for standard front
    priceCents: 2999,
    compareAtCents: 3499,
    description: {
      en: 'IT WORKS. Period. Embroidered on an Otto Cap 104-1018 distressed dad hat — garment-washed cotton twill, unstructured low-profile crown, brass buckle closure.',
      es: 'IT WORKS. Punto. Bordado sobre una Otto Cap 104-1018 dad hat desgastada — sarga de algodon lavada, corona baja desestructurada, cierre de hebilla de laton.',
      de: 'IT WORKS. Punkt. Gestickt auf einem Otto Cap 104-1018 Distressed Dad Hat — garment-washed Baumwoll-Twill, unstrukturierte Low-Profile-Krone, Messingschnallenverschluss.',
    },
    variants: [
      { color: 'Black', variantId: 10990, threads: { front: ['#FFFFFF'], back: ['#FFFFFF'] } },
      { color: 'Charcoal Grey', variantId: 10992, threads: { front: ['#FFFFFF'], back: ['#FFFFFF'] } },
      { color: 'Navy', variantId: 10991, threads: { front: ['#FFFFFF'], back: ['#FFFFFF'] } },
    ],
    gpsr: '<p><strong>Manufacturer:</strong> Printful Latvia SIA, Matrozu iela 15, LV-1048, Riga, Latvia</p><p><strong>Material:</strong> 100% cotton twill, garment-washed</p><p><strong>Print technique:</strong> Embroidery</p><p><strong>Care:</strong> Spot clean only.</p><p><strong>Compliance:</strong> REACH</p>',
    material: '100% cotton twill, garment-washed (Otto Cap 104-1018)',
  },
];

// ── Printful API helper ──
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

// ── Supabase helper ──
async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${SB_KEY}`,
      'apikey': SB_KEY,
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

// ══════════════════════════════════════════════════
// STEP 1: Render SVGs → PNG
// ══════════════════════════════════════════════════
function renderPNGs() {
  console.log('\n═══ Step 1: Render SVGs → PNG ═══');
  for (const p of PRODUCTS) {
    for (const placement of ['front', 'back']) {
      const svgPath = resolve(DESIGN_DIR, p.slug, `${placement}.svg`);
      const pngPath = resolve(DESIGN_DIR, p.slug, `${placement}.png`);
      if (!existsSync(svgPath)) throw new Error(`SVG not found: ${svgPath}`);
      const canvas = placement === 'front' ? p.frontCanvas : p.backCanvas;
      execSync(`magick -density 300 -background transparent "${svgPath}" -resize ${canvas.w}x${canvas.h}! "${pngPath}"`);
      const size = readFileSync(pngPath).length;
      console.log(`  ✓ ${p.slug}/${placement}: ${(size / 1024).toFixed(0)} KB (${canvas.w}×${canvas.h})`);
    }
  }
}

// ══════════════════════════════════════════════════
// STEP 2: Upload PNGs → Supabase Storage
// ══════════════════════════════════════════════════
async function uploadToSupabase(product, placement) {
  const pngPath = resolve(DESIGN_DIR, product.slug, `${placement}.png`);
  const buffer = readFileSync(pngPath);
  const storagePath = `embroidery-sources/caps-${product.slug}/${placement}.png`;

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

  const publicUrl = `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`;
  console.log(`  ✓ ${product.slug}/${placement} → Supabase`);
  return publicUrl;
}

// ══════════════════════════════════════════════════
// STEP 3: Upload PNGs → Printful File Library
// ══════════════════════════════════════════════════
async function uploadToPrintful(publicUrl, slug, placement) {
  const data = await pf('/files', {
    method: 'POST',
    body: JSON.stringify({
      url: publicUrl,
      filename: `caps-${slug}-embroidery_${placement}.png`,
    }),
  });
  const fileId = data.result?.id;
  console.log(`  ✓ ${slug}/${placement} → Printful file_id=${fileId}`);
  return fileId;
}

// ══════════════════════════════════════════════════
// STEP 4: Create Sync Product in Printful
// ══════════════════════════════════════════════════
async function createSyncProduct(product, frontFileId, backFileId) {
  const sync_variants = product.variants.map(v => ({
    variant_id: v.variantId,
    retail_price: (product.priceCents / 100).toFixed(2),
    is_enabled: true,
    files: [
      { type: 'embroidery_front', id: frontFileId },
      { type: 'embroidery_back', id: backFileId },
    ],
    options: [
      { id: product.threadOptionFront, value: v.threads.front },
      { id: 'thread_colors_back', value: v.threads.back },
    ],
  }));

  const data = await pf('/store/products', {
    method: 'POST',
    body: JSON.stringify({
      sync_product: {
        name: product.name,
      },
      sync_variants,
    }),
  });

  const pfProductId = data.result?.id;
  console.log(`  ✓ ${product.name}: Printful ID=${pfProductId}, variants=${data.result?.sync_variants?.length || 0}`);
  return data.result;
}

// ══════════════════════════════════════════════════
// STEP 5: Find Supabase category IDs
// ══════════════════════════════════════════════════
async function findCategoryId(slug) {
  const cats = await sb(`/rest/v1/categories?slug=eq.${slug}&select=id,slug`);
  if (cats.length > 0) return cats[0].id;
  // Fallback to parent
  const parent = await sb(`/rest/v1/categories?slug=eq.headwear&select=id`);
  return parent[0]?.id || null;
}

// ══════════════════════════════════════════════════
// STEP 6: Create Supabase product + variants
// ══════════════════════════════════════════════════
async function createSupabaseProduct(product, pfProduct, categoryId, supabaseUrls) {
  const productId = randomUUID();

  // Placeholder images (will be replaced with mockups later)
  const images = product.variants.map(v => ({
    src: supabaseUrls.front,
    alt: `${product.name} - ${v.color}`,
  }));

  const dbProduct = {
    id: productId,
    title: product.name,
    description: product.description.en,
    translations: {
      es: { title: product.name, description: product.description.es },
      de: { title: product.name, description: product.description.de },
    },
    category: product.category,
    category_id: categoryId,
    pod_provider: 'printful',
    product_template_id: String(product.catalogId),
    provider_product_id: String(pfProduct?.id || ''),
    base_price_cents: product.priceCents,
    compare_at_price_cents: product.compareAtCents,
    currency: 'EUR',
    images,
    product_details: {
      safety_information: product.gpsr,
      brand: 'SKAPARA',
      model: product.model,
      material: product.material,
      print_technique: 'Embroidery',
      manufacturing_country: 'LV',
      care_instructions: 'Spot clean only.',
    },
    status: 'active',
  };

  await sb('/rest/v1/products', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(dbProduct),
  });

  console.log(`  ✓ Supabase product: ${productId}`);

  // Create variants
  for (const v of product.variants) {
    const variant = {
      product_id: productId,
      title: `${product.name} / ${v.color} / One size`,
      color: v.color,
      size: 'One size',
      price_cents: product.priceCents,
      is_enabled: true,
      is_available: true,
      external_variant_id: String(v.variantId),
      image_url: supabaseUrls.front,
    };

    const res = await fetch(`${SB_URL}/rest/v1/product_variants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SB_KEY}`,
        'apikey': SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(variant),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`    ⚠ Variant ${v.color}: ${res.status} — ${text}`);
    } else {
      console.log(`    ✓ Variant: ${v.color} (${v.variantId})`);
    }
  }

  return productId;
}

// ══════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  4 Printful Caps — Full Pipeline');
  console.log('═══════════════════════════════════════════════');

  // Steps 1-3 already completed — use cached file IDs
  console.log('Steps 1-3 already completed (PNGs rendered, uploaded to Supabase + Printful)');

  // Supabase Storage URLs (already uploaded)
  const supabaseUrlsMap = {};
  for (const p of PRODUCTS) {
    supabaseUrlsMap[p.slug] = {
      front: `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/caps-${p.slug}/front.png?v=${ts}`,
      back: `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/caps-${p.slug}/back.png?v=${ts}`,
    };
  }

  // Printful File IDs (from previous run)
  const fileIdsMap = {
    'assignment': { front: 951496347, back: 951496364 },
    'ai-wrote-this': { front: 951496382, back: 951496447 },
    'dark-mode': { front: 951496461, back: 951496471 },
    'it-works': { front: 951496478, back: 951496500 },
  };

  // Step 4: Create Sync Products
  console.log('\n═══ Step 4: Create Sync Products ═══');
  const pfProducts = {};
  for (const p of PRODUCTS) {
    pfProducts[p.slug] = await createSyncProduct(
      p, fileIdsMap[p.slug].front, fileIdsMap[p.slug].back
    );
    await delay(3000);
  }

  // Step 5: Find category IDs
  console.log('\n═══ Step 5: Find Categories ═══');
  const categoryIds = {};
  const uniqueCategories = [...new Set(PRODUCTS.map(p => p.category))];
  for (const cat of uniqueCategories) {
    categoryIds[cat] = await findCategoryId(cat);
    console.log(`  ${cat}: ${categoryIds[cat] || 'NOT FOUND'}`);
  }

  // Step 6: Create Supabase products + variants
  console.log('\n═══ Step 6: Create Supabase Products ═══');
  const dbProductIds = {};
  for (const p of PRODUCTS) {
    dbProductIds[p.slug] = await createSupabaseProduct(
      p, pfProducts[p.slug], categoryIds[p.category], supabaseUrlsMap[p.slug]
    );
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════');
  console.log('  COMPLETE — 4 Products Created');
  console.log('═══════════════════════════════════════════════');
  for (const p of PRODUCTS) {
    console.log(`\n  ${p.name}:`);
    console.log(`    Printful: ${pfProducts[p.slug]?.id || 'N/A'}`);
    console.log(`    Supabase: ${dbProductIds[p.slug]}`);
    console.log(`    Category: ${p.category}`);
    console.log(`    Variants: ${p.variants.length}`);
    console.log(`    Price: €${(p.priceCents / 100).toFixed(2)} (compare €${(p.compareAtCents / 100).toFixed(2)})`);
  }
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
