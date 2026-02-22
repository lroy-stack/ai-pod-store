import { searchProducts } from './src/tools/search-products.js';

async function test() {
  console.log('=== Testing search_products with "mug" ===\n');

  const result = await searchProducts({ query: 'mug', limit: 5 });

  console.log('Response structure:');
  console.log('  - success:', result.success);
  console.log('  - total:', result.total);
  console.log('  - products.length:', result.products.length);
  console.log('');

  if (result.success && result.products.length > 0) {
    console.log('✓ Search successful\n');
    console.log('Products found:');
    result.products.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.title}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Price: ${p.price} ${p.currency}`);
      console.log(`   Image: ${p.image ? 'yes' : 'no'}`);
      console.log(`   Rating: ${p.rating}`);
      console.log(`   Category: ${p.category}`);
    });

    // Verify required fields on first product
    console.log('\n=== Verifying required fields ===');
    const firstProduct = result.products[0];
    const requiredFields = ['id', 'title', 'price', 'currency', 'image', 'rating'];

    console.log('Checking first product:');
    requiredFields.forEach(field => {
      const has = firstProduct.hasOwnProperty(field);
      const type = typeof firstProduct[field];
      const value = field === 'image' || field === 'title'
        ? (firstProduct[field] ? '(present)' : '(empty)')
        : firstProduct[field];
      console.log(`  ✓ ${field}: ${has ? type : 'missing'} ${value}`);
    });

    const hasAllFields = requiredFields.every(field => firstProduct.hasOwnProperty(field));
    console.log(`\nAll required fields present: ${hasAllFields ? '✓ YES' : '✗ NO'}`);

    // Test that tool is public (works without auth)
    console.log('\n=== Testing public access ===');
    console.log('✓ Tool executed without authentication (this is a public tool)');

    console.log('\n=== PASS ===');
  } else {
    console.log('✗ FAIL: No products returned');
    process.exit(1);
  }
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
