import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

// Capture API responses
const apiResponses = [];
page.on('response', async (response) => {
  if (response.url().includes('/api/auth/register')) {
    const status = response.status();
    try {
      const body = await response.json();
      apiResponses.push({ status, body });
    } catch (e) {
      apiResponses.push({ status, body: 'Unable to parse' });
    }
  }
});

console.log('=== Testing Feature #46: Duplicate Email (Spanish Locale) ===\n');

try {
  console.log('Step 1: Navigate to /es/auth/register...');
  await page.goto('http://localhost:3000/es/auth/register', { 
    waitUntil: 'networkidle', 
    timeout: 15000 
  });
  console.log('✓ Page loaded\n');
  
  console.log('Step 2: Fill form with duplicate email...');
  await page.locator('input[type="text"]').first().fill('Usuario de Prueba 2');
  await page.locator('input[type="email"]').first().fill('test@example.com');
  await page.locator('input[type="password"]').first().fill('TestPassword123!');
  await page.locator('input[type="password"]').nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  console.log('✓ Form filled\n');
  
  console.log('Step 3: Submit form...');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  
  console.log('\n=== Results ===');
  if (apiResponses.length > 0) {
    console.log(`API Status: ${apiResponses[0].status}`);
    console.log(`API Response:`, JSON.stringify(apiResponses[0].body, null, 2));
  }
  
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  const errorElement = await page.locator('[class*="red"], [class*="error"]').first();
  const errorVisible = await errorElement.isVisible().catch(() => false);
  if (errorVisible) {
    const errorText = await errorElement.textContent();
    console.log(`✓ Error message displayed: "${errorText}"`);
  } else {
    console.log('✗ No error message visible');
  }
  
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-es.png', 
    fullPage: true 
  });
  console.log('\nScreenshot: test-results/duplicate-email-es.png');
  
  console.log('\n=== Summary ===');
  if (apiResponses.length > 0 && apiResponses[0].status === 400 && errorVisible) {
    console.log('✓✓✓ Spanish locale test PASSED ✓✓✓');
  } else {
    console.log('✗ Spanish locale test FAILED');
  }
  
} catch (error) {
  console.error('✗ Test error:', error.message);
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-es-error.png', 
    fullPage: true 
  });
}

await page.waitForTimeout(5000);
await browser.close();
console.log('\n=== Test completed ===');
