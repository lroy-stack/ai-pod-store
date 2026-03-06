import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const paths = ['frontend/.env.local', '.env.local', '.env'];
  for (const p of paths) {
    try {
      const raw = readFileSync(p, 'utf-8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Z_]+[A-Z0-9_]*)=(.*)/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
        }
      }
    } catch {}
  }
}

loadEnv();
const sb = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MULTI_PANEL_AREAS = {
  'tshirt': { front: true, back: true },
  'hoodie': { front: true, back: true, left_sleeve: true, right_sleeve: true },
  'mug': { front: true },
  'phone-case': { front: true },
  'tote-bag': { front: true, back: true },
  'hat': { front: true },
};

const CATEGORY_TO_PRODUCT_TYPE = {
  'apparel': 'tshirt', 't-shirts': 'tshirt', 'hoodies': 'hoodie',
  'sweatshirts': 'hoodie', 'mugs': 'mug', 'drinkware': 'mug',
  'phone-cases': 'phone-case', 'bags': 'tote-bag', 'accessories': 'tote-bag',
  'kids': 'tshirt', 'hats': 'hat',
};

function getAvailablePanels(productType) {
  const mp = MULTI_PANEL_AREAS[productType];
  return mp ? Object.keys(mp) : ['front'];
}

async function main() {
  const { data: products } = await sb
    .from('products')
    .select('id, title, category, design_templates')
    .not('design_templates', 'is', null)
    .eq('status', 'active');

  if (!products?.length) { console.log('No products'); return; }

  console.log('=== PANEL SWITCH FAILURE ANALYSIS ===\n');

  for (const p of products) {
    const dt = p.design_templates;
    const cat = (p.category || '').toLowerCase().trim();
    const productType = CATEGORY_TO_PRODUCT_TYPE[cat] || 'tshirt';
    const uiPanels = getAvailablePanels(productType);
    const dbPlacements = dt.placements || [];

    const mismatches = [];
    for (const panel of uiPanels) {
      if (!dbPlacements.includes(panel)) {
        mismatches.push({ panel, closestMatch: dbPlacements.find(d => d.includes(panel.split('_').pop()) || panel.includes(d.split('_').pop())) });
      }
    }

    if (mismatches.length > 0) {
      console.log('MISMATCH: "' + p.title + '" (' + p.id + ')');
      console.log('  category: "' + p.category + '" -> productType: "' + productType + '"');
      console.log('  UI panels (getAvailablePanels): ' + JSON.stringify(uiPanels));
      console.log('  DB placements: ' + JSON.stringify(dbPlacements));
      for (const m of mismatches) {
        console.log('  BROKEN: activePanel="' + m.panel + '" -> NOT found in variant_mapping -> ghost template=null');
        console.log('    Closest DB placement: "' + (m.closestMatch || 'none') + '"');
      }
      
      const firstColor = Object.keys(dt.color_to_variant_id)[0];
      const variantId = dt.color_to_variant_id[firstColor];
      const variantMap = dt.variant_mapping[String(variantId)];
      console.log('  variant_mapping keys for color "' + firstColor + '": ' + JSON.stringify(Object.keys(variantMap || {})));
      console.log();
    }
  }

  console.log('\n=== PRODUCTS WHERE PANELS MATCH ===');
  for (const p of products) {
    const dt = p.design_templates;
    const cat = (p.category || '').toLowerCase().trim();
    const productType = CATEGORY_TO_PRODUCT_TYPE[cat] || 'tshirt';
    const uiPanels = getAvailablePanels(productType);
    const dbPlacements = dt.placements || [];
    
    if (uiPanels.every(panel => dbPlacements.includes(panel))) {
      console.log('  OK: "' + p.title + '" - UI: ' + JSON.stringify(uiPanels) + ' / DB: ' + JSON.stringify(dbPlacements));
    }
  }
}

main().catch(e => console.error(e));
