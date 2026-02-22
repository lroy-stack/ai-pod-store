import { getSupabaseClient } from './src/lib/supabase.js';

async function checkProducts() {
  const supabase = getSupabaseClient();

  console.log('=== Checking products in database ===\n');

  // Check total products
  const { count: totalCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  console.log(`Total products (all statuses): ${totalCount || 0}`);

  // Check active products
  const { data: activeProducts, count: activeCount } = await supabase
    .from('products')
    .select('id, title, status, category, description', { count: 'exact' })
    .eq('status', 'active')
    .limit(10);

  console.log(`Active products: ${activeCount || 0}`);

  if (activeProducts && activeProducts.length > 0) {
    console.log('\nSample active products:');
    activeProducts.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title} (category: ${p.category || 'none'})`);
      if (p.description) {
        console.log(`     Description: ${p.description.substring(0, 60)}...`);
      }
    });

    // Test if any contain "shirt"
    const shirtsQuery = '%shirt%';
    const { data: shirtProducts } = await supabase
      .from('products')
      .select('id, title, category, description')
      .eq('status', 'active')
      .or(`title.ilike.${shirtsQuery},description.ilike.${shirtsQuery},category.ilike.${shirtsQuery}`)
      .limit(5);

    console.log(`\n\nProducts matching "shirt": ${shirtProducts?.length || 0}`);
    if (shirtProducts && shirtProducts.length > 0) {
      shirtProducts.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title}`);
      });
    }
  } else {
    console.log('\n⚠ No active products in database');

    // Check if there are products with other statuses
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, title, status')
      .limit(10);

    if (allProducts && allProducts.length > 0) {
      console.log('\nProducts with other statuses:');
      allProducts.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title} (status: ${p.status})`);
      });
    } else {
      console.log('\n⚠ No products at all in database');
    }
  }
}

checkProducts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
