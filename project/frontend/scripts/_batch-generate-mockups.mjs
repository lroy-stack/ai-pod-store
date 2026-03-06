#!/usr/bin/env node
/**
 * Batch mockup generation for all 16 Printful products (11 CC1717 + 5 MC1087).
 *
 * For each product × selected dark colors:
 *   1. Create Ghost mockup task via Printful API
 *   2. Poll until completed
 *   3. Extract front from mockup_url + Back/Left from extra[]
 *   4. Download from temporary S3
 *   5. Upload to Supabase Storage
 *   6. Update products.images[] in Supabase with cache-busting
 *
 * IMPORTANT: Printful returns ONE mockup object per color in mockups[].
 * Front = mockup_url. Back/Left = extra[].title + extra[].url.
 * extra[] does NOT have variant_id — it inherits from parent mockups[].variant_ids[].
 *
 * CC1717 (catalog 586): 4 universal + per-design colors (6-8 total), 3 views each
 * MC1087 (catalog 917): Black, Navy Blazer, Vintage Black — 3 views each
 */
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = k => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim();

const PF_TOKEN = get('PRINTFUL_API_TOKEN');
const PF_STORE = get('PRINTFUL_STORE_ID');
const SB_URL = get('SUPABASE_URL') || get('NEXT_PUBLIC_SUPABASE_URL');
const SB_KEY = get('SUPABASE_SERVICE_KEY');

// v2 branding preview URLs (for mockup generator files array)
const V2_SLEEVE_URL = 'https://files.cdn.printful.com/files/7a4/7a48a90ab209376b621482853a5ef45c_preview.png';
const V2_BACK_URL = 'https://files.cdn.printful.com/files/d52/d52c0a1771381a65ad5b015de567877f_preview.png';

// Universal dark colors for CC1717 (always included in every product)
const CC1717_UNIVERSAL = [
  { name: 'Black',      slug: 'black',      variantId: 15114 },
  { name: 'True Navy',  slug: 'true-navy',  variantId: 15181 },
  { name: 'Graphite',   slug: 'graphite',   variantId: 21264 },
  { name: 'Pepper',     slug: 'pepper',     variantId: 17693 },
];

// Additional CC1717 colors selected per design via Design-First Contrast (see MOCKUPS.md)
// These are grouped by hue family — pick 1 per family to maximize visual diversity
const CC1717_EXTRA_POOL = {
  azul:    [
    { name: 'Navy',        slug: 'navy',        variantId: 21555 },
    { name: 'Midnight',    slug: 'midnight',     variantId: 21541 },
    { name: 'Denim',       slug: 'denim',        variantId: 21520 },
    { name: 'Mystic Blue', slug: 'mystic-blue',  variantId: 22076 },
    { name: 'Flo Blue',    slug: 'flo-blue',     variantId: 15171 },
  ],
  verde:   [
    { name: 'Sage',        slug: 'sage',         variantId: 21562 },
    { name: 'Hemp',        slug: 'hemp',         variantId: 22103 },
    { name: 'Blue Spruce', slug: 'blue-spruce',  variantId: 17686 },
    { name: 'Moss',        slug: 'moss',         variantId: 17700 },
  ],
  rojo:    [
    { name: 'Brick',       slug: 'brick',        variantId: 15161 },
    { name: 'Red',         slug: 'red',          variantId: 15119 },
    { name: 'Crimson',     slug: 'crimson',      variantId: 16547 },
    { name: 'Watermelon',  slug: 'watermelon',   variantId: 15191 },
  ],
  purpura: [
    { name: 'Grape',       slug: 'grape',        variantId: 22096 },
    { name: 'Berry',       slug: 'berry',        variantId: 15156 },
  ],
  naranja: [
    { name: 'Paprika',     slug: 'paprika',      variantId: 17669 },
    { name: 'Yam',         slug: 'yam',          variantId: 21271 },
  ],
  marron:  [
    { name: 'Espresso',    slug: 'espresso',     variantId: 21243 },
  ],
};

