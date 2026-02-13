import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

console.log('=== Testing Spanish Registration Page at /es/auth/register ===\n');

try {
  console.log('Navigating to http://localhost:3000/es/auth/register...');
  await page.goto('http://localhost:3000/es/auth/register', { 
    waitUntil: 'networkidle', 
    timeout: 15000 
  });
  console.log('✓ Page loaded successfully\n');
  
  const pageTitle = await page.title();
  console.log('Page title: "' + pageTitle + '"');
  
  const h1Text = await page.locator('h1').first().textContent().catch(() => '');
  console.log('H1 text: "' + h1Text + '"');
  
  const bodyText = await page.evaluate(() => document.body.innerText);
  const hasSpanishText = bodyText.includes('Crear') || bodyText.includes('cuenta') || bodyText.includes('Correo');
  console.log(hasSpanishText ? '✓ Spanish text found on page' : '✗ Spanish text NOT found');
  
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-page-es-screenshot.png', 
    fullPage: true 
  });
  console.log('✓ Screenshot saved: registration-page-es-screenshot.png');
  
} catch (error) {
  console.error('✗ Error during test:', error.message);
}

await page.waitForTimeout(3000);
await browser.close();
console.log('\n=== Test completed ===');
