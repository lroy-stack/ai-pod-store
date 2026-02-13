const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('=== Session Persistence Test - Spanish Locale ===\n');
    
    // Register user on Spanish locale
    console.log('Step 1: Testing registration on /es/ locale...');
    await page.goto('http://localhost:3000/es/auth/register', { waitUntil: 'networkidle' });
    console.log('✓ Spanish registration page loaded');
    
    const testEmail = `testuser${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // Fill registration form
    await page.locator('input[name="name"], input[type="text"]').first().fill('Usuario Prueba');
    await page.locator('input[type="email"]').first().fill(testEmail);
    
    const passwordInputs = await page.locator('input[type="password"]').all();
    await passwordInputs[0].fill(testPassword);
    if (passwordInputs.length > 1) {
      await passwordInputs[1].fill(testPassword);
    }
    
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
    
    console.log('✓ Registration submitted on Spanish locale');
    
    // Login on Spanish locale
    console.log('\nStep 2: Testing login on /es/ locale...');
    await page.goto('http://localhost:3000/es/auth/login', { waitUntil: 'networkidle' });
    
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    await page.locator('button[type="submit"]').first().click();
    
    await page.waitForTimeout(2000);
    
    const loginUrl = page.url();
    console.log(`✓ Login submitted, current URL: ${loginUrl}`);
    
    // Check cookies
    const cookies = await context.cookies();
    const authCookies = cookies.filter(c => 
      c.name.includes('sb-') || c.name.includes('token')
    );
    
    console.log(`\nAuthentication cookies: ${authCookies.length > 0 ? '✓ Found' : '✗ Not found'}`);
    
    // Verify logged in
    const isLoggedIn = !loginUrl.includes('/auth/');
    console.log(`Logged in: ${isLoggedIn ? '✓ Yes' : '✗ No'}`);
    
    // Test session persistence
    console.log('\nStep 3: Testing session persistence with refresh...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    
    const urlAfterRefresh = page.url();
    const sessionPersists = !urlAfterRefresh.includes('/auth/');
    
    console.log(`URL after refresh: ${urlAfterRefresh}`);
    console.log(`Session persists: ${sessionPersists ? '✓ Yes' : '✗ No'}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-es-locale.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-es-locale.png');
    
    // Final result
    const testPassed = authCookies.length > 0 && isLoggedIn && sessionPersists;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Spanish Locale Session Test: ${testPassed ? 'PASSING ✓' : 'FAILING ✗'}`);
    console.log(`${'='.repeat(60)}`);
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
