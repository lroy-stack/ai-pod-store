import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize({ width: 1920, height: 1080 });

// Capture console errors
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

console.log('=== Testing Registration Page at /en/auth/register ===\n');

try {
  console.log('1. Navigating to http://localhost:3000/en/auth/register...');
  await page.goto('http://localhost:3000/en/auth/register', { 
    waitUntil: 'networkidle', 
    timeout: 15000 
  });
  console.log('✓ Page loaded successfully\n');
  
  console.log('2. Checking registration form...');
  const form = await page.locator('form').count();
  console.log(form > 0 ? '✓ Registration form found' : '✗ Registration form NOT found');
  
  console.log('\n3. Checking form fields...');
  
  // Check for name field
  const nameField = await page.locator('input[name="name"], input[id="name"], input[placeholder*="name" i], input[type="text"]').first();
  const nameVisible = await nameField.isVisible().catch(() => false);
  console.log(nameVisible ? '✓ Name field is visible' : '✗ Name field NOT visible');
  
  // Check for email field
  const emailField = await page.locator('input[type="email"], input[name="email"], input[id="email"]').first();
  const emailVisible = await emailField.isVisible().catch(() => false);
  console.log(emailVisible ? '✓ Email field is visible' : '✗ Email field NOT visible');
  
  // Check for password field
  const passwordField = await page.locator('input[type="password"], input[name="password"], input[id="password"]').first();
  const passwordVisible = await passwordField.isVisible().catch(() => false);
  console.log(passwordVisible ? '✓ Password field is visible' : '✗ Password field NOT visible');
  
  console.log('\n4. Checking submit button...');
  const submitButton = await page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign up"), button:has-text("Create")').first();
  const submitVisible = await submitButton.isVisible().catch(() => false);
  console.log(submitVisible ? '✓ Submit button is visible' : '✗ Submit button NOT visible');
  
  console.log('\n5. Checking for console errors...');
  if (consoleErrors.length === 0) {
    console.log('✓ No console errors detected');
  } else {
    console.log('✗ Console errors found:');
    consoleErrors.forEach(error => console.log('  - ' + error));
  }
  
  console.log('\n6. Taking screenshot...');
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-page-screenshot.png', 
    fullPage: true 
  });
  console.log('✓ Screenshot saved: registration-page-screenshot.png');
  
  console.log('\n=== Summary ===');
  const allPassed = form > 0 && nameVisible && emailVisible && passwordVisible && submitVisible && consoleErrors.length === 0;
  console.log(allPassed ? '✓ All checks PASSED' : '✗ Some checks FAILED');
  
} catch (error) {
  console.error('✗ Error during test:', error.message);
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-page-error.png', 
    fullPage: true 
  });
  console.log('Error screenshot saved: registration-page-error.png');
}

// Keep browser open for 5 seconds to observe
await page.waitForTimeout(5000);

await browser.close();
console.log('\n=== Test completed ===');
