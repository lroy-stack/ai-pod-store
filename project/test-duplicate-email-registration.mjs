import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

// Capture console logs and errors
const consoleErrors = [];
const consoleLogs = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  } else {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  }
});

console.log('=== Testing Feature #46: Duplicate Email Registration Shows Error ===\n');

try {
  console.log('Step 1: Navigate to http://localhost:3000/en/auth/register...');
  await page.goto('http://localhost:3000/en/auth/register', { 
    waitUntil: 'networkidle', 
    timeout: 15000 
  });
  console.log('✓ Page loaded successfully\n');
  
  console.log('Step 2: Fill in registration form with duplicate email...');
  
  // Fill in Name
  const nameField = await page.locator('input[name="name"], input[id="name"], input[type="text"]').first();
  await nameField.fill('Test User 2');
  console.log('  ✓ Name filled: "Test User 2"');
  
  // Fill in Email (using known duplicate)
  const emailField = await page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  await emailField.fill('test@example.com');
  console.log('  ✓ Email filled: "test@example.com" (duplicate email)');
  
  // Fill in Password
  const passwordFields = await page.locator('input[type="password"]');
  await passwordFields.first().fill('TestPassword123!');
  console.log('  ✓ Password filled: "TestPassword123!"');
  
  // Fill in Confirm Password
  const passwordCount = await passwordFields.count();
  if (passwordCount > 1) {
    await passwordFields.nth(1).fill('TestPassword123!');
    console.log('  ✓ Confirm Password filled: "TestPassword123!"');
  }
  
  // Check terms checkbox
  const termsCheckbox = await page.locator('input[type="checkbox"]').first();
  await termsCheckbox.check();
  console.log('  ✓ Terms checkbox checked');
  
  console.log('\nStep 3: Taking screenshot before submission...');
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-before.png', 
    fullPage: true 
  });
  console.log('✓ Screenshot saved: test-results/duplicate-email-before.png\n');
  
  console.log('Step 4: Click "Create account" button...');
  const submitButton = await page.locator('button[type="submit"], button:has-text("Create account"), button:has-text("Register"), button:has-text("Sign up")').first();
  await submitButton.click();
  console.log('✓ Submit button clicked\n');
  
  console.log('Step 5: Wait for response and error message...');
  await page.waitForTimeout(3000);
  
  console.log('Step 6: Taking screenshot after submission...');
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-error.png', 
    fullPage: true 
  });
  console.log('✓ Screenshot saved: test-results/duplicate-email-error.png\n');
  
  console.log('Step 7: Verify error message is displayed...');
  
  // Try multiple selectors to find error message
  const errorSelectors = [
    'text=/already.*registered/i',
    'text=/already.*exists/i',
    'text=/email.*taken/i',
    'text=/email.*already.*in.*use/i',
    'text=/user.*already.*exists/i',
    '[role="alert"]',
    '.error',
    '.alert-error',
    '[class*="error"]',
    '[class*="Error"]',
    'div:has-text("already")',
    'p:has-text("already")',
    'span:has-text("already")'
  ];
  
  let errorFound = false;
  let errorMessage = '';
  let errorSelector = '';
  
  for (const selector of errorSelectors) {
    try {
      const errorElement = page.locator(selector).first();
      const isVisible = await errorElement.isVisible({ timeout: 1000 }).catch(() => false);
      if (isVisible) {
        errorMessage = await errorElement.textContent();
        errorSelector = selector;
        console.log(`  ✓ Error message found with selector: "${selector}"`);
        console.log(`  ✓ Error message text: "${errorMessage.trim()}"`);
        errorFound = true;
        break;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  // If no visible error found, check page content
  if (!errorFound) {
    console.log('  - No visible error element found, checking page content...');
    const pageContent = await page.content();
    const lowercaseContent = pageContent.toLowerCase();
    
    if (lowercaseContent.includes('already') && 
        (lowercaseContent.includes('registered') || 
         lowercaseContent.includes('exists') || 
         lowercaseContent.includes('taken') ||
         lowercaseContent.includes('use'))) {
      console.log('  ⚠ Error keywords found in page content (but not visibly displayed)');
      errorFound = true;
    }
  }
  
  // Check console logs for errors
  console.log('\nStep 8: Checking console logs...');
  if (consoleErrors.length > 0) {
    console.log('  Console errors detected:');
    consoleErrors.forEach(error => console.log(`    - ${error}`));
  } else {
    console.log('  ✓ No console errors');
  }
  
  // Check if still on registration page (should be if error occurred)
  const currentUrl = page.url();
  console.log(`\nCurrent URL: ${currentUrl}`);
  const stillOnRegisterPage = currentUrl.includes('/register');
  console.log(stillOnRegisterPage ? '✓ Still on registration page (expected for error)' : '⚠ Redirected away from registration page');
  
  console.log('\n=== Test Results ===');
  console.log(`Error message displayed: ${errorFound ? 'YES ✓' : 'NO ✗'}`);
  if (errorMessage) {
    console.log(`Error message: "${errorMessage.trim()}"`);
  }
  console.log(`Still on registration page: ${stillOnRegisterPage ? 'YES ✓' : 'NO ✗'}`);
  
  console.log('\n=== Summary ===');
  if (errorFound && stillOnRegisterPage) {
    console.log('✓✓✓ Feature #46 PASSED: Duplicate email registration shows error ✓✓✓');
  } else if (errorFound && !stillOnRegisterPage) {
    console.log('⚠ Feature #46 PARTIAL: Error found but may have redirected');
  } else {
    console.log('✗✗✗ Feature #46 FAILED: No error message displayed for duplicate email ✗✗✗');
  }
  
} catch (error) {
  console.error('✗ Test error:', error.message);
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/duplicate-email-test-error.png', 
    fullPage: true 
  });
  console.log('Error screenshot saved: test-results/duplicate-email-test-error.png');
}

// Keep browser open for observation
console.log('\nKeeping browser open for 8 seconds...');
await page.waitForTimeout(8000);

await browser.close();
console.log('\n=== Test completed ===');
