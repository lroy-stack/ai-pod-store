const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('=== FEATURE #44: Session Persistence Test (with Registration) ===\n');
    
    // Part 1: Register a new user
    console.log('PART 1: REGISTRATION\n');
    console.log('Step 1: Navigating to registration page...');
    await page.goto('http://localhost:3000/en/auth/register', { waitUntil: 'networkidle' });
    console.log('✓ Registration page loaded');
    
    console.log('\nStep 2: Filling registration form...');
    const testEmail = `testuser${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    await page.locator('input[name="name"], input[type="text"]').first().fill('Test User');
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    
    console.log(`✓ Name: Test User`);
    console.log(`✓ Email: ${testEmail}`);
    console.log(`✓ Password: ${testPassword}`);
    
    console.log('\nStep 3: Submitting registration...');
    await page.locator('button[type="submit"], button:has-text("Register"), button:has-text("Sign up")').first().click();
    
    // Wait for either navigation or error message
    await page.waitForTimeout(3000);
    
    const registrationUrl = page.url();
    console.log(`✓ Registration submitted`);
    console.log(`Current URL: ${registrationUrl}`);
    
    // Check if registration was successful
    const stillOnRegisterPage = registrationUrl.includes('/auth/register');
    const registrationSuccess = !stillOnRegisterPage;
    
    if (!registrationSuccess) {
      console.log('✗ Registration may have failed - still on registration page');
      // Take screenshot and continue with existing credentials
      await page.screenshot({ 
        path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-registration-failed.png', 
        fullPage: true 
      });
    } else {
      console.log('✓ Registration appears successful - redirected from registration page');
    }
    
    // Part 2: Login Test
    console.log('\n\nPART 2: LOGIN TEST\n');
    console.log('Step 4: Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    console.log('✓ Login page loaded');
    
    console.log('\nStep 5: Filling in login credentials...');
    await page.locator('input[type="email"]').first().fill(testEmail);
    await page.locator('input[type="password"]').first().fill(testPassword);
    console.log(`✓ Email: ${testEmail}`);
    console.log('✓ Password filled');
    
    console.log('\nStep 6: Clicking sign in button...');
    const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
    await page.locator('button[type="submit"]').first().click();
    await navigationPromise;
    await page.waitForTimeout(2000);
    
    const loginUrl = page.url();
    console.log('✓ Sign in button clicked');
    console.log(`Current URL: ${loginUrl}`);
    
    // Check for error messages
    const errorVisible = await page.locator('text=/invalid|error|wrong/i').isVisible().catch(() => false);
    if (errorVisible) {
      console.log('✗ Error message visible on page');
    }
    
    // Take screenshot after login
    console.log('\nStep 7: Taking screenshot after login...');
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-login.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-login.png');
    
    // Part 3: Check Cookies
    console.log('\n\nPART 3: COOKIE VERIFICATION\n');
    console.log('Step 8: Checking authentication cookies...');
    const cookies = await context.cookies();
    
    console.log(`Total cookies found: ${cookies.length}`);
    console.log('\nAll cookies:');
    cookies.forEach(cookie => {
      console.log(`  - ${cookie.name} (domain: ${cookie.domain}, httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure})`);
    });
    
    const authCookies = cookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('session') || 
      c.name.includes('token') ||
      c.name.includes('sb-') ||
      c.name.includes('supabase')
    );
    
    const hasAuthCookies = authCookies.length > 0;
    
    if (hasAuthCookies) {
      console.log('\n✓ Authentication-related cookies found:');
      authCookies.forEach(cookie => {
        console.log(`  - ${cookie.name} (httpOnly: ${cookie.httpOnly})`);
      });
    } else {
      console.log('\n✗ No authentication cookies found');
    }
    
    // Part 4: Verify Login Status
    console.log('\n\nPART 4: LOGIN STATUS VERIFICATION\n');
    console.log('Step 9: Checking login status...');
    
    const isOnLoginPage = loginUrl.includes('/auth/login');
    const isOnRegisterPage = loginUrl.includes('/auth/register');
    const isOnAuthPage = isOnLoginPage || isOnRegisterPage;
    
    console.log(`On auth page: ${isOnAuthPage}`);
    console.log(`On login page specifically: ${isOnLoginPage}`);
    
    const loginFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    const isLoggedIn = !isOnAuthPage && !loginFormVisible;
    
    console.log(isLoggedIn ? '✓ User appears to be logged in' : '✗ User does NOT appear to be logged in');
    
    // Part 5: Test Session Persistence
    console.log('\n\nPART 5: SESSION PERSISTENCE TEST\n');
    console.log('Step 10: Refreshing the page...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log('✓ Page refreshed');
    
    console.log('\nStep 11: Verifying session persists after refresh...');
    const urlAfterRefresh = page.url();
    console.log(`URL after refresh: ${urlAfterRefresh}`);
    
    const redirectedToAuth = urlAfterRefresh.includes('/auth/');
    const loginFormVisibleAfterRefresh = await page.locator('input[type="email"]').isVisible().catch(() => false);
    
    const sessionPersists = !redirectedToAuth && !loginFormVisibleAfterRefresh;
    
    console.log(sessionPersists ? '✓ Session persists after refresh' : '✗ Session does NOT persist');
    
    // Take final screenshot
    console.log('\nStep 12: Taking final screenshot...');
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-refresh.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-refresh.png');
    
    // Final Summary
    console.log('\n\n=== FINAL TEST SUMMARY ===');
    console.log(`Registration: ${registrationSuccess ? '✓' : '✗'}`);
    console.log(`Login attempted: ✓`);
    console.log(`Authentication cookies: ${hasAuthCookies ? '✓' : '✗'}`);
    console.log(`User logged in: ${isLoggedIn ? '✓' : '✗'}`);
    console.log(`Session persists after refresh: ${sessionPersists ? '✓' : '✗'}`);
    
    const testPassed = hasAuthCookies && isLoggedIn && sessionPersists;
    
    console.log(`\n${testPassed ? '✓✓✓' : '✗✗✗'} Feature #44 (Session Persistence): ${testPassed ? 'PASSING' : 'FAILING'} ${testPassed ? '✓✓✓' : '✗✗✗'}`);
    
    if (!testPassed) {
      console.log('\n=== DIAGNOSTIC INFORMATION ===');
      if (!hasAuthCookies) console.log('Issue: Authentication cookies not being set after login');
      if (!isLoggedIn) console.log('Issue: Login not successful - user still on auth page');
      if (!sessionPersists) console.log('Issue: Session not maintained after page refresh');
      
      console.log(`\nTest account created: ${testEmail}`);
      console.log('Check screenshots for visual debugging');
    }
    
    // Wait to observe
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('\n✗ Error during test:', error.message);
    console.error(error.stack);
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();
