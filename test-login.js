const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    console.log('✓ Page loaded successfully');
    
    console.log('\n2. Checking email input field...');
    const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const emailVisible = await emailInput.isVisible();
    console.log(emailVisible ? '✓ Email input field is visible' : '✗ Email input field is NOT visible');
    
    console.log('\n3. Checking password input field...');
    const passwordInput = await page.locator('input[type="password"], input[name="password"]').first();
    const passwordVisible = await passwordInput.isVisible();
    console.log(passwordVisible ? '✓ Password input field is visible' : '✗ Password input field is NOT visible');
    
    console.log('\n4. Checking login button...');
    const loginButton = await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first();
    const loginButtonVisible = await loginButton.isVisible();
    console.log(loginButtonVisible ? '✓ Login button is visible' : '✗ Login button is NOT visible');
    
    console.log('\n5. Checking social login buttons...');
    const googleButton = await page.locator('button:has-text("Google"), a:has-text("Google"), [aria-label*="Google" i]').first();
    const googleVisible = await googleButton.isVisible().catch(() => false);
    console.log(googleVisible ? '✓ Google login button is visible' : '✗ Google login button is NOT visible');
    
    const appleButton = await page.locator('button:has-text("Apple"), a:has-text("Apple"), [aria-label*="Apple" i]').first();
    const appleVisible = await appleButton.isVisible().catch(() => false);
    console.log(appleVisible ? '✓ Apple login button is visible' : '✗ Apple login button is NOT visible');
    
    console.log('\n6. Taking screenshot...');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/login-page-screenshot.png', fullPage: true });
    console.log('✓ Screenshot saved to login-page-screenshot.png');
    
    console.log('\n=== Summary ===');
    console.log(`Page loaded: ✓`);
    console.log(`Email input: ${emailVisible ? '✓' : '✗'}`);
    console.log(`Password input: ${passwordVisible ? '✓' : '✗'}`);
    console.log(`Login button: ${loginButtonVisible ? '✓' : '✗'}`);
    console.log(`Google button: ${googleVisible ? '✓' : '✗'}`);
    console.log(`Apple button: ${appleVisible ? '✓' : '✗'}`);
    
    const allPassed = emailVisible && passwordVisible && loginButtonVisible && googleVisible && appleVisible;
    console.log(`\nFeature #38 Status: ${allPassed ? 'PASSING ✓' : 'FAILING ✗'}`);
    
  } catch (error) {
    console.error('Error during test:', error.message);
  } finally {
    await browser.close();
  }
})();
