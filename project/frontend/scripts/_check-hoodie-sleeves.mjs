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
  // Get all hoodie-type products
  const { data: products } = await sb
    .from('products')
    .select('id, title, category, design_templates')
    .not('design_templates', 'is', null)
    .eq('status', 'active')
    .or('category.ilike.%hoodie%,category.ilike.%sweatshirt%,category.eq.pullover-hoodies');

  if (!products?.length) { console.log('No hoodie products with design_templates'); return; }

  console.log('=== HOODIE SLEEVE PANEL MISMATCH ===');
  console.log('MULTI_PANEL_AREAS.hoodie has panels: front, back, left_sleeve, right_sleeve');
  console.log('But Printful API uses: sleeve_left, sleeve_right\n');

  for (const p of products) {
    const dt = p.design_templates;
    const dbPlacements = dt.placements || [];
    const hasSleeveLeft = dbPlacements.includes('sleeve_left');
    const hasLeftSleeve = dbPlacements.includes('left_sleeve');
    const hasSleeveRight = dbPlacements.includes('sleeve_right');
    const hasRightSleeve = dbPlacements.includes('right_sleeve');
    
    console.log('"' + p.title + '" (' + p.category + ')');
    console.log('  DB placements:', JSON.stringify(dbPlacements));
    console.log('  sleeve_left in DB?', hasSleeveLeft, '| left_sleeve in DB?', hasLeftSleeve);
    console.log('  sleeve_right in DB?', hasSleeveRight, '| right_sleeve in DB?', hasRightSleeve);
    
    if (hasSleeveLeft && !hasLeftSleeve) {
      console.log('  BUG: UI will look for "left_sleeve" but DB has "sleeve_left" -> ghost=null on sleeve switch');
    }
    if (hasSleeveRight && !hasRightSleeve) {
      console.log('  BUG: UI will look for "right_sleeve" but DB has "sleeve_right" -> ghost=null on sleeve switch');
    }
    
    // Check what variant_mapping uses
    const firstColor = Object.keys(dt.color_to_variant_id)[0];
    if (firstColor) {
      const variantId = dt.color_to_variant_id[firstColor];
      const variantMap = dt.variant_mapping[String(variantId)];
      console.log('  variant_mapping placements:', JSON.stringify(Object.keys(variantMap || {})));
    }
    console.log();
  }
}

main().catch(e => console.error(e));
