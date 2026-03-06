#!/usr/bin/env node
/**
 * FASE 1 — Create 20 Products on Printify
 * Pipeline: Render SVG→PNG → Upload → Create Product → GPSR → Publish → Sync
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ── Config ─────────────────────────────────────────────────────────────
const envFile = readFileSync(join(import.meta.dirname, '../.env.local'), 'utf-8');
const env = (key) => {
  const m = envFile.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return m ? m[1].trim() : null;
};

const TOKEN = env('PRINTIFY_API_TOKEN');
const SHOP_ID = env('PRINTIFY_SHOP_ID');
const DESIGNS_DIR = join(import.meta.dirname, '../public/expansion-designs');
const ASSETS_DIR = join(DESIGNS_DIR, 'assets');
const RENDERS_DIR = join(DESIGNS_DIR, 'renders');

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── Printify API helper ────────────────────────────────────────────────
async function printifyAPI(method, path, body = null) {
  const url = `https://api.printify.com${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'POD-AI-Store/1.0'
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();

  if (!res.ok) {
    console.error(`  ✗ ${method} ${path} → ${res.status}`);
    console.error(`  Response: ${text.substring(0, 300)}`);
    throw new Error(`Printify API error: ${res.status}`);
  }

  return text ? JSON.parse(text) : {};
}

// ── Upload image to Printify ───────────────────────────────────────────
async function uploadImage(filePath, fileName) {
  const buf = readFileSync(filePath);
  const b64 = buf.toString('base64');
  console.log(`  Uploading ${fileName} (${Math.round(b64.length/1024)}KB)...`);

  const result = await printifyAPI('POST', '/v1/uploads/images.json', {
    file_name: fileName,
    contents: b64
  });

  console.log(`  ✓ Uploaded: ${result.id}`);
  return result.id;
}

// ── Render SVG to PNG ──────────────────────────────────────────────────
async function renderSVG(svgFile, width, height) {
  const svgPath = join(DESIGNS_DIR, svgFile);
  const pngPath = join(RENDERS_DIR, svgFile.replace('.svg', '.png'));

  if (existsSync(pngPath)) {
    console.log(`  PNG exists: ${svgFile.replace('.svg', '.png')}`);
    return pngPath;
  }

  const svgBuf = readFileSync(svgPath);
  await sharp(svgBuf)
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(pngPath);

  console.log(`  ✓ Rendered ${svgFile} → ${width}x${height} PNG`);
  return pngPath;
}

// ── Dark variant IDs for BP6 (S-3XL, 9 dark colors) ───────────────────
const BP6_DARK_VARIANTS = [
  // Black
  { id: 12126, color: 'Black', size: 'S' }, { id: 12125, color: 'Black', size: 'M' },
  { id: 12124, color: 'Black', size: 'L' }, { id: 12127, color: 'Black', size: 'XL' },
  { id: 12128, color: 'Black', size: '2XL' }, { id: 12129, color: 'Black', size: '3XL' },
  // Navy
  { id: 11988, color: 'Navy', size: 'S' }, { id: 11987, color: 'Navy', size: 'M' },
  { id: 11986, color: 'Navy', size: 'L' }, { id: 11989, color: 'Navy', size: 'XL' },
  { id: 11990, color: 'Navy', size: '2XL' }, { id: 11991, color: 'Navy', size: '3XL' },
  // Dark Heather
  { id: 11904, color: 'Dark Heather', size: 'S' }, { id: 11903, color: 'Dark Heather', size: 'M' },
  { id: 11902, color: 'Dark Heather', size: 'L' }, { id: 11905, color: 'Dark Heather', size: 'XL' },
  { id: 11906, color: 'Dark Heather', size: '2XL' },
  // Charcoal
  { id: 11874, color: 'Charcoal', size: 'S' }, { id: 11873, color: 'Charcoal', size: 'M' },
  { id: 11872, color: 'Charcoal', size: 'L' }, { id: 11875, color: 'Charcoal', size: 'XL' },
  { id: 11876, color: 'Charcoal', size: '2XL' },
  // Maroon
  { id: 11976, color: 'Maroon', size: 'S' }, { id: 11975, color: 'Maroon', size: 'M' },
  { id: 11974, color: 'Maroon', size: 'L' }, { id: 11977, color: 'Maroon', size: 'XL' },
  { id: 11978, color: 'Maroon', size: '2XL' }, { id: 11979, color: 'Maroon', size: '3XL' },
  // Forest Green
  { id: 12144, color: 'Forest Green', size: 'S' }, { id: 12143, color: 'Forest Green', size: 'M' },
  { id: 12142, color: 'Forest Green', size: 'L' }, { id: 12145, color: 'Forest Green', size: 'XL' },
  { id: 12146, color: 'Forest Green', size: '2XL' },
  // Military Green
  { id: 12192, color: 'Military Green', size: 'S' }, { id: 12191, color: 'Military Green', size: 'M' },
  { id: 12190, color: 'Military Green', size: 'L' }, { id: 12193, color: 'Military Green', size: 'XL' },
  { id: 12194, color: 'Military Green', size: '2XL' }, { id: 12195, color: 'Military Green', size: '3XL' },
  // Dark Chocolate
  { id: 11898, color: 'Dark Chocolate', size: 'S' }, { id: 11897, color: 'Dark Chocolate', size: 'M' },
  { id: 11896, color: 'Dark Chocolate', size: 'L' }, { id: 11899, color: 'Dark Chocolate', size: 'XL' },
  { id: 11900, color: 'Dark Chocolate', size: '2XL' }, { id: 11901, color: 'Dark Chocolate', size: '3XL' },
  // Purple
  { id: 12018, color: 'Purple', size: 'S' }, { id: 12017, color: 'Purple', size: 'M' },
  { id: 12016, color: 'Purple', size: 'L' }, { id: 12019, color: 'Purple', size: 'XL' },
  { id: 12020, color: 'Purple', size: '2XL' }, { id: 12021, color: 'Purple', size: '3XL' },
];

const BP6_VARIANT_IDS = BP6_DARK_VARIANTS.map(v => v.id);
const BP6_PRICE = 2995; // 29.95 EUR

// ── GPSR HTML for DTG products ─────────────────────────────────────────
const GPSR_DTG = `<p><strong>Manufacturer:</strong> Textildruck Europa GmbH, Germany</p>
<p><strong>Material:</strong> 100% Cotton (Gildan 5000 Heavy Cotton)</p>
<p><strong>Print technique:</strong> DTG (Direct-to-Garment) — water-based, eco-friendly inks</p>
<p><strong>Care:</strong> Machine wash cold, inside out. Tumble dry low. Do not iron on print.</p>
<p><strong>Compliance:</strong> REACH Regulation (EC) 1907/2006, OEKO-TEX Standard 100</p>
<p><strong>EU Responsible Person:</strong> Textildruck Europa GmbH, Germany</p>`;

// ── Product definitions ────────────────────────────────────────────────
const PRODUCTS = [
  {
    id: 'a01', svg: 'a01-life-is-soup.svg', title: 'Life Is Soup. I Am Fork.',
    desc: 'For those who realized that life gave them a fork when they needed a spoon. Existential kitchen wisdom on premium cotton.',
    placement: 'front', tags: ['skapara','existential','humor','absurd','soup','fork','meme'],
  },
  {
    id: 'a03', svg: 'a03-hang-in-there.svg', title: 'Hang In There — It Gets Worse',
    desc: 'The motivational poster nobody asked for. Sarcastic encouragement for realistic optimists.',
    placement: 'back', tags: ['skapara','sarcastic','humor','dark','pessimist','motivation'],
  },
  {
    id: 'a04', svg: 'a04-existential-dread.svg', title: 'Existential Dread? In This Economy?',
    desc: 'When you can\'t even afford a proper existential crisis. Merging economic anxiety with philosophical despair.',
    placement: 'front', tags: ['skapara','existential','economy','anxiety','humor','dread'],
  },
  {
    id: 'a05', svg: 'a05-nihilist-penguin.svg', title: 'Nihilist Penguin',
    desc: 'Going my own way. The viral 2026 meme penguin who found freedom in meaninglessness.',
    placement: 'front', tags: ['skapara','penguin','nihilist','meme','2026','viral','cute'],
  },
  {
    id: 'a07', svg: 'a07-404-purpose.svg', title: '404: Purpose Not Found',
    desc: 'The meaning you were looking for may have been moved or deleted. Tech-existentialism crossover.',
    placement: 'front', tags: ['skapara','404','tech','developer','purpose','error','code'],
  },
  {
    id: 'b01', svg: 'b01-youre-on-mute.svg', title: 'You\'re On Mute',
    desc: 'The three words that defined a generation of remote workers. We still can\'t hear you.',
    placement: 'front', tags: ['skapara','remote','work','zoom','mute','wfh','office'],
  },
  {
    id: 'b02', svg: 'b02-my-commute.svg', title: 'My Commute Is 7 Seconds',
    desc: 'Bed to desk in record time. The ultimate flex of the work-from-home lifestyle.',
    placement: 'front', tags: ['skapara','remote','commute','wfh','bed','desk','home'],
  },
  {
    id: 'c01', svg: 'c01-social-battery.svg', title: 'Social Battery: 3%',
    desc: 'Running critically low on social energy. Please recharge by leaving me alone.',
    placement: 'front', tags: ['skapara','introvert','battery','social','antisocial','energy'],
  },
  {
    id: 'c02', svg: 'c02-plans-cancelled.svg', title: 'Plans Cancelled: Best Day Ever',
    desc: 'When cancelled plans feel like winning the lottery. Introvert joy in its purest form.',
    placement: 'front', tags: ['skapara','introvert','plans','cancelled','happy','homebody'],
  },
  {
    id: 'd01', svg: 'd01-regulate-nervous-system.svg', title: 'Regulate Your Nervous System',
    desc: 'Wellness wisdom meets streetwear. The new "keep calm" for the therapy generation.',
    placement: 'back', tags: ['skapara','wellness','nervous','system','regulate','therapy','mindfulness'],
  },
  {
    id: 'd03', svg: 'd03-self-care-aggressive.svg', title: 'Self-Care Level: Aggressive',
    desc: 'When self-care goes from bubble baths to setting boundaries with extreme prejudice.',
    placement: 'front', tags: ['skapara','selfcare','aggressive','wellness','level','boundaries'],
  },
  {
    id: 'e01', svg: 'e01-2026-new-2016.svg', title: '2026 Is the New 2016',
    desc: 'The viral meme that captured 2026. Nostalgia hits different when history rhymes this hard.',
    placement: 'front', tags: ['skapara','2026','2016','nostalgia','meme','viral','culture'],
  },
  {
    id: 'e03', svg: 'e03-understood-assignment.svg', title: 'Understood the Assignment',
    desc: 'Assignment received. Assignment understood. No further questions needed.',
    placement: 'front', tags: ['skapara','assignment','understood','genz','slang','culture'],
  },
  {
    id: 'e05', svg: 'e05-main-character.svg', title: 'Main Character Energy',
    desc: 'Walking through life like you own the screenplay. Side character budget included.',
    placement: 'back', tags: ['skapara','main','character','energy','tiktok','self','confidence'],
  },
  {
    id: 'f02', svg: 'f02-caffeine-anxiety.svg', title: 'Powered by Caffeine & Anxiety',
    desc: 'The two fuels that keep modern civilization running. Honest energy disclosure.',
    placement: 'front', tags: ['skapara','caffeine','anxiety','coffee','powered','morning'],
  },
  {
    id: 'g01', svg: 'g01-nope.svg', title: 'NOPE.',
    desc: 'One word. Full stop. The ultimate conversation ender worn with pride.',
    placement: 'back', tags: ['skapara','nope','attitude','bold','streetwear','statement'],
  },
  {
    id: 'g04', svg: 'g04-do-not-read.svg', title: 'Do Not Read the Next Line',
    desc: 'You rebel. We like you. An interactive t-shirt that breaks the fourth wall.',
    placement: 'front', tags: ['skapara','rebel','interactive','humor','read','clever'],
  },
  {
    id: 'h02', svg: 'h02-made-on-demand.svg', title: 'Made on Demand. Not on a Sweatshop Floor.',
    desc: 'Fashion with a conscience. Every piece made to order, zero waste, zero exploitation.',
    placement: 'back', tags: ['skapara','ethical','demand','sustainable','pod','fashion'],
  },
  {
    id: 'h03', svg: 'h03-made-just-for-you.svg', title: 'This Shirt Was Made Just for You',
    desc: 'It literally didn\'t exist until you ordered it. That\'s the beauty of on-demand.',
    placement: 'front', tags: ['skapara','pod','unique','custom','meta','ondemand'],
  },
];

// ── Main pipeline ──────────────────────────────────────────────────────
async function main() {
  // Ensure renders dir
  execSync(`mkdir -p "${RENDERS_DIR}"`);

  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  FASE 1 — Creating 19 T-Shirts on Printify (BP6) ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // ── Step 1: Upload brand assets ────────────────────────────────────
  console.log('━━━ STEP 1: Upload Brand Assets ━━━\n');

  const smarkPath = join(ASSETS_DIR, 'skapara-mark-white-hires.png');
  const neckPath = join(ASSETS_DIR, 'neck-label-skapara-white.png');
  const wordmarkPath = join(ASSETS_DIR, 'skapara-wordmark-white.png');

  const smarkId = await uploadImage(smarkPath, 'skapara-mark-white.png');
  await delay(2000);
  const neckId = await uploadImage(neckPath, 'skapara-neck-label.png');
  await delay(2000);
  const wordmarkId = await uploadImage(wordmarkPath, 'skapara-wordmark-white.png');
  await delay(2000);

  console.log(`\n  Brand assets uploaded:`);
  console.log(`  S mark: ${smarkId}`);
  console.log(`  Neck label: ${neckId}`);
  console.log(`  Wordmark: ${wordmarkId}\n`);

  // ── Step 2: Process each product ───────────────────────────────────
  const results = [];

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    console.log(`\n━━━ PRODUCT ${i+1}/${PRODUCTS.length}: ${p.title} (${p.id.toUpperCase()}) ━━━\n`);

    try {
      // 2a. Render SVG → PNG
      console.log('  [1/5] Rendering SVG → PNG...');
      const pngPath = await renderSVG(p.svg, 4606, 5787);
      await delay(500);

      // 2b. Upload design
      console.log('  [2/5] Uploading design...');
      const designId = await uploadImage(pngPath, `${p.id}-design.png`);
      await delay(2000);

      // 2c. Build print_areas based on placement
      const allVariantIds = BP6_VARIANT_IDS;
      let placeholders = [];

      if (p.placement === 'back') {
        // Design on BACK, S mark on front left chest, neck label
        placeholders = [
          {
            position: 'front',
            images: [{ id: smarkId, x: 0.28, y: 0.22, scale: 0.3, angle: 0 }]
          },
          {
            position: 'back',
            images: [{ id: designId, x: 0.5, y: 0.45, scale: 1, angle: 0 }]
          },
          {
            position: 'neck_outer',
            images: [{ id: neckId, x: 0.5, y: 0.5, scale: 0.8, angle: 0 }]
          }
        ];
      } else {
        // Design on FRONT, wordmark on back, neck label
        placeholders = [
          {
            position: 'front',
            images: [{ id: designId, x: 0.5, y: 0.45, scale: 1, angle: 0 }]
          },
          {
            position: 'back',
            images: [{ id: wordmarkId, x: 0.5, y: 0.15, scale: 0.25, angle: 0 }]
          },
          {
            position: 'neck_outer',
            images: [{ id: neckId, x: 0.5, y: 0.5, scale: 0.8, angle: 0 }]
          }
        ];
      }

      // 2d. Create product
      console.log('  [3/5] Creating product on Printify...');
      const productBody = {
        title: p.title,
        description: p.desc,
        blueprint_id: 6,
        print_provider_id: 26,
        variants: BP6_DARK_VARIANTS.map(v => ({
          id: v.id,
          price: BP6_PRICE,
          is_enabled: true
        })),
        print_areas: [{
          variant_ids: allVariantIds,
          placeholders
        }],
        tags: p.tags
      };

      const product = await printifyAPI('POST', `/v1/shops/${SHOP_ID}/products.json`, productBody);
      console.log(`  ✓ Created: ${product.id}`);
      await delay(2000);

      // 2e. GPSR
      console.log('  [4/5] Setting GPSR safety info...');
      try {
        await printifyAPI('PUT', `/v1/shops/${SHOP_ID}/products/${product.id}/safety_information`, {
          safety_information: GPSR_DTG
        });
        console.log('  ✓ GPSR set');
      } catch (e) {
        console.log('  ⚠ GPSR failed (will retry later):', e.message);
      }
      await delay(1500);

      // 2f. Publish
      console.log('  [5/5] Publishing...');
      await printifyAPI('POST', `/v1/shops/${SHOP_ID}/products/${product.id}/publish.json`, {
        title: true,
        description: true,
        images: true,
        variants: true,
        tags: true,
        keyFeatures: true,
        shipping_template: true
      });
      console.log('  ✓ Published');
      await delay(1500);

      // Confirm publishing
      await printifyAPI('POST', `/v1/shops/${SHOP_ID}/products/${product.id}/publishing_succeeded.json`, {
        external: {
          id: product.id,
          handle: `/shop/${product.id}`
        }
      });
      console.log('  ✓ Publishing confirmed');

      results.push({ id: p.id, title: p.title, printifyId: product.id, status: 'OK' });
      console.log(`  ══ ${p.title} DONE ══`);

      await delay(3000); // Rate limit between products

    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ id: p.id, title: p.title, status: 'FAILED', error: err.message });
      await delay(3000);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n\n╔══════════════════════════════════════════════╗');
  console.log('║              RESULTS SUMMARY                 ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const ok = results.filter(r => r.status === 'OK');
  const fail = results.filter(r => r.status === 'FAILED');

  console.log(`✓ Success: ${ok.length}/${results.length}`);
  console.log(`✗ Failed: ${fail.length}/${results.length}\n`);

  ok.forEach(r => console.log(`  ✓ ${r.id.toUpperCase()} — ${r.title} (${r.printifyId})`));
  fail.forEach(r => console.log(`  ✗ ${r.id.toUpperCase()} — ${r.title}: ${r.error}`));

  // Save results
  writeFileSync(join(DESIGNS_DIR, 'phase1-results.json'), JSON.stringify(results, null, 2));
  console.log('\nResults saved to phase1-results.json');
}

main().catch(console.error);
