const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('1. Navigating to registration page...');
    await page.goto('http://localhost:3000/en/auth/register', { waitUntil: 'networkidle' });
    console.log('✓ Page loaded successfully');
    
    // Check for Name input field
    console.log('\n2. Checking for Name input field...');
    const nameInput = await page.locator('input[name="name"], input[type="text"][placeholder*="name" i], input[id*="name" i]').first();
    const nameVisible = await nameInput.isVisible().catch(() => false);
    console.log(nameVisible ? '✓ Name input field is visible' : '✗ Name input field NOT found');
    
    // Check for Email input field
    console.log('\n3. Checking for Email input field...');
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const emailVisible = await emailInput.isVisible().catch(() => false);
    console.log(emailVisible ? '✓ Email input field is visible' : '✗ Email input field NOT found');
    
    // Check for Password input field
    console.log('\n4. Checking for Password input field...');
    const passwordInput = await page.locator('input[type="password"]').first();
    const passwordVisible = await passwordInput.isVisible().catch(() => false);
    console.log(passwordVisible ? '✓ Password input field is visible' : '✗ Password input field NOT found');
    
    // Check for Register button
    console.log('\n5. Checking for Register button...');
    const registerButton = await page.locator('button:has-text("Register"), button:has-text("Sign up"), button[type="submit"]').first();
    const registerVisible = await registerButton.isVisible().catch(() => false);
    console.log(registerVisible ? '✓ Register button is visible' : '✗ Register button NOT found');
    
    // Check for Google login button
    console.log('\n6. Checking for Google login button...');
    const googleButton = await page.locator('button:has-text("Google"), a:has-text("Google"), [aria-label*="Google" i]').first();
    const googleVisible = await googleButton.isVisible().catch(() => false);
    console.log(googleVisible ? '✓ Google login button is visible' : '✗ Google login button NOT found');
    
    // Check for Apple login button
    console.log('\n7. Checking for Apple login button...');
    const appleButton = await page.locator('button:has-text("Apple"), a:has-text("Apple"), [aria-label*="Apple" i]').first();
    const appleVisible = await appleButton.isVisible().catch(() => false);
    console.log(appleVisible ? '✓ Apple login button is visible' : '✗ Apple login button NOT found');
    
    // Take screenshot
    console.log('\n8. Taking screenshot...');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/registration-page-screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved to: /Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/registration-page-screenshot.png');
    
    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`Page Loads: ✓`);
    console.log(`Name Input: ${nameVisible ? '✓' : '✗'}`);
    console.log(`Email Input: ${emailVisible ? '✓' : '✗'}`);
    console.log(`Password Input: ${passwordVisible ? '✓' : '✗'}`);
    console.log(`Register Button: ${registerVisible ? '✓' : '✗'}`);
    console.log(`Google Button: ${googleVisible ? '✓' : '✗'}`);
    console.log(`Apple Button: ${appleVisible ? '✓' : '✗'}`);
    
    const allPassed = nameVisible && emailVisible && passwordVisible && registerVisible && googleVisible && appleVisible;
    console.log(`\nOverall Status: ${allPassed ? 'PASSED ✓' : 'FAILED ✗'}`);
    
    // Wait a bit to see the page
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('Error during test:', error.message);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/registration-page-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
