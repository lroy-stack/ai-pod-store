import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();
const SB_URL = get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');
const supabase = createClient(SB_URL, SB_KEY);

const DIR = '/Users/lr0y/POD-AI-PDR/pod_workspace/project/frontend/public/brand-designs/trendi';
const SLUG = 'trendi-hoodie';
const PRODUCT_ID = 'dd5cdc0b-718d-4b33-b1aa-def20fee3095'; // existing Trendi DB ID
const PF_SYNC_ID = '422446946'; // new DTFilm sync product
const ts = Math.floor(Date.now() / 1000);

const MOCKUPS = [
  { file: 'trendi-black-back.png', path: `mockups/${SLUG}/black-back.png` },
  { file: 'trendi-black-front.png', path: `mockups/${SLUG}/black-front.png` },
  { file: 'trendi-black-sleeve.png', path: `mockups/${SLUG}/black-left.png` },
  { file: 'trendi-white-back.png', path: `mockups/${SLUG}/white-back.png` },
  { file: 'trendi-white-front.png', path: `mockups/${SLUG}/white-front.png` },
  { file: 'trendi-white-sleeve.png', path: `mockups/${SLUG}/white-left.png` },
];

async function main() {
  // Step 1: Upload mockups to Supabase Storage
  console.log('=== Step 1: Upload mockups to Supabase Storage ===');
  for (const m of MOCKUPS) {
    const data = fs.readFileSync(`${DIR}/${m.file}`);
    console.log(`  ${m.file} (${(data.length / 1024).toFixed(0)} KB) → designs/${m.path}`);
    const { error } = await supabase.storage.from('designs').upload(m.path, data, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`Upload failed ${m.path}: ${error.message}`);
  }
  console.log('  ✓ All 6 mockups uploaded\n');

  // Build image URLs — BACK FIRST as hero
  const url = (path) => `${SB_URL}/storage/v1/object/public/designs/${path}?v=${ts}`;
  const images = [
    // Hero: Black Back (first image user sees)
    { src: url(`mockups/${SLUG}/black-back.png`), alt: 'Trendi Hoodie - Black - Back' },
    // White Back
    { src: url(`mockups/${SLUG}/white-back.png`), alt: 'Trendi Hoodie - White - Back' },
    // Fronts
    { src: url(`mockups/${SLUG}/black-front.png`), alt: 'Trendi Hoodie - Black' },
    { src: url(`mockups/${SLUG}/white-front.png`), alt: 'Trendi Hoodie - White' },
    // Sleeves
    { src: url(`mockups/${SLUG}/black-left.png`), alt: 'Trendi Hoodie - Black - Sleeve' },
    { src: url(`mockups/${SLUG}/white-left.png`), alt: 'Trendi Hoodie - White - Sleeve' },
  ];

  // Step 2: Update product in Supabase
  console.log('=== Step 2: Update product in Supabase ===');

  const { data: existing, error: fetchErr } = await supabase
    .from('products')
    .select('id, title, provider_product_id')
    .eq('id', PRODUCT_ID)
    .single();

  if (fetchErr) {
    console.log('  Product not found, will create new');
  } else {
    console.log(`  Found: ${existing.title} (provider: ${existing.provider_product_id})`);
  }

  const productData = {
    id: PRODUCT_ID,
    title: 'Trendi Hoodie',
    description: 'Bold maximalist streetwear meets retro-cyberpunk design. The back tells the full SKAPARA story — layered typography, iconic S mark, and the unmistakable 2026 stamp. Premium Cotton Heritage M2580 pullover with kangaroo pocket.',
    translations: {
      es: {
        title: 'Trendi Hoodie',
        description: 'Streetwear maximalista con diseño retro-cyberpunk. La parte trasera cuenta la historia completa de SKAPARA — tipografía en capas, el icónico S mark y el inconfundible sello 2026. Sudadera premium Cotton Heritage M2580 con bolsillo canguro.'
      },
      de: {
        title: 'Trendi Hoodie',
        description: 'Kühner maximalistischer Streetwear trifft Retro-Cyberpunk-Design. Die Rückseite erzählt die vollständige SKAPARA-Geschichte — geschichtete Typografie, ikonisches S-Mark und der unverwechselbare 2026-Stempel. Premium Cotton Heritage M2580 Pullover mit Känguru-Tasche.'
      }
    },
    pod_provider: 'printful',
    product_template_id: '380',
    provider_product_id: PF_SYNC_ID,
    base_price_cents: 5995,
    compare_at_price_cents: 6995,
    images,
    product_details: {
      safety_information: '<p><strong>Manufacturer:</strong> Printful Inc., Gandijas Dambis 15, Riga, Latvia LV-1045</p><p><strong>Material:</strong> 100% cotton face / 65% ring-spun cotton, 35% polyester</p><p><strong>Weight:</strong> 8.5 oz/yd²</p><p><strong>Compliance:</strong> REACH, OEKO-TEX Standard 100</p>',
      material: '100% cotton face / 65% ring-spun cotton, 35% polyester, 8.5 oz/yd²',
      care_instructions: 'Machine wash cold, inside out. Tumble dry low. Do not bleach. Iron on low heat, avoid print area.',
      print_technique: 'DTFilm (Direct-to-Film)',
      manufacturing_country: 'Latvia',
      brand: 'SKAPARA',
      model: 'Cotton Heritage M2580',
      tier: 'PREMIUM',
      fit: 'Classic Streetwear / Pullover Hoodie',
      sizing_note: 'Runs small — recommend ordering one size up'
    },
    status: 'active'
  };

  const { error: upsertErr } = await supabase.from('products').upsert(productData);
  if (upsertErr) throw new Error(`Product upsert failed: ${upsertErr.message}`);
  console.log('  ✓ Product upserted\n');

  // Step 3: Create/update product variants
  console.log('=== Step 3: Upsert product variants ===');

  const COLORS = [
    { color: 'Black', hex: '#080808', slug: 'black', variants: { S: 10779, M: 10780, L: 10781, XL: 10782, '2XL': 10783, '3XL': 13416 } },
    { color: 'White', hex: '#ffffff', slug: 'white', variants: { S: 10774, M: 10775, L: 10776, XL: 10777, '2XL': 10778, '3XL': 13421 } },
  ];

  for (const c of COLORS) {
    for (const [size, variantId] of Object.entries(c.variants)) {
      const { error } = await supabase.from('product_variants').upsert({
        product_id: PRODUCT_ID,
        color: c.color,
        color_hex: c.hex,
        size,
        is_enabled: true,
        external_variant_id: String(variantId),
        image_url: url(`mockups/${SLUG}/${c.slug}-front.png`),
      }, { onConflict: 'product_id,color,size' });
      if (error) console.log(`  ⚠ Variant ${c.color}/${size}: ${error.message}`);
    }
    console.log(`  ✓ ${c.color}: 6 sizes`);
  }

  console.log('\n=== DONE ===');
  console.log(`Product ID: ${PRODUCT_ID}`);
  console.log(`Printful Sync: ${PF_SYNC_ID}`);
  console.log(`Hero image: Black Back`);
  console.log(`Total images: ${images.length}`);
  console.log(`Variants: 12 (2 colors × 6 sizes)`);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