const MC1087_COLORS = [
  { name: 'Black',         slug: 'black',         variantId: 23577 },
  { name: 'Navy Blazer',   slug: 'navy-blazer',   variantId: 23584 },
  { name: 'Vintage Black', slug: 'vintage-black',  variantId: 23591 },
];

// Helper: build CC1717 color list = 4 universals + per-design extras
// excludeHues: array of hue family keys to exclude (design accent colors that would clash)
// addFromFamilies: array of hue family keys to add 1 color each
function cc1717Colors(excludeHues = [], addFromFamilies = []) {
  const colors = [...CC1717_UNIVERSAL];
  for (const family of addFromFamilies) {
    if (excludeHues.includes(family)) continue;
    const pool = CC1717_EXTRA_POOL[family];
    if (pool?.length) colors.push(pool[0]); // first = best pick per family
  }
  return colors;
}

// Products to process
// Per-design color selection based on Design-First Contrast (see MOCKUPS.md)
const PRODUCTS = [
  // CC1717 (catalog 586) — 4 universal + per-design extras
  // Just For You: white ghost text, no accent colors → all families ok
  { name: 'Just For You',      sync: 422030329, catalogId: 586,
    colors: cc1717Colors([], ['azul', 'verde', 'rojo', 'purpura']) },
  // Next Line: white ghost + green accent (#10B981) → exclude verde
  { name: 'Next Line',         sync: 422030332, catalogId: 586,
    colors: cc1717Colors(['verde'], ['azul', 'rojo', 'purpura']) },
  // Shadow Tee: white ghost, minimal → all families ok
  { name: 'Shadow Tee',        sync: 422030396, catalogId: 586,
    colors: cc1717Colors([], ['azul', 'verde', 'purpura', 'marron']) },
  // Strawberry Count: white + red/pink accent → exclude rojo
  { name: 'Strawberry Count',  sync: 422030403, catalogId: 586,
    colors: cc1717Colors(['rojo'], ['azul', 'verde', 'purpura']) },
  // Three Models: green (#10B981) + indigo (#6366F1) + orange (#F97316) → exclude verde, azul, naranja
  { name: 'Three Models',      sync: 422030406, catalogId: 586,
    colors: cc1717Colors(['verde', 'naranja'], ['azul', 'rojo', 'purpura', 'marron']) },
  // Under Where: white ghost only → all families ok
  { name: 'Under Where',       sync: 422030411, catalogId: 586,
    colors: cc1717Colors([], ['azul', 'verde', 'rojo', 'purpura']) },
  // Option Two: orange #F97316 accent → exclude naranja
  { name: 'Option Two',        sync: 422030337, catalogId: 586,
    colors: cc1717Colors(['naranja'], ['azul', 'verde', 'rojo', 'purpura']) },
  // Dangerous Flag: white ghost only, no accent colors → all families ok
  { name: 'Dangerous Flag',    sync: 422030313, catalogId: 586,
    colors: cc1717Colors([], ['azul', 'verde', 'rojo', 'purpura']) },
  // Ghost Tee: monochrome gray S mark, no accent colors → all families ok
  { name: 'Ghost Tee',         sync: 422030327, catalogId: 586,
    colors: cc1717Colors([], ['azul', 'verde', 'purpura', 'marron']) },
  // Scope Creep: orange #F97316 + green #10B981 + red #EF4444 → exclude naranja, verde, rojo
  { name: 'Scope Creep',       sync: 422030382, catalogId: 586,
    colors: cc1717Colors(['naranja', 'verde', 'rojo'], ['azul', 'purpura', 'marron']) },
  // Prism Tee: blue-purple-pink gradient → exclude azul, purpura, rojo (magenta)
  { name: 'Prism Tee',         sync: 422030345, catalogId: 586,
    colors: cc1717Colors(['azul', 'purpura', 'rojo'], ['verde', 'naranja', 'marron']) },
  // MC1087 (catalog 917) — always all 3 dark colors
  { name: 'Existential Dread', sync: 422030462, catalogId: 917, colors: MC1087_COLORS },
  { name: 'Plans Cancelled',   sync: 422030466, catalogId: 917, colors: MC1087_COLORS },
  { name: 'Self-Care Mode',    sync: 422030469, catalogId: 917, colors: MC1087_COLORS },
  { name: 'Social Battery',    sync: 422030473, catalogId: 917, colors: MC1087_COLORS },
  { name: 'Soup Fork',         sync: 422030479, catalogId: 917, colors: MC1087_COLORS },
];

