#!/usr/bin/env node
/**
 * Universal Printful Product Creation Pipeline
 *
 * Usage:
 *   node scripts/create-product-printful.mjs --config configs/new-wave-crewneck.json
 *   node scripts/create-product-printful.mjs --config configs/new-wave-crewneck.json --resume --step 5
 *   node scripts/create-product-printful.mjs --config configs/new-wave-crewneck.json --only mockups
 *   node scripts/create-product-printful.mjs --config configs/new-wave-crewneck.json --dry-run
 *
 * Config files live in scripts/configs/*.json
 * State is persisted in scripts/state/{slug}.json for resume capability
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { createPrintfulClient, delay } from './lib/printful-rate-limiter.mjs';

// ─── Parse CLI Args ──────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const configPath = getArg('config');
const resumeFromStep = hasFlag('resume') ? parseInt(getArg('step') || '1') : null;
const onlyPhase = getArg('only'); // 'mockups', 'supabase', 'printful'
const dryRun = hasFlag('dry-run');

if (!configPath) {
  console.error('Usage: node scripts/create-product-printful.mjs --config configs/<product>.json');
  console.error('Options: --resume --step N, --only mockups|supabase|printful, --dry-run');
  process.exit(1);
}

// ─── Load Config ─────────────────────────────────────────────
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const slug = config.product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');

// ─── Load Environment ────────────────────────────────────────
const envFile = readFileSync('.env.local', 'utf8');
const env = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  if (!m) throw new Error(`Missing env: ${key}`);
  return m[1].trim().replace(/^["']|["']$/g, '');
};

const PF_TOKEN = env('PRINTFUL_API_TOKEN');
const PF_STORE = env('PRINTFUL_STORE_ID');
const SB_URL = env('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = env('SUPABASE_SERVICE_KEY');

const pf = createPrintfulClient(PF_TOKEN, PF_STORE);
const supabase = createClient(SB_URL, SB_KEY);

// ─── State Management ────────────────────────────────────────
const stateDir = 'scripts/state';
const statePath = `${stateDir}/${slug}.json`;

function loadState() {
  if (!existsSync(stateDir)) mkdirSync(stateDir, { recursive: true });
  if (existsSync(statePath)) return JSON.parse(readFileSync(statePath, 'utf8'));
  return { slug, created_at: new Date().toISOString(), completed_steps: [] };
}

function saveState(state) {
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function markStep(state, step, data) {
  state[`step_${step}`] = data;
  if (!state.completed_steps.includes(step)) state.completed_steps.push(step);
  saveState(state);
  console.log(`  [checkpoint] Step ${step} saved\n`);
}

function shouldRun(step) {
  if (dryRun) return false;
  if (onlyPhase === 'mockups' && step < 7) return false;
  if (onlyPhase === 'supabase' && (step < 5 || step > 6)) return false;
  if (onlyPhase === 'printful' && step > 4) return false;
  if (resumeFromStep && step < resumeFromStep) return false;
  return true;
}

// ─── Pricing Helpers ─────────────────────────────────────────
function getSalePrice(size) {
  const tiers = config.pricing.tiers;
  for (const [range, prices] of Object.entries(tiers)) {
    const sizes = expandSizeRange(range);
    if (sizes.includes(size)) return prices.sale;
  }
  return Object.values(tiers)[0].sale; // fallback to first tier
}

function getOriginalPrice(size) {
  const tiers = config.pricing.tiers;
  for (const [range, prices] of Object.entries(tiers)) {
    const sizes = expandSizeRange(range);
    if (sizes.includes(size)) return prices.original;
  }
  return Object.values(tiers)[0].original;
}

function getRetailPrice(size) {
  const rp = config.pricing.retailPrices;
  for (const [range, price] of Object.entries(rp)) {
    const sizes = expandSizeRange(range);
    if (sizes.includes(size)) return price;
  }
  return Object.values(rp)[0];
}

function expandSizeRange(range) {
  const allSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  const parts = range.split('-');
  if (parts.length === 1) return [parts[0]];
  const start = allSizes.indexOf(parts[0]);
  const end = allSizes.indexOf(parts[1]);
  if (start < 0 || end < 0) return [range];
  return allSizes.slice(start, end + 1);
}

// ─── Pipeline Steps ──────────────────────────────────────────

async function step1_renderDesigns(state) {
  console.log('═══ STEP 1: Render SVGs → PNGs ═══\n');
  const rendered = {};

  for (const [placement, design] of Object.entries(config.designs)) {
    const canvas = config.catalog.canvases[placement];
    if (!canvas) { console.log(`  ⚠ No canvas for ${placement}, skipping`); continue; }

    const svgPath = design.svg;
    if (!existsSync(svgPath)) {
      console.error(`  ✗ SVG not found: ${svgPath}`);
      continue;
    }

    const outPath = `/tmp/${slug}-${placement}-${canvas.w}x${canvas.h}.png`;
    const renderArgs = design.renderArgs || `-density 150 -background none`;
    const cmd = `magick ${renderArgs} "${svgPath}" PNG32:"${outPath}"`;

    console.log(`  ▶ ${placement}: ${svgPath}`);
    console.log(`    ${cmd}`);
    execSync(cmd, { stdio: 'pipe' });
    console.log(`  ✓ ${outPath}`);

    rendered[placement] = outPath;
  }

  markStep(state, 1, { rendered_pngs: rendered });
  return rendered;
}

async function step2_uploadToSupabase(state) {
  console.log('═══ STEP 2: Upload PNGs → Supabase Storage ═══\n');
  const rendered = state.step_1?.rendered_pngs || {};
  const urls = {};

  for (const [placement, localPath] of Object.entries(rendered)) {
    const canvas = config.catalog.canvases[placement];
    const filename = `${placement}-${canvas.w}x${canvas.h}.png`;
    const storagePath = `designs/${slug}/${filename}`;

    const fileData = readFileSync(localPath);
    const { error } = await supabase.storage.from('designs').upload(storagePath, fileData, {
      contentType: 'image/png', upsert: true
    });
    if (error) { console.error(`  ✗ ${filename}:`, error.message); continue; }

    const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
    urls[placement] = data.publicUrl;
    console.log(`  ✓ ${filename}`);
  }

  markStep(state, 2, { supabase_urls: urls });
  return urls;
}

async function step3_uploadToPrintful(state) {
  console.log('═══ STEP 3: Upload → Printful File Library ═══\n');
  const urls = state.step_2?.supabase_urls || {};
  const fileIds = {};
  const ts = Date.now();

  for (const [placement, publicUrl] of Object.entries(urls)) {
    const canvas = config.catalog.canvases[placement];
    const filename = `${slug}-${placement}-${canvas.w}x${canvas.h}.png`;

    const result = await pf.fetch('/files', {
      method: 'POST',
      body: JSON.stringify({ url: `${publicUrl}?v=${ts}`, filename })
    });
    fileIds[placement] = result.id;
    console.log(`  ✓ ${placement}: file_id=${result.id}`);
    await delay(3000);
  }

  markStep(state, 3, { printful_file_ids: fileIds });
  return fileIds;
}

async function step4_createSyncProduct(state) {
  console.log('═══ STEP 4: Create Printful Sync Product ═══\n');
  const fileIds = state.step_3?.printful_file_ids || {};

  // Build files array for each variant
  const files = Object.entries(fileIds).map(([placement, id]) => ({
    type: placement === 'front' ? 'default' : placement,
    id
  }));

  // Build sync_variants: all colors × all sizes
  const syncVariants = [];
  for (const color of config.colors) {
    for (const [size, variantId] of Object.entries(color.variants)) {
      syncVariants.push({
        variant_id: variantId,
        retail_price: getRetailPrice(size),
        files
      });
    }
  }

  console.log(`  ▶ Creating ${syncVariants.length} variants...`);
  const result = await pf.fetch('/store/products', {
    method: 'POST',
    body: JSON.stringify({
      sync_product: {
        name: `${config.product.title} — SKAPARA`,
        thumbnail: state.step_2?.supabase_urls?.front || ''
      },
      sync_variants: syncVariants
    })
  });

  const pfProductId = result.id;
  console.log(`  ✓ Printful sync product: ${pfProductId}`);

  markStep(state, 4, { pf_product_id: pfProductId });
  return pfProductId;
}

async function step5_createSupabaseProduct(state) {
  console.log('═══ STEP 5: Create Supabase Product ═══\n');
  const productId = state.sb_product_id || randomUUID();

  const firstTierSale = Object.values(config.pricing.tiers)[0].sale;
  const firstTierOriginal = Object.values(config.pricing.tiers)[0].original;

  const productData = {
    id: productId,
    title: config.product.title,
    description: config.product.description,
    translations: config.product.translations || {},
    category: config.product.category,
    category_id: config.product.category_id,
    tags: config.product.tags || [],
    base_price_cents: firstTierSale,
    compare_at_price_cents: firstTierOriginal,
    pod_provider: 'printful',
    product_template_id: String(config.catalog.id),
    provider_product_id: state.step_4?.pf_product_id ? String(state.step_4.pf_product_id) : null,
    product_details: {
      safety_information: `<p><strong>Manufacturer:</strong> ${config.gpsr.manufacturer}</p><p><strong>Material:</strong> ${config.gpsr.material}</p><p><strong>Compliance:</strong> ${config.gpsr.compliance}</p>`,
      material: config.gpsr.material,
      care_instructions: config.gpsr.care_instructions,
      print_technique: config.gpsr.print_technique,
      manufacturing_country: config.gpsr.manufacturing_country,
      brand: 'SKAPARA',
      model: config.catalog.model,
      tier: config.product.tier,
    },
    status: 'active'
  };

  const { error } = await supabase.from('products').upsert(productData);
  if (error) { console.error('  ✗', error); throw error; }
  console.log(`  ✓ Product: ${productId}`);

  markStep(state, 5, { sb_product_id: productId });
  return productId;
}

async function step6_createSupabaseVariants(state) {
  console.log('═══ STEP 6: Create Supabase Variants ═══\n');
  const productId = state.step_5?.sb_product_id;
  if (!productId) throw new Error('Missing sb_product_id from step 5');

  let count = 0;
  for (const color of config.colors) {
    for (const [size, variantId] of Object.entries(color.variants)) {
      const { error } = await supabase.from('product_variants').upsert({
        product_id: productId,
        color: color.name,
        color_hex: color.hex,
        size,
        price_cents: getSalePrice(size),
        external_variant_id: String(variantId),
        is_enabled: true
      });
      if (error) console.error(`  ✗ ${color.name}/${size}:`, error.message);
      else count++;
    }
  }
  console.log(`  ✓ ${count} variants created`);

  markStep(state, 6, { variants_created: count });
  return count;
}

async function step7_generateMockups(state) {
  console.log('═══ STEP 7: Generate Mockups ═══\n');

  // Get preview URLs from Printful (the uploaded design files)
  const pfProductId = state.step_4?.pf_product_id;
  let previewUrls = {};

  if (pfProductId) {
    console.log('  ▶ Fetching design preview URLs from Printful...');
    await delay(5000); // Wait for file processing
    const productData = await pf.fetch(`/store/products/${pfProductId}`);
    const files = productData.sync_variants[0]?.files || [];
    for (const f of files) {
      const placement = f.type === 'default' ? 'front' : f.type;
      if (f.preview_url) previewUrls[placement] = f.preview_url;
    }
    console.log(`  ✓ Got ${Object.keys(previewUrls).length} preview URLs`);
  } else {
    // Use Supabase URLs as fallback
    previewUrls = state.step_2?.supabase_urls || {};
    console.log('  ⚠ No Printful product — using Supabase URLs');
  }

  const catalogId = config.catalog.id;
  const mockupConfig = config.mockups;
  const allMockups = [];

  // Build files array for mockup generator
  const mockupFiles = [];
  for (const [placement, url] of Object.entries(previewUrls)) {
    const canvas = config.catalog.canvases[placement];
    if (!canvas) continue;
    mockupFiles.push({
      placement,
      image_url: url,
      position: { area_width: canvas.w, area_height: canvas.h, width: canvas.w, height: canvas.h, top: 0, left: 0 }
    });
  }

  for (const color of config.colors) {
    // Use first size's variant ID for mockup generation
    const variantId = Object.values(color.variants)[0];
    console.log(`  ▶ ${color.name} (variant ${variantId})...`);

    const taskRes = await pf.fetch(`/mockup-generator/create-task/${catalogId}`, {
      method: 'POST',
      body: JSON.stringify({
        variant_ids: [variantId],
        format: 'png',
        width: 1000,
        option_groups: mockupConfig.option_groups,
        options: mockupConfig.options,
        files: mockupFiles
      })
    });

    const taskKey = taskRes.task_key;
    if (!taskKey) { console.log('    ✗ No task_key'); await delay(15000); continue; }

    // Poll for completion
    let result = null;
    for (let i = 0; i < 30; i++) {
      await delay(4000);
      const status = await pf.fetch(`/mockup-generator/task?task_key=${taskKey}`);
      if (status.status === 'completed') { result = status; break; }
      if (status.status === 'failed') { console.log('    ✗ Failed'); break; }
      process.stdout.write('.');
    }

    if (result?.mockups) {
      // Dedup by placement (Vintage Black bug: API returns duplicate sleeve_left)
      const seen = new Set();
      for (const m of result.mockups) {
        const view = m.placement === 'front' ? 'front'
          : m.placement === 'back' ? 'back'
          : m.placement === 'sleeve_left' ? 'sleeve'
          : m.placement;
        const key = `${color.slug}-${view}`;
        if (mockupConfig.dedup && seen.has(key)) { continue; }
        seen.add(key);
        allMockups.push({ color: color.name, slug: color.slug, view, url: m.mockup_url });
      }
      console.log(`\n    ✓ ${seen.size} unique mockups`);
    }

    console.log('    Waiting 12s...');
    await delay(12000);
  }

  markStep(state, 7, { mockup_urls: allMockups });
  return allMockups;
}

async function step8_uploadMockups(state) {
  console.log('═══ STEP 8: Download + Upload Mockups ═══\n');
  const allMockups = state.step_7?.mockup_urls || [];
  const uploadedMockups = [];

  for (const m of allMockups) {
    const filename = `${m.slug}-${m.view}.png`;
    const storagePath = `designs/mockups/${slug}/${filename}`;

    try {
      const imgRes = await fetch(m.url);
      if (!imgRes.ok) { console.log(`  ✗ Download: ${filename} (${imgRes.status})`); continue; }
      const buffer = Buffer.from(await imgRes.arrayBuffer());

      const { error } = await supabase.storage.from('designs').upload(storagePath, buffer, {
        contentType: 'image/png', upsert: true
      });
      if (error) { console.log(`  ✗ Upload: ${filename}: ${error.message}`); continue; }

      const { data } = supabase.storage.from('designs').getPublicUrl(storagePath);
      uploadedMockups.push({
        color: m.color, slug: m.slug, view: m.view, url: data.publicUrl,
        alt: m.view === 'sleeve' ? `${config.product.title} - ${m.color} - Sleeve`
          : m.view === 'back' ? `${config.product.title} - ${m.color} - Back`
          : `${config.product.title} - ${m.color}`
      });
      console.log(`  ✓ ${filename}`);
    } catch (err) {
      console.error(`  ✗ ${filename}:`, err.message);
    }
    await delay(300);
  }

  markStep(state, 8, { mockup_storage_urls: uploadedMockups });
  return uploadedMockups;
}

async function step9_updateProductImages(state) {
  console.log('═══ STEP 9: Update Product Images ═══\n');
  const mockupUrls = state.step_8?.mockup_storage_urls || [];
  const productId = state.step_5?.sb_product_id;
  if (!productId) throw new Error('Missing sb_product_id from step 5');

  const imgTs = Math.floor(Date.now() / 1000);

  // Group by view type: backs first (hero), then fronts, then sleeves
  const backs = mockupUrls.filter(m => m.view === 'back');
  const fronts = mockupUrls.filter(m => m.view === 'front');
  const sleeves = mockupUrls.filter(m => m.view === 'sleeve');

  // If no backs, fronts are hero
  const ordered = backs.length > 0 ? [...backs, ...fronts, ...sleeves] : [...fronts, ...sleeves];
  const images = ordered.map(m => ({
    src: `${m.url}?v=${imgTs}`,
    alt: m.alt
  }));

  const { error } = await supabase.from('products').update({ images }).eq('id', productId);
  if (error) { console.error('  ✗', error); throw error; }
  console.log(`  ✓ ${images.length} images (${backs.length}B + ${fronts.length}F + ${sleeves.length}S)`);

  // Update variant image_url (hero view per color)
  const heroView = backs.length > 0 ? backs : fronts;
  for (const color of config.colors) {
    const heroMockup = heroView.find(m => m.slug === color.slug);
    if (heroMockup) {
      await supabase.from('product_variants')
        .update({ image_url: `${heroMockup.url}?v=${imgTs}` })
        .eq('product_id', productId)
        .eq('color', color.name);
    }
  }
  console.log('  ✓ Variant hero images updated');

  markStep(state, 9, { images_updated: images.length });
}

async function step10_verify(state) {
  console.log('═══ STEP 10: Verification ═══\n');
  const productId = state.step_5?.sb_product_id;
  if (!productId) { console.log('  ⚠ No product ID — skipping verification'); return; }

  const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();
  const { data: variants } = await supabase.from('product_variants').select('*').eq('product_id', productId);

  console.log(`  Product: ${product?.title}`);
  console.log(`  Status: ${product?.status}`);
  console.log(`  Images: ${product?.images?.length || 0}`);
  console.log(`  Base price: €${(product?.base_price_cents / 100).toFixed(2)}`);
  console.log(`  Compare at: €${(product?.compare_at_price_cents / 100).toFixed(2)}`);
  console.log(`  Provider: ${product?.pod_provider}`);
  console.log(`  Template: ${product?.product_template_id}`);
  console.log(`  Variants: ${variants?.length || 0}`);
  console.log(`  Enabled: ${variants?.filter(v => v.is_enabled).length || 0}`);

  // Check GPSR
  const gpsr = product?.product_details?.safety_information;
  console.log(`  GPSR: ${gpsr ? '✓ Present' : '✗ MISSING'}`);

  // Check translations
  const trans = product?.translations;
  console.log(`  Translations: ${trans ? Object.keys(trans).join(', ') : '✗ MISSING'}`);

  markStep(state, 10, { verified: true, summary: {
    product_id: productId,
    title: product?.title,
    variants: variants?.length,
    images: product?.images?.length,
    status: product?.status
  }});
}

// ─── Main Pipeline ───────────────────────────────────────────
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Printful Product Pipeline — ${config.product.title}`);
  console.log(`║  Catalog: ${config.catalog.model} (${config.catalog.id})`);
  console.log(`║  Colors: ${config.colors.length} × Sizes: ${Object.keys(config.colors[0].variants).length}`);
  console.log(`║  Slug: ${slug}`);
  if (dryRun) console.log(`║  MODE: DRY RUN`);
  if (resumeFromStep) console.log(`║  MODE: RESUME from step ${resumeFromStep}`);
  if (onlyPhase) console.log(`║  MODE: ONLY ${onlyPhase}`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  const state = loadState();
  state.config_path = configPath;
  state.slug = slug;

  const steps = [
    { num: 1, name: 'Render SVGs → PNGs', fn: step1_renderDesigns },
    { num: 2, name: 'Upload PNGs → Supabase Storage', fn: step2_uploadToSupabase },
    { num: 3, name: 'Upload → Printful File Library', fn: step3_uploadToPrintful },
    { num: 4, name: 'Create Printful sync product', fn: step4_createSyncProduct },
    { num: 5, name: 'Create Supabase product', fn: step5_createSupabaseProduct },
    { num: 6, name: 'Create Supabase variants', fn: step6_createSupabaseVariants },
    { num: 7, name: 'Generate mockups (with dedup)', fn: step7_generateMockups },
    { num: 8, name: 'Download + upload mockups', fn: step8_uploadMockups },
    { num: 9, name: 'Update product images', fn: step9_updateProductImages },
    { num: 10, name: 'Verification', fn: step10_verify },
  ];

  if (dryRun) {
    console.log('DRY RUN — Steps that would execute:\n');
    for (const step of steps) {
      // Check if step would run WITHOUT dry-run flag
      const wouldSkip = (onlyPhase === 'mockups' && step.num < 7)
        || (onlyPhase === 'supabase' && (step.num < 5 || step.num > 6))
        || (onlyPhase === 'printful' && step.num > 4)
        || (resumeFromStep && step.num < resumeFromStep);
      const skipped = wouldSkip ? ' (SKIP)' : '';
      const completed = state.completed_steps?.includes(step.num) ? ' ✓' : '';
      console.log(`  ${step.num}. ${step.name}${skipped}${completed}`);
    }
    console.log(`\nConfig: ${configPath}`);
    console.log(`State: ${statePath}`);
    return;
  }

  for (const step of steps) {
    if (!shouldRun(step.num)) {
      const completed = state.completed_steps?.includes(step.num) ? ' ✓' : '';
      console.log(`  [skip] Step ${step.num}: ${step.name}${completed}\n`);
      continue;
    }
    try {
      await step.fn(state);
    } catch (err) {
      console.error(`\n  ✗ Step ${step.num} failed: ${err.message}`);
      console.error(`  Resume with: node scripts/create-product-printful.mjs --config ${configPath} --resume --step ${step.num}`);
      saveState(state);
      process.exit(1);
    }
  }

  console.log('\n═══ PIPELINE COMPLETE ═══');
  console.log(`  State: ${statePath}`);
  console.log(`  Product: ${state.step_5?.sb_product_id || 'N/A'}`);
  console.log(`  Printful: ${state.step_4?.pf_product_id || 'N/A'}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
