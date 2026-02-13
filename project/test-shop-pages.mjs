import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

console.log('=== Testing English Shop Page ===');
try {
  await page.goto('http://localhost:3000/en/shop', { waitUntil: 'networkidle', timeout: 10000 });
  console.log('✓ Page loaded successfully');
  
  const productGrid = await page.locator('[class*="grid"], [class*="products"], .product-grid').first();
  const gridExists = await productGrid.count() > 0 || await page.locator('main').first().count() > 0;
  console.log(gridExists ? '✓ Product grid layout found' : '✗ Product grid layout NOT found');
  
  const productCards = await page.locator('[class*="product"], [class*="card"], article, [data-testid*="product"]').count();
  console.log('Product cards found: ' + productCards);
  console.log(productCards > 0 ? '✓ At least one product card rendered' : '✗ No product cards found');
  
  if (productCards > 0) {
    const firstCard = page.locator('[class*="product"], [class*="card"], article, [data-testid*="product"]').first();
    
    const hasImage = await firstCard.locator('img').count() > 0;
    console.log(hasImage ? '✓ Product image found' : '✗ Product image NOT found');
    
    const hasTitle = await firstCard.locator('h1, h2, h3, h4, h5, h6, [class*="title"], [class*="name"]').count() > 0;
    console.log(hasTitle ? '✓ Product title found' : '✗ Product title NOT found');
    
    const hasPrice = await firstCard.locator('[class*="price"]').count() > 0;
    console.log(hasPrice ? '✓ Product price found' : '✗ Product price NOT found');
    
    const hasRating = await firstCard.locator('[class*="rating"], [class*="star"]').count() > 0;
    console.log(hasRating ? '✓ Rating stars found' : '✗ Rating stars NOT found');
    
    const hasWishlist = await firstCard.locator('[class*="wishlist"], [class*="heart"], button svg, [aria-label*="wishlist"]').count() > 0;
    console.log(hasWishlist ? '✓ Wishlist heart icon found' : '✗ Wishlist heart icon NOT found');
  }
  
  await page.screenshot({ path: 'screenshot-shop-en.png', fullPage: true });
  console.log('✓ Screenshot saved: screenshot-shop-en.png');
  
} catch (error) {
  console.error('Error testing English shop page:', error.message);
}

console.log('\n=== Testing Spanish Shop Page ===');
try {
  await page.goto('http://localhost:3000/es/shop', { waitUntil: 'networkidle', timeout: 10000 });
  console.log('✓ Page loaded successfully');
  
  const pageTitle = await page.title();
  console.log('Page title: "' + pageTitle + '"');
  
  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  console.log('H1 text: "' + h1Text + '"');
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasTienda = h1Text.includes('Tienda') || pageTitle.includes('Tienda') || bodyText.includes('Tienda');
  console.log(hasTienda ? '✓ Spanish title "Tienda" found' : '✗ Spanish title "Tienda" NOT found');
  
  await page.screenshot({ path: 'screenshot-shop-es.png', fullPage: true });
  console.log('✓ Screenshot saved: screenshot-shop-es.png');
  
} catch (error) {
  console.error('Error testing Spanish shop page:', error.message);
}

console.log('\n=== Testing German Shop Page ===');
try {
  await page.goto('http://localhost:3000/de/shop', { waitUntil: 'networkidle', timeout: 10000 });
  console.log('✓ Page loaded successfully');
  
  const pageTitle = await page.title();
  console.log('Page title: "' + pageTitle + '"');
  
  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  console.log('H1 text: "' + h1Text + '"');
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasShop = h1Text.includes('Shop') || pageTitle.includes('Shop') || bodyText.includes('Shop');
  console.log(hasShop ? '✓ German title "Shop" found' : '✗ German title "Shop" NOT found');
  
  await page.screenshot({ path: 'screenshot-shop-de.png', fullPage: true });
  console.log('✓ Screenshot saved: screenshot-shop-de.png');
  
} catch (error) {
  console.error('Error testing German shop page:', error.message);
}

await browser.close();
console.log('\n=== All shop page tests completed ===');
