#!/usr/bin/env node
/**
 * Finalize Vibe·Coded Beanie — Supabase product + variants
 * Printful product already created: ID=422460297
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

const envPath = resolve(import.meta.dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const SB_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_KEY;
const ts = Math.floor(Date.now() / 1000);

const VARIANTS = [
  { color: 'Black', slug: 'black', variantId: 13238 },
  { color: 'Navy', slug: 'navy', variantId: 13241 },
  { color: 'Olive', slug: 'olive', variantId: 13242 },
  { color: 'Mustard', slug: 'mustard', variantId: 13240 },
  { color: 'Light Grey Melange', slug: 'lt-grey', variantId: 13239 },
  { color: 'Beige', slug: 'beige', variantId: 15016 },
  { color: 'Light Blue', slug: 'lt-blue', variantId: 15019 },
  { color: 'Acid Green', slug: 'acid-green', variantId: 15020 },
];

async function sb(path, opts = {}) {
  const res = await fetch(`${SB_URL}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${SB_KEY}`,
      'apikey': SB_KEY,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${path}: ${res.status} — ${t}`);
  }
  const ct = res.headers.get('content-type');
  return ct?.includes('json') ? res.json() : res.text();
}

async function main() {
  console.log('═══ Finalize Vibe·Coded Beanie — Supabase ═══\n');

  // Find category
  let cats = await sb('/rest/v1/categories?slug=eq.beanies&select=id,slug');
  let categoryId = cats[0]?.id;
  if (!categoryId) {
    cats = await sb('/rest/v1/categories?slug=eq.headwear&select=id');
    categoryId = cats[0]?.id;
  }
  console.log(`Category: ${categoryId}`);

  const supabaseUrls = {};
  for (const v of VARIANTS) {
    supabaseUrls[v.slug] = `${SB_URL}/storage/v1/object/public/designs/embroidery-sources/vibe-coded-beanie/front-${v.slug}.png?v=${ts}`;
  }

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
    provider_product_id: '422460297',
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

  console.log('\n── Creating product ──');
  const [inserted] = await sb('/rest/v1/products', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(product),
  });
  console.log(`✓ Product: ${inserted.id}`);

  console.log('\n── Creating variants ──');
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
      const t = await res.text();
      console.log(`  ⚠ ${v.color}: ${res.status} — ${t}`);
    } else {
      console.log(`  ✓ ${v.color} (${v.variantId})`);
    }
  }

  console.log('\n═══ COMPLETE ═══');
  console.log(`Supabase product: ${productId}`);
  console.log(`Printful product: 422460297`);
  console.log(`Variants: 8 × One size`);
  console.log(`Price: €34.99`);
}

main().catch(err => {
  console.error('\n✗ FATAL:', err.message);
  process.exit(1);
});
