const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('\n=== Step 1: Navigate to Homepage ===');
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  // Navigate to homepage
  await page.goto('http://localhost:3000/en');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of homepage
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_01_homepage.png', fullPage: true });
  console.log('Screenshot saved: screenshot_01_homepage.png');
  
  // Check for console errors
  console.log(`Console errors found: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Errors:', consoleErrors);
  }
  
  console.log('\n=== Step 2: Verify Navbar ===');
  
  // Check for "Log in" button in navbar
  const loginButton = await page.locator('nav >> text=/log in/i').first();
  const isLoginVisible = await loginButton.isVisible().catch(() => false);
  console.log(`"Log in" button visible: ${isLoginVisible}`);
  
  if (isLoginVisible) {
    const loginText = await loginButton.textContent();
    console.log(`Login button text: "${loginText}"`);
  }
  
  // Take screenshot of navbar area
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_02_navbar.png' });
  console.log('Screenshot saved: screenshot_02_navbar.png');
  
  console.log('\n=== Step 3: Navigate to Login Page ===');
  
  // Navigate to login page
  await page.goto('http://localhost:3000/en/login');
  await page.waitForLoadState('networkidle');
  
  // Take screenshot of login page
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_03_login_page.png', fullPage: true });
  console.log('Screenshot saved: screenshot_03_login_page.png');
  
  console.log('\n=== Step 4: Verify Login Form ===');
  
  // Check for email input
  const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
  const isEmailVisible = await emailInput.isVisible().catch(() => false);
  console.log(`Email input visible: ${isEmailVisible}`);
  
  // Check for password input
  const passwordInput = await page.locator('input[type="password"]').first();
  const isPasswordVisible = await passwordInput.isVisible().catch(() => false);
  console.log(`Password input visible: ${isPasswordVisible}`);
  
  console.log('\n=== Step 5: Fill Login Form ===');
  
  if (isEmailVisible && isPasswordVisible) {
    // Fill email
    await emailInput.fill('test@example.com');
    console.log('Filled email: test@example.com');
    
    // Fill password
    await passwordInput.fill('password123');
    console.log('Filled password: password123');
    
    // Take screenshot with filled form
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_04_filled_form.png', fullPage: true });
    console.log('Screenshot saved: screenshot_04_filled_form.png');
    
    // Check for submit button
    const submitButton = await page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")').first();
    const isSubmitVisible = await submitButton.isVisible().catch(() => false);
    console.log(`Submit button visible: ${isSubmitVisible}`);
    
    if (isSubmitVisible) {
      const submitText = await submitButton.textContent();
      console.log(`Submit button text: "${submitText}"`);
    }
  }
  
  console.log('\n=== Summary ===');
  console.log(`Total console errors: ${consoleErrors.length}`);
  console.log('All screenshots saved to workspace directory');
  
  await browser.close();
  console.log('\nTest completed!');
})();
