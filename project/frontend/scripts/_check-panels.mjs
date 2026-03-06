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

async function main() {
  // Check ALL products with design_templates - focus on placement names
  const { data: products } = await sb
    .from('products')
    .select('id, title, category, design_templates')
    .not('design_templates', 'is', null)
    .eq('status', 'active');

  if (!products?.length) { console.log('No products'); return; }

  console.log('=== PLACEMENT NAME ANALYSIS ===\n');
  
  const allPlacements = new Set();
  for (const p of products) {
    const dt = p.design_templates;
    for (const pl of (dt.placements || [])) {
      allPlacements.add(pl);
    }
  }
  console.log('All unique placements in DB:', [...allPlacements].sort());
  console.log('\nExpected by MULTI_PANEL_AREAS for tshirt: front, back');
  console.log('Expected by MULTI_PANEL_AREAS for hoodie: front, back, left_sleeve, right_sleeve');
  
  console.log('\n=== MISMATCH CHECK ===');
  console.log('Printful API sends: front, back, sleeve_left, sleeve_right, label_outside, label_inside');
  console.log('MULTI_PANEL_AREAS has: front, back, left_sleeve, right_sleeve');
  console.log('\nMISMATCH: Printful uses "sleeve_left" but getAvailablePanels returns "left_sleeve"!');
  
  console.log('\n=== COLOR CASE ANALYSIS ===\n');
  
  // For a few products, compare variant color case with c2v keys
  for (const p of products.slice(0, 3)) {
    const { data: variants } = await sb
      .from('product_variants')
      .select('color')
      .eq('product_id', p.id)
      .eq('is_enabled', true);
    
    const uniqueColors = [...new Set((variants || []).map(v => v.color).filter(Boolean))];
    const c2vKeys = Object.keys(p.design_templates.color_to_variant_id);
    
    console.log('Product:', p.title);
    console.log('  Variant colors (as stored in DB):', uniqueColors.slice(0, 5));
    console.log('  c2v keys:', c2vKeys.slice(0, 5));
    console.log('  resolveGhostTemplate does: color.toLowerCase()');
    console.log('  When user clicks color "' + uniqueColors[0] + '", it becomes "' + (uniqueColors[0] || '').toLowerCase() + '"');
    console.log('  c2v has key "' + c2vKeys.find(k => k === (uniqueColors[0] || '').toLowerCase()) + '"?', c2vKeys.includes((uniqueColors[0] || '').toLowerCase()));
    console.log();
  }
}

main().catch(e => console.error(e));
