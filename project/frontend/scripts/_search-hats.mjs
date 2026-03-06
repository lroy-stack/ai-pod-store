#!/usr/bin/env node

/**
 * Search Printify catalog for beanie/hat/cap blueprints with embroidery support.
 * Focuses on finding: 1 beanie, 1 dad hat/cap, 1 bucket hat or similar.
 */

const API_TOKEN = process.env.PRINTIFY_API_TOKEN || 'your-printify-api-token';

const BASE_URL = 'https://api.printify.com/v1';
const DELAY_MS = 2000;

// Only actual headwear keywords — exclude "capsule", "capri", "bucket with tongs", etc.
const HAT_KEYWORDS = ['beanie', 'hat', 'cap', 'knit', 'trucker', 'snapback', 'visor', 'headwear', 'cuffed'];

// Exclude false positives
const EXCLUDE_KEYWORDS = ['capri', 'legging', 'supplement', 'capsule', 'ice bucket', 'tongs'];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  console.log(`  -> GET ${url}`);
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${path}: ${text}`);
  }
  return res.json();
}

function isHatBlueprint(title) {
  const lower = title.toLowerCase();
  // Exclude false positives first
  if (EXCLUDE_KEYWORDS.some(kw => lower.includes(kw))) return false;
  return HAT_KEYWORDS.some(kw => lower.includes(kw));
}

function isEmbroideryBlueprint(title) {
  return title.toLowerCase().includes('embroidery');
}

async function main() {
  console.log('=== Printify Hat/Beanie Blueprint Search ===\n');

  // Step 1: Fetch all blueprints
  console.log('Step 1: Fetching all blueprints...');
  const blueprints = await apiFetch('/catalog/blueprints.json');
  console.log(`  Total blueprints: ${blueprints.length}\n`);

  // Step 2: Filter for hat-related (excluding false positives)
  const hatBlueprints = blueprints.filter(bp => isHatBlueprint(bp.title));
  console.log(`Step 2: Found ${hatBlueprints.length} hat/beanie/cap blueprints:\n`);

  for (const bp of hatBlueprints) {
    const emb = isEmbroideryBlueprint(bp.title) ? ' [EMBROIDERY]' : '';
    console.log(`  [${bp.id}] ${bp.title}${emb}`);
  }
  console.log('');

  // Focus on embroidery blueprints + a few key non-embroidery ones
  const embroideryBlueprints = hatBlueprints.filter(bp => isEmbroideryBlueprint(bp.title));
  const nonEmbroideryBlueprints = hatBlueprints.filter(bp => !isEmbroideryBlueprint(bp.title));

  console.log(`  Embroidery blueprints: ${embroideryBlueprints.length}`);
  console.log(`  Non-embroidery blueprints: ${nonEmbroideryBlueprints.length}\n`);

  // Step 3: For embroidery blueprints, fetch providers
  console.log('=== Step 3: Fetching providers for EMBROIDERY blueprints ===\n');

  const detailed = [];

  for (const bp of embroideryBlueprints) {
    console.log(`\nFetching providers for [${bp.id}] "${bp.title}"...`);
    await sleep(DELAY_MS);

    let providers;
    try {
      providers = await apiFetch(`/catalog/blueprints/${bp.id}/print_providers.json`);
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      continue;
    }

    console.log(`  Found ${providers.length} providers`);

    for (const prov of providers) {
      console.log(`    Provider [${prov.id}] ${prov.title}`);
    }

    // Fetch variants for each provider
    for (const prov of providers) {
      console.log(`  Fetching variants for provider [${prov.id}] "${prov.title}"...`);
      await sleep(DELAY_MS);

      let variants;
      try {
        variants = await apiFetch(`/catalog/blueprints/${bp.id}/print_providers/${prov.id}/variants.json`);
      } catch (err) {
        console.log(`    ERROR: ${err.message}`);
        continue;
      }

      const variantList = variants.variants || [];

      // Parse colors and sizes from variant options
      const colorSet = new Set();
      const sizeSet = new Set();

      for (const v of variantList) {
        if (v.options) {
          // options is typically { color: "...", size: "..." } or similar
          for (const [key, val] of Object.entries(v.options)) {
            const k = key.toLowerCase();
            if (k.includes('color') || k.includes('colour')) {
              colorSet.add(val);
            } else if (k.includes('size')) {
              sizeSet.add(val);
            }
          }
        }
        // Fallback: try to get color from title
        if (v.title && colorSet.size === 0) {
          colorSet.add(v.title);
        }
      }

      const colors = [...colorSet];
      const sizes = [...sizeSet];

      detailed.push({
        blueprintId: bp.id,
        blueprintTitle: bp.title,
        providerId: prov.id,
        providerName: prov.title,
        isEmbroidery: true,
        variantCount: variantList.length,
        colors,
        sizes,
        sampleVariant: variantList[0] || null,
      });

      console.log(`    Variants: ${variantList.length}`);
      console.log(`    Sizes: ${sizes.join(', ') || 'N/A'}`);
      console.log(`    Colors (${colors.length}): ${colors.join(', ')}`);
    }
  }

  // Also fetch a few non-embroidery for comparison (bucket hat AOP, cuff beanie, etc.)
  const interestingNonEmb = nonEmbroideryBlueprints.filter(bp => {
    const t = bp.title.toLowerCase();
    return t.includes('beanie') || t.includes('bucket hat') || t.includes('dad hat');
  });

  if (interestingNonEmb.length > 0) {
    console.log('\n\n=== Step 3b: Fetching providers for interesting NON-EMBROIDERY blueprints ===\n');

    for (const bp of interestingNonEmb) {
      console.log(`\nFetching providers for [${bp.id}] "${bp.title}"...`);
      await sleep(DELAY_MS);

      let providers;
      try {
        providers = await apiFetch(`/catalog/blueprints/${bp.id}/print_providers.json`);
      } catch (err) {
        console.log(`  ERROR: ${err.message}`);
        continue;
      }

      for (const prov of providers) {
        console.log(`  Fetching variants for provider [${prov.id}] "${prov.title}"...`);
        await sleep(DELAY_MS);

        let variants;
        try {
          variants = await apiFetch(`/catalog/blueprints/${bp.id}/print_providers/${prov.id}/variants.json`);
        } catch (err) {
          console.log(`    ERROR: ${err.message}`);
          continue;
        }

        const variantList = variants.variants || [];
        const colorSet = new Set();
        const sizeSet = new Set();

        for (const v of variantList) {
          if (v.options) {
            for (const [key, val] of Object.entries(v.options)) {
              const k = key.toLowerCase();
              if (k.includes('color') || k.includes('colour')) colorSet.add(val);
              else if (k.includes('size')) sizeSet.add(val);
            }
          }
          if (v.title && colorSet.size === 0) colorSet.add(v.title);
        }

        detailed.push({
          blueprintId: bp.id,
          blueprintTitle: bp.title,
          providerId: prov.id,
          providerName: prov.title,
          isEmbroidery: false,
          variantCount: variantList.length,
          colors: [...colorSet],
          sizes: [...sizeSet],
          sampleVariant: variantList[0] || null,
        });

        console.log(`    Variants: ${variantList.length}`);
        console.log(`    Sizes: ${[...sizeSet].join(', ') || 'N/A'}`);
        console.log(`    Colors (${colorSet.size}): ${[...colorSet].join(', ')}`);
      }
    }
  }

  // ==================== FINAL SUMMARY ====================
  console.log('\n\n');
  console.log('='.repeat(120));
  console.log('FINAL SUMMARY — Hat/Beanie Blueprints with Variant Details');
  console.log('='.repeat(120));

  // Categorize
  function categorize(d) {
    const t = d.blueprintTitle.toLowerCase();
    if (t.includes('beanie') || t.includes('knit cap') || t.includes('knit beanie') || t.includes('pom-pom')) return 'BEANIE';
    if (t.includes('bucket')) return 'BUCKET HAT';
    if (t.includes('trucker')) return 'TRUCKER';
    if (t.includes('snapback') && !t.includes('trucker')) return 'SNAPBACK';
    if (t.includes('dad hat') || t.includes('dad cap') || t.includes('vintage cap') || t.includes('vintage corduroy') || t.includes('baseball') || t.includes('denim hat') || t.includes('structured cap') || t.includes('panel cap') || t.includes('profile') || t.includes('surf cap') || t.includes('pigment')) return 'DAD HAT / CAP';
    if (t.includes('flat bill')) return 'FLAT BILL';
    return 'OTHER HAT';
  }

  const categories = {};
  for (const d of detailed) {
    const cat = categorize(d);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(d);
  }

  for (const [cat, items] of Object.entries(categories).sort()) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  ${cat} (${items.length} options)`);
    console.log(`${'─'.repeat(80)}`);

    for (const d of items) {
      const embLabel = d.isEmbroidery ? ' *** EMBROIDERY ***' : ' (non-embroidery)';
      console.log(`\n  Blueprint ID : ${d.blueprintId}`);
      console.log(`  Title        : ${d.blueprintTitle}`);
      console.log(`  Provider ID  : ${d.providerId}`);
      console.log(`  Provider     : ${d.providerName}`);
      console.log(`  Decoration   : ${embLabel}`);
      console.log(`  Variants     : ${d.variantCount}`);
      console.log(`  Sizes        : ${d.sizes.join(', ') || 'One Size'}`);
      console.log(`  Colors (${String(d.colors.length).padStart(2)}) : ${d.colors.join(', ')}`);
    }
  }

  // ==================== TOP 3 PICKS ====================
  console.log('\n\n');
  console.log('*'.repeat(120));
  console.log('  TOP 3 RECOMMENDATIONS');
  console.log('*'.repeat(120));

  // Pick best beanie (embroidery, most variants)
  const beanieOptions = (categories['BEANIE'] || []).filter(d => d.isEmbroidery).sort((a, b) => b.variantCount - a.variantCount);
  const bucketOptions = (categories['BUCKET HAT'] || []).filter(d => d.isEmbroidery).sort((a, b) => b.variantCount - a.variantCount);
  const dadHatOptions = (categories['DAD HAT / CAP'] || []).filter(d => d.isEmbroidery).sort((a, b) => b.variantCount - a.variantCount);

  function printPick(label, options) {
    if (options.length === 0) {
      console.log(`\n  ${label}: No embroidery options available`);
      return;
    }
    const best = options[0];
    console.log(`\n  ${label}:`);
    console.log(`    Blueprint ID : ${best.blueprintId}`);
    console.log(`    Title        : ${best.blueprintTitle}`);
    console.log(`    Provider ID  : ${best.providerId}`);
    console.log(`    Provider     : ${best.providerName}`);
    console.log(`    Variants     : ${best.variantCount}`);
    console.log(`    Sizes        : ${best.sizes.join(', ') || 'One Size'}`);
    console.log(`    Colors (${best.colors.length}): ${best.colors.join(', ')}`);
    if (options.length > 1) {
      console.log(`    (${options.length - 1} more options available)`);
    }
  }

  printPick('1. BEANIE (embroidery)', beanieOptions);
  printPick('2. DAD HAT / CAP (embroidery)', dadHatOptions);
  printPick('3. BUCKET HAT (embroidery)', bucketOptions);

  console.log('\n\nDone!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