const delay = ms => new Promise(r => setTimeout(r, ms));

// --- Printful API ---

const pfHeaders = {
  'Authorization': `Bearer ${PF_TOKEN}`,
  'X-PF-Store-Id': PF_STORE,
  'Content-Type': 'application/json',
};

async function pfFetch(path, opts = {}) {
  const res = await fetch(`https://api.printful.com${path}`, { headers: pfHeaders, ...opts });
  if (res.status === 429) {
    const reset = parseInt(res.headers.get('x-ratelimit-reset') || '60', 10);
    console.log(`    Rate limited, waiting ${reset}s...`);
    await delay(reset * 1000);
    return pfFetch(path, opts);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Printful HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getFrontDesignUrl(syncProductId) {
  const data = await pfFetch(`/store/products/${syncProductId}`);
  const v0 = data.result.sync_variants[0];
  const frontFile = v0.files.find(f => f.type === 'default' || f.type === 'front');
  if (!frontFile?.preview_url) throw new Error(`No front file preview URL for sync ${syncProductId}`);
  return frontFile.preview_url;
}

async function createMockupTask(catalogId, color, frontDesignUrl) {
  const body = {
    variant_ids: [color.variantId],
    format: 'png',
    width: 1000,
    option_groups: ['Ghost'],
    options: ['Front', 'Left', 'Back'],
    files: [
      {
        placement: 'front',
        image_url: frontDesignUrl,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
      },
      {
        placement: 'sleeve_left',
        image_url: V2_SLEEVE_URL,
        position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 },
      },
      {
        placement: 'back',
        image_url: V2_BACK_URL,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 },
      },
    ],
  };

  const data = await pfFetch(`/mockup-generator/create-task/${catalogId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return data.result.task_key;
}

async function pollMockupTask(taskKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await delay(3000);
    const data = await pfFetch(`/mockup-generator/task?task_key=${taskKey}`);
    const status = data.result.status;
    if (status === 'completed') return data.result.mockups;
    if (status === 'failed') throw new Error(`Mockup task ${taskKey} failed`);
  }
  throw new Error(`Mockup task ${taskKey} timed out after ${maxAttempts} polls`);
}

// --- Supabase Storage ---

async function uploadToStorage(storagePath, imageBuffer) {
  const res = await fetch(`${SB_URL}/storage/v1/object/designs/${storagePath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SB_KEY}`,
      apikey: SB_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: Buffer.from(imageBuffer),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage upload failed: ${res.status} ${text.slice(0, 100)}`);
  }
}

async function downloadImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  return res.arrayBuffer();
}

// --- Supabase DB ---

async function sbQuery(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  return res.json();
}

