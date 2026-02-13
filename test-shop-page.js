const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('Navigating to http://localhost:3000/en/shop...');
    await page.goto('http://localhost:3000/en/shop', { waitUntil: 'networkidle' });
    
    console.log('Page loaded successfully\!');
    
    console.log('\nChecking for product grid...');
    const productGrid = await page.locator('[class*="grid"]').first();
    const isVisible = await productGrid.isVisible();
    console.log('Product grid visible:', isVisible);
    
    console.log('\nChecking for product cards...');
    const productCards = await page.locator('[class*="card"], article, [data-testid*="product"]').all();
    console.log('Product cards found:', productCards.length);
    
    const expectedProducts = ['T-Shirt', 'Hoodie', 'Mug', 'Poster', 'Phone Case', 'Tote Bag'];
    console.log('\nChecking for expected products:');
    for (const product of expectedProducts) {
      const found = await page.getByText(product, { exact: false }).isVisible().catch(() => false);
      console.log(`  ${product}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }
    
    console.log('\nChecking product card elements:');
    const images = await page.locator('img').count();
    console.log('  Product images:', images);
    
    const prices = await page.getByText(/\-9+/).count();
    console.log('  Price elements:', prices);
    
    const stars = await page.locator('svg').count();
    console.log('  SVG elements (stars/hearts):', stars);
    
    console.log('\nTaking screenshot...');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot-shop-page.png', fullPage: true });
    console.log('Screenshot saved\!');
    
    const title = await page.title();
    console.log('\nPage title:', title);
    
  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
  }
})();
