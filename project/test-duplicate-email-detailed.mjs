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
    const statusText = response.statusText();
    try {
      const body = await response.json();
      apiResponses.push({
        url: response.url(),
        status,
        statusText,
        body,
      });
    } catch (e) {
      apiResponses.push({
        url: response.url(),
        status,
        statusText,
        body: 'Unable to parse JSON',
      });
    }
  }
});

// Capture console logs
const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
});

console.log('=== Testing Feature #46: Duplicate Email Registration (Detailed) ===\n');

try {
  console.log('Step 1: Navigate to registration page...');
  await page.goto('http://localhost:3000/en/auth/register', { 
    waitUntil: 'networkidle', 
    timeout: 15000 
  });
  console.log('✓ Page loaded\n');
  
  console.log('Step 2: Fill form with duplicate email (test@example.com)...');
  await page.locator('input[name="name"], input[id="name"], input[type="text"]').first().fill('Test User 2');
  await page.locator('input[type="email"]').first().fill('test@example.com');
  await page.locator('input[type="password"]').first().fill('TestPassword123!');
  await page.locator('input[type="password"]').nth(1).fill('TestPassword123!');
  await page.locator('input[type="checkbox"]').first().check();
  console.log('✓ Form filled\n');
  
  console.log('Step 3: Submit form...');
  await page.locator('button[type="submit"]').click();
  
  console.log('Step 4: Wait for API response...');
  await page.waitForTimeout(4000);
  
  console.log('\n=== API Responses ===');
  if (apiResponses.length > 0) {
    apiResponses.forEach((resp, idx) => {
      console.log(`Response ${idx + 1}:`);
      console.log(`  URL: ${resp.url}`);
      console.log(`  Status: ${resp.status} ${resp.statusText}`);
      console.log(`  Body:`, JSON.stringify(resp.body, null, 2));
    });
  } else {
    console.log('No API responses captured');
  }
  
  console.log('\n=== Page State ===');
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  // Check for error message on page
  const errorElement = await page.locator('[class*="red"], [class*="error"], [role="alert"]').first();
  const errorVisible = await errorElement.isVisible().catch(() => false);
  if (errorVisible) {
    const errorText = await errorElement.textContent();
    console.log(`Error message visible: "${errorText}"`);
  } else {
    console.log('No error message visible on page');
  }
  
  // Check for success message
  const successElement = await page.locator('[class*="green"], [class*="success"]').first();
  const successVisible = await successElement.isVisible().catch(() => false);
  if (successVisible) {
    const successText = await successElement.textContent();
    console.log(`Success message visible: "${successText}"`);
  }
  
  console.log('\n=== Screenshots ===');
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-detailed.png', 
    fullPage: true 
  });
  console.log('Screenshot saved: test-results/duplicate-email-detailed.png');
  
  console.log('\n=== Test Result ===');
  const hasErrorResponse = apiResponses.some(r => r.status >= 400);
  const hasErrorMessage = errorVisible;
  const redirectedToLogin = currentUrl.includes('/login');
  
  if (hasErrorResponse && hasErrorMessage) {
    console.log('✓✓✓ Feature #46 PASSED: Duplicate email properly rejected with error ✓✓✓');
  } else if (hasErrorResponse && !hasErrorMessage) {
    console.log('⚠ Feature #46 PARTIAL: API returned error but UI did not show it');
  } else if (!hasErrorResponse && redirectedToLogin) {
    console.log('✗✗✗ Feature #46 FAILED: Duplicate email was accepted (no error from API) ✗✗✗');
  } else {
    console.log('⚠ Feature #46 UNCLEAR: Unexpected state');
  }
  
} catch (error) {
  console.error('✗ Test error:', error.message);
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-test-error.png', 
    fullPage: true 
  });
}

console.log('\nKeeping browser open for 8 seconds...');
await page.waitForTimeout(8000);

await browser.close();
console.log('\n=== Test completed ===');