async function sbPatch(table, filter, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// --- Main Pipeline ---

// Generate "Flat" mockups as fallback for MC1087 (no Zoomed In available)
async function createFlatTask(catalogId, color, frontDesignUrl) {
  const body = {
    variant_ids: [color.variantId],
    format: 'png', width: 1000,
    option_groups: ['Flat'],
    files: [
      { placement: 'front', image_url: frontDesignUrl,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
      { placement: 'sleeve_left', image_url: V2_SLEEVE_URL,
        position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
      { placement: 'back', image_url: V2_BACK_URL,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    ],
  };
  const data = await pfFetch(`/mockup-generator/create-task/${catalogId}`, {
    method: 'POST', body: JSON.stringify(body),
  });
  return data.result.task_key;
}

// Generate "Zoomed in" mockups as fallback when Ghost gives duplicate images
async function createZoomedTask(catalogId, color, frontDesignUrl) {
  const body = {
    variant_ids: [color.variantId],
    format: 'png', width: 1000,
    option_groups: ['Zoomed in'],
    files: [
      { placement: 'front', image_url: frontDesignUrl,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
      { placement: 'sleeve_left', image_url: V2_SLEEVE_URL,
        position: { area_width: 600, area_height: 525, width: 600, height: 525, top: 0, left: 0 } },
      { placement: 'back', image_url: V2_BACK_URL,
        position: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    ],
  };
  const data = await pfFetch(`/mockup-generator/create-task/${catalogId}`, {
    method: 'POST', body: JSON.stringify(body),
  });
  return data.result.task_key;
}

async function processProduct(product, idx, total) {
  console.log(`\n[${idx + 1}/${total}] ${product.name} (sync ${product.sync}, catalog ${product.catalogId})`);

  // 1. Get Supabase product ID
  const dbProducts = await sbQuery(`products?provider_product_id=eq.${product.sync}&select=id,title`);
  if (!dbProducts.length) {
    console.log('  SKIP: not found in Supabase');
    return false;
  }
  const dbId = dbProducts[0].id;
  const title = dbProducts[0].title;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // 2. Get front design preview URL from Printful
  const frontDesignUrl = await getFrontDesignUrl(product.sync);
  console.log(`  Front design: ${frontDesignUrl.slice(0, 60)}...`);

  // 3. Generate mockups for each dark color
  const allMockups = []; // { color, colorSlug, placement, url }

  for (const color of product.colors) {
    console.log(`  Generating ${color.name}...`);

    try {
      // ── Ghost mockups (front/back/left) ──
      const taskKey = await createMockupTask(product.catalogId, color, frontDesignUrl);
      console.log(`    Ghost task: ${taskKey}`);
      const mockups = await pollMockupTask(taskKey);

      const PLACEMENT_TO_VIEW = { front: 'front', back: 'back', sleeve_left: 'left' };

      // Download all 3 into memory first to detect duplicates
      const downloaded = [];
      for (const mock of mockups) {
        if (!mock.mockup_url || !mock.placement) continue;
        const view = PLACEMENT_TO_VIEW[mock.placement];
        if (!view) continue;
        const imageData = await downloadImage(mock.mockup_url);
        downloaded.push({ view, data: imageData, size: imageData.byteLength });
      }

      // ── Detect duplicate bug: if all 3 have identical byte size ──
      const sizes = downloaded.map(d => d.size);
      const allSame = sizes.length >= 2 && sizes.every(s => s === sizes[0]);

      if (allSame) {
        // BUG: Ghost returns identical images for all placements
        console.log(`    ⚠ DUPLICATE BUG (${sizes[0]} bytes × ${sizes.length}) — using Ghost front + Zoomed In`);

        // Upload only the Ghost front
        const ghostFront = downloaded.find(d => d.view === 'front');
        if (ghostFront) {
          const storagePath = `mockups/${slug}/${color.slug}-front.png`;
          await uploadToStorage(storagePath, ghostFront.data);
          const ts = Math.floor(Date.now() / 1000);
          allMockups.push({
            color: color.name, colorSlug: color.slug, placement: 'front',
            url: `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`,
          });
          console.log(`    Uploaded: ${color.slug}-front.png (Ghost)`);
        }

        // Zoomed In fallback — only available on CC1717 (catalog 586), NOT MC1087 (917)
        if (product.catalogId === 586) {
          await delay(12000);

          // Generate Zoomed In as alternative (gives 2 distinct images)
          const zoomKey = await createZoomedTask(product.catalogId, color, frontDesignUrl);
          console.log(`    Zoomed task: ${zoomKey}`);
          const zoomMockups = await pollMockupTask(zoomKey);

          // Extract unique URLs from Zoomed In results
          const zoomUrls = new Map();
          for (const m of zoomMockups) {
            const fname = m.mockup_url.split('/').pop();
            if (!zoomUrls.has(fname)) zoomUrls.set(fname, m.mockup_url);
          }

          let zoomIdx = 0;
          for (const [, url] of zoomUrls) {
            const suffix = zoomIdx === 0 ? 'zoomed-front' : 'zoomed-back';
            const buf = await downloadImage(url);
            const storagePath = `mockups/${slug}/${color.slug}-${suffix}.png`;
            await uploadToStorage(storagePath, buf);
            const ts = Math.floor(Date.now() / 1000);
            allMockups.push({
              color: color.name, colorSlug: color.slug, placement: suffix,
              url: `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`,
            });
            console.log(`    Uploaded: ${color.slug}-${suffix}.png (Zoomed In)`);
            zoomIdx++;
          }
        } else {
          // MC1087: no Zoomed In available, try Flat (gives Front + Back via extra[])
          await delay(12000);
          try {
            const flatKey = await createFlatTask(product.catalogId, color, frontDesignUrl);
            console.log(`    Flat task: ${flatKey}`);
            const flatMockups = await pollMockupTask(flatKey);
            const backExtra = flatMockups[0]?.extra?.find(e => e.title === 'Back');
            if (backExtra?.url) {
              const buf = await downloadImage(backExtra.url);
              const storagePath = `mockups/${slug}/${color.slug}-flat-back.png`;
              await uploadToStorage(storagePath, buf);
              const ts = Math.floor(Date.now() / 1000);
              allMockups.push({
                color: color.name, colorSlug: color.slug, placement: 'flat-back',
                url: `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`,
              });
              console.log(`    Uploaded: ${color.slug}-flat-back.png (Flat)`);
            }
          } catch (err) {
            console.log(`    Flat fallback failed: ${err.message}`);
          }
        }

      } else {
        // Normal: all 3 Ghost views are distinct — upload all
        for (const d of downloaded) {
          const storagePath = `mockups/${slug}/${color.slug}-${d.view}.png`;
          await uploadToStorage(storagePath, d.data);
          const ts = Math.floor(Date.now() / 1000);
          allMockups.push({
            color: color.name, colorSlug: color.slug, placement: d.view,
            url: `${SB_URL}/storage/v1/object/public/designs/${storagePath}?v=${ts}`,
          });
          console.log(`    Uploaded: ${color.slug}-${d.view}.png (Ghost)`);
        }
      }

    } catch (err) {
      console.log(`    ERROR generating ${color.name}: ${err.message}`);
    }

    await delay(10000); // Rate limit between mockup tasks
  }

  // 4. Build images[] array for Supabase
  // Order: fronts → zoomed → backs → sleeves
  const fronts = allMockups.filter(m => m.placement === 'front');
  const zoomedFronts = allMockups.filter(m => m.placement === 'zoomed-front');
  const zoomedBacks = allMockups.filter(m => m.placement === 'zoomed-back');
  const flatBacks = allMockups.filter(m => m.placement === 'flat-back');
  const backs = allMockups.filter(m => m.placement === 'back');
  const sleeves = allMockups.filter(m => m.placement === 'left');

  const images = [
    ...fronts.map(m => ({ src: m.url, alt: `${title} - ${m.color}` })),
    ...zoomedFronts.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Zoomed Front` })),
    ...zoomedBacks.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Zoomed Back` })),
    ...flatBacks.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Flat Back` })),
    ...backs.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Back` })),
    ...sleeves.map(m => ({ src: m.url, alt: `${title} - ${m.color} - Sleeve` })),
  ];

  if (images.length === 0) {
    console.log('  WARNING: No images generated, skipping Supabase update');
    return false;
  }

  // 5. Update Supabase products.images[]
  const updated = await sbPatch('products', `id=eq.${dbId}`, { images });
  console.log(`  Supabase images[]: ${updated ? 'OK' : 'FAIL'} (${images.length} images)`);

  // 6. Update variant image_urls (ghost front for each color → ProductCard color swatches)
  for (const front of fronts) {
    const ok = await sbPatch(
      'product_variants',
      `product_id=eq.${dbId}&color=eq.${encodeURIComponent(front.color)}`,
      { image_url: front.url }
    );
    if (ok) console.log(`  variant image_url ${front.color}: OK`);
  }

  // 7. Create missing variant rows in Supabase (colors added to Printful but not yet synced)
  await syncMissingVariants(product, dbId, fronts);

  return true;
}

