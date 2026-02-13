import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3000/en/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Find the error element
    const errorElements = await page.locator('[role="alert"], .error, .alert-error').all();
    console.log(`Found ${errorElements.length} error element(s)`);
    
    for (let i = 0; i < errorElements.length; i++) {
      const element = errorElements[i];
      const isVisible = await element.isVisible();
      const text = await element.textContent();
      const html = await element.evaluate(el => el.outerHTML);
      
      console.log(`\nError element ${i + 1}:`);
      console.log(`  Visible: ${isVisible}`);
      console.log(`  Text: "${text}"`);
      console.log(`  HTML: ${html.substring(0, 200)}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
