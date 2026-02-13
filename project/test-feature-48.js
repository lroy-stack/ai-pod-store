const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const screenshotDir = path.join(__dirname, 'screenshots');
  const fs = require('fs');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  console.log('\n=== STEP 1: Test as logged-out user ===\n');
  
  // 1. Visit homepage and ensure we're logged out
  console.log('1. Navigating to homepage...');
  await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle' });
  
  // Check if "Log out" button exists and click it if present
  const logoutButton = await page.locator('button:has-text("Log out"), a:has-text("Log out")').first();
  const logoutExists = await logoutButton.count() > 0;
  
  if (logoutExists) {
    console.log('   Found "Log out" button, clicking it...');
    await logoutButton.click();
    await page.waitForTimeout(1000);
    console.log('   Successfully logged out');
  } else {
    console.log('   Already logged out (no logout button found)');
  }
  
  // 2. Navigate to cart page
  console.log('\n2. Navigating to /en/cart...');
  await page.goto('http://localhost:3000/en/cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // 3. Take screenshot
  console.log('3. Taking screenshot of cart page...');
  await page.screenshot({ path: path.join(screenshotDir, 'step1-cart-logged-out.png'), fullPage: true });
  console.log('   Screenshot saved: screenshots/step1-cart-logged-out.png');
  
  // 4. Verify page loaded and elements are visible
  console.log('\n4. Verifying checkout options...');
  const currentUrl = page.url();
  console.log(`   Current URL: ${currentUrl}`);
  
  if (!currentUrl.includes('/cart')) {
    console.log('   [FAIL] Page redirected away from /cart - may have redirected to login');
  } else {
    console.log('   [PASS] Page loaded successfully (no redirect to login)');
  }
  
  // Check for "Continue as Guest" button
  const guestButton = page.locator('button:has-text("Continue as Guest"), a:has-text("Continue as Guest")').first();
  const guestButtonExists = await guestButton.count() > 0;
  console.log(`   "Continue as Guest" button visible: ${guestButtonExists ? '[PASS]' : '[FAIL]'}`);
  
  // Check for "Sign In to Checkout" button
  const signInButton = page.locator('button:has-text("Sign In to Checkout"), a:has-text("Sign In to Checkout")').first();
  const signInButtonExists = await signInButton.count() > 0;
  console.log(`   "Sign In to Checkout" button visible: ${signInButtonExists ? '[PASS]' : '[FAIL]'}`);
  
  // Check for "or" separator
  const orSeparator = page.locator('text=/\\bor\\b/i').first();
  const orExists = await orSeparator.count() > 0;
  console.log(`   "or" separator visible: ${orExists ? '[PASS]' : '[FAIL]'}`);
  
  // 5. Take close-up screenshot of checkout options
  console.log('\n5. Taking close-up screenshot of checkout options...');
  
  // Try to find the container with both buttons
  const checkoutOptionsContainer = page.locator('div, section').filter({ 
    has: page.locator('button:has-text("Continue as Guest"), a:has-text("Continue as Guest")') 
  }).first();
  
  if (await checkoutOptionsContainer.count() > 0) {
    await checkoutOptionsContainer.screenshot({ path: path.join(screenshotDir, 'step1-checkout-options-closeup.png') });
    console.log('   Screenshot saved: screenshots/step1-checkout-options-closeup.png');
  } else {
    console.log('   Could not find checkout options container for close-up');
  }
  
  console.log('\n=== STEP 2: Test on Spanish locale ===\n');
  
  // 6. Navigate to Spanish cart page
  console.log('6. Navigating to /es/cart...');
  await page.goto('http://localhost:3000/es/cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // 7. Take screenshot and verify Spanish translations
  console.log('7. Taking screenshot and verifying Spanish translations...');
  await page.screenshot({ path: path.join(screenshotDir, 'step2-cart-spanish.png'), fullPage: true });
  console.log('   Screenshot saved: screenshots/step2-cart-spanish.png');
  
  const spanishGuestButton = page.locator('button:has-text("Continuar como Invitado"), a:has-text("Continuar como Invitado")').first();
  const spanishGuestExists = await spanishGuestButton.count() > 0;
  console.log(`   "Continuar como Invitado" button visible: ${spanishGuestExists ? '[PASS]' : '[FAIL]'}`);
  
  const spanishSignInButton = page.locator('button:has-text("Iniciar Sesión para Pagar"), a:has-text("Iniciar Sesión para Pagar")').first();
  const spanishSignInExists = await spanishSignInButton.count() > 0;
  console.log(`   "Iniciar Sesión para Pagar" button visible: ${spanishSignInExists ? '[PASS]' : '[FAIL]'}`);
  
  console.log('\n=== STEP 3: Verify logged-in user doesn\'t see guest option ===\n');
  
  // 8. Log in with test credentials
  console.log('8. Logging in with test credentials...');
  await page.goto('http://localhost:3000/en/login', { waitUntil: 'networkidle' });
  
  // Fill in login form
  await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
  await page.fill('input[type="password"], input[name="password"]', 'TestPassword123!');
  
  // Click login button
  const loginButton = page.locator('button[type="submit"]:has-text("Sign In"), button[type="submit"]:has-text("Log In"), button:has-text("Sign In"), button:has-text("Log In")').first();
  await loginButton.click();
  
  await page.waitForTimeout(2000);
  console.log('   Login attempted');
  
  // 9. Navigate to /en/cart
  console.log('\n9. Navigating to /en/cart as logged-in user...');
  await page.goto('http://localhost:3000/en/cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // 10. Take screenshot
  console.log('10. Taking screenshot...');
  await page.screenshot({ path: path.join(screenshotDir, 'step3-cart-logged-in.png'), fullPage: true });
  console.log('   Screenshot saved: screenshots/step3-cart-logged-in.png');
  
  // 11. Verify checkout options for logged-in user
  console.log('\n11. Verifying checkout options for logged-in user...');
  
  const proceedButton = page.locator('button:has-text("Proceed to Checkout"), a:has-text("Proceed to Checkout")').first();
  const proceedExists = await proceedButton.count() > 0;
  console.log(`   "Proceed to Checkout" button visible: ${proceedExists ? '[PASS]' : '[FAIL]'}`);
  
  const guestButtonLoggedIn = page.locator('button:has-text("Continue as Guest"), a:has-text("Continue as Guest")').first();
  const guestButtonLoggedInExists = await guestButtonLoggedIn.count() > 0;
  console.log(`   "Continue as Guest" NOT visible: ${!guestButtonLoggedInExists ? '[PASS]' : '[FAIL]'}`);
  
  const signInButtonLoggedIn = page.locator('button:has-text("Sign In to Checkout"), a:has-text("Sign In to Checkout")').first();
  const signInButtonLoggedInExists = await signInButtonLoggedIn.count() > 0;
  console.log(`   "Sign In to Checkout" NOT visible: ${!signInButtonLoggedInExists ? '[PASS]' : '[FAIL]'}`);
  
  console.log('\n=== Test Complete ===\n');
  
  await browser.close();
})();