// Ensure all Printful variants exist in Supabase product_variants
async function syncMissingVariants(product, dbId, fronts) {
  // Get existing variants from Supabase
  const existing = await sbQuery(`product_variants?product_id=eq.${dbId}&select=external_variant_id`);
  const existingSet = new Set(existing.map(v => v.external_variant_id));

  // Get all Printful sync variants
  const pfData = await pfFetch(`/store/products/${product.sync}`);
  const syncVariants = pfData.result.sync_variants;

  const frontUrlMap = {};
  for (const f of fronts) frontUrlMap[f.color] = f.url;

  let created = 0;
  for (const sv of syncVariants) {
    if (existingSet.has(String(sv.id))) continue;

    // Parse "Product Name / Color / Size"
    const parts = sv.name.split(' / ');
    const color = parts[1];
    const size = parts[2];
    if (!color || !size) continue;

    const colorSlug = color.toLowerCase().replace(/\s+/g, '-');
    const sku = `SKP-${product.name.substring(0, 8).replace(/\s/g, '-').toUpperCase()}-${color.substring(0, 4).toUpperCase()}-${size}`;

    const row = {
      product_id: dbId,
      title: `${color} / ${size}`,
      color, size,
      is_enabled: !['Ivory', 'White', 'Vintage White'].includes(color),
      is_available: true,
      price_cents: Math.round(parseFloat(sv.retail_price) * 100),
      image_url: frontUrlMap[color] || null,
      external_variant_id: String(sv.id),
      sku,
    };

    const res = await fetch(`${SB_URL}/rest/v1/product_variants`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (res.ok) created++;
  }

  if (created > 0) console.log(`  Synced ${created} missing variants to Supabase`);
  // Disable light color variants
  for (const lightColor of ['Ivory', 'White', 'Vintage White']) {
    await sbPatch('product_variants', `product_id=eq.${dbId}&color=eq.${encodeURIComponent(lightColor)}`, { is_enabled: false });
  }
}

async function main() {
  // --skip=N to resume from product N (0-indexed)
  const skipArg = process.argv.find(a => a.startsWith('--skip='));
  const startFrom = skipArg ? parseInt(skipArg.split('=')[1], 10) : 0;

  // --only=syncId to process a single product
  const onlyArg = process.argv.find(a => a.startsWith('--only='));
  const onlySync = onlyArg ? parseInt(onlyArg.split('=')[1], 10) : null;

  let products = PRODUCTS;
  if (onlySync) {
    products = PRODUCTS.filter(p => p.sync === onlySync);
    if (!products.length) { console.log(`Product sync ${onlySync} not found`); return; }
  }

  console.log(`Mockup batch: ${products.length} products (starting from ${startFrom})`);
  const cc = products.filter(p => p.catalogId === 586);
  const mc = products.filter(p => p.catalogId === 917);
  console.log(`CC1717: ${cc.length} products (${cc.map(p => p.colors.length + ' colors').join(', ')})`);
  console.log(`MC1087: ${mc.length} products × 3 colors`);
  const totalTasks = products.slice(startFrom).reduce((sum, p) => sum + p.colors.length, 0);
  console.log(`Remaining mockup tasks: ~${totalTasks} (some may need +1 for Zoomed fallback)`);
  console.log(`Estimated time: ~${Math.ceil(totalTasks * 15 / 60)} minutes\n`);

  let ok = 0, fail = 0, skipped = 0;
  for (let i = 0; i < products.length; i++) {
    if (i < startFrom) { skipped++; continue; }
    try {
      const success = await processProduct(products[i], i, products.length);
      if (success) ok++;
      else fail++;
    } catch (err) {
      console.log(`  FATAL: ${err.message}`);
      fail++;
    }
    // Log progress for resume
    console.log(`  ── Progress: ${ok + fail}/${products.length - startFrom} done, next: --skip=${i + 1} ──`);
  }

  console.log(`\n=== DONE ===`);
  console.log(`${ok} ok, ${fail} failed, ${skipped} skipped`);
}

main().catch(e => console.error(e));
