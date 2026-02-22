import { searchProducts } from './src/tools/search-products.js';

async function test() {
  console.log('=== Testing search_products function ===\n');

  console.log('Test 1: Search for "shirt"...');
  const result1 = await searchProducts({ query: 'shirt', limit: 5 });
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('');

  if (result1.success && result1.products.length > 0) {
    console.log('✓ Search returned products');
    const firstProduct = result1.products[0];
    console.log('\nFirst product structure:');
    console.log('  - id:', typeof firstProduct.id, firstProduct.id);
    console.log('  - title:', typeof firstProduct.title, firstProduct.title);
    console.log('  - price:', typeof firstProduct.price, firstProduct.price);
    console.log('  - currency:', typeof firstProduct.currency, firstProduct.currency);
    console.log('  - image:', typeof firstProduct.image, firstProduct.image ? 'present' : 'empty');
    console.log('  - rating:', typeof firstProduct.rating, firstProduct.rating);
    console.log('  - category:', typeof firstProduct.category, firstProduct.category);
    console.log('  - description:', typeof firstProduct.description, firstProduct.description.substring(0, 50) + '...');

    // Verify required fields
    const requiredFields = ['id', 'title', 'price', 'currency', 'image', 'rating'];
    const hasAllFields = requiredFields.every(field => firstProduct.hasOwnProperty(field));
    console.log('\n✓ All required fields present:', hasAllFields);
  } else {
    console.log('⚠ No products found (database might be empty or no matches)');
  }

  console.log('\n=== Test completed ===');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
