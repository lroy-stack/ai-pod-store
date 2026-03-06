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
  // Get products with design_templates
  const { data: products, error } = await sb
    .from('products')
    .select('id, title, product_template_id, design_templates')
    .not('design_templates', 'is', null)
    .eq('status', 'active')
    .limit(3);

  if (error) { console.error('DB error:', error.message); return; }
  if (!products?.length) { console.log('No products with design_templates'); return; }

  for (const p of products) {
    console.log('\n=== Product:', p.title, '(', p.id, ') ===');
    console.log('product_template_id:', p.product_template_id);
    const dt = p.design_templates;
    console.log('placements:', dt.placements);
    
    const c2vKeys = Object.keys(dt.color_to_variant_id);
    console.log('color_to_variant_id keys (count=' + c2vKeys.length + '):', c2vKeys.slice(0, 15));
    console.log('color_to_variant_id sample:', JSON.stringify(Object.entries(dt.color_to_variant_id).slice(0, 5)));
    
    const firstColor = c2vKeys[0];
    const variantId = dt.color_to_variant_id[firstColor];
    const variantMap = dt.variant_mapping[String(variantId)];
    console.log('First color:', firstColor, '-> variantId:', variantId);
    console.log('variant_mapping for that variant:', variantMap ? JSON.stringify(variantMap) : 'NOT FOUND');
    
    if (variantMap) {
      for (const [placement, templateId] of Object.entries(variantMap)) {
        const tmpl = dt.templates[String(templateId)];
        console.log('  placement:', placement, '-> templateId:', templateId, '-> has image:', !!(tmpl && tmpl.image_url), ', bg:', tmpl ? tmpl.background_color : 'N/A');
      }
    }

    // Check variant_mapping keys format
    const vmKeys = Object.keys(dt.variant_mapping).slice(0, 5);
    console.log('variant_mapping keys (sample):', vmKeys);
  }

  // Get variant colors for comparison with color_to_variant_id keys
  for (const p of products) {
    const { data: variants } = await sb
      .from('product_variants')
      .select('color, color_hex, blank_image_url')
      .eq('product_id', p.id)
      .eq('is_enabled', true)
      .limit(15);

    console.log('\n=== Variants for', p.title, '===');
    const dt = p.design_templates;
    const c2vKeys = new Set(Object.keys(dt.color_to_variant_id));
    
    for (const v of (variants || [])) {
      const colorLower = (v.color || '').toLowerCase();
      const matchesInC2V = c2vKeys.has(colorLower);
      console.log('  color:', JSON.stringify(v.color), '| hex:', v.color_hex, '| lowered:', JSON.stringify(colorLower), '| FOUND in color_to_variant_id?', matchesInC2V);
    }
    
    // Show c2v keys that DON'T match any variant
    const variantColors = new Set((variants || []).map(v => (v.color || '').toLowerCase()));
    const unmatchedC2V = [...c2vKeys].filter(k => !variantColors.has(k));
    if (unmatchedC2V.length) {
      console.log('  UNMATCHED c2v keys (no variant):', unmatchedC2V.slice(0, 10));
    }
    const unmatchedVariants = [...variantColors].filter(k => !c2vKeys.has(k));
    if (unmatchedVariants.length) {
      console.log('  UNMATCHED variant colors (no c2v key):', unmatchedVariants.slice(0, 10));
    }
  }
}

main().catch(e => console.error(e));
