const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('=== FEATURE #44: Session Persistence Test ===\n');
    
    // Step 1: Navigate to login page
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    console.log('✓ Login page loaded successfully');
    
    // Step 2: Fill in login credentials
    console.log('\nStep 2: Filling in login credentials...');
    const emailInput = await page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = await page.locator('input[type="password"]').first();
    
    await emailInput.fill('test@example.com');
    console.log('✓ Email filled: test@example.com');
    
    await passwordInput.fill('TestPassword123!');
    console.log('✓ Password filled');
    
    // Step 3: Click sign in button
    console.log('\nStep 3: Clicking sign in button...');
    const signInButton = await page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log in")').first();
    
    // Wait for navigation after clicking login
    const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
    await signInButton.click();
    await navigationPromise;
    
    // Wait a bit for the login to process
    await page.waitForTimeout(2000);
    
    console.log('✓ Sign in button clicked');
    console.log(`Current URL: ${page.url()}`);
    
    // Step 4: Take screenshot after login
    console.log('\nStep 4: Taking screenshot after login...');
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-login.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-login.png');
    
    // Step 5: Check for authentication cookies
    console.log('\nStep 5: Checking authentication cookies...');
    const cookies = await context.cookies();
    
    console.log(`Total cookies found: ${cookies.length}`);
    
    const accessTokenCookie = cookies.find(c => c.name.includes('access') || c.name.includes('token') || c.name === 'sb-access-token');
    const refreshTokenCookie = cookies.find(c => c.name.includes('refresh') || c.name === 'sb-refresh-token');
    const authCookies = cookies.filter(c => 
      c.name.includes('auth') || 
      c.name.includes('session') || 
      c.name.includes('token') ||
      c.name.includes('sb-')
    );
    
    console.log('\nAuthentication-related cookies:');
    if (authCookies.length > 0) {
      authCookies.forEach(cookie => {
        console.log(`  - ${cookie.name} (httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure})`);
      });
    } else {
      console.log('  No authentication cookies found');
    }
    
    const hasAuthCookies = authCookies.length > 0;
    console.log(hasAuthCookies ? '\n✓ Authentication cookies are present' : '\n✗ No authentication cookies found');
    
    // Step 6: Check if user is logged in (look for user indicators)
    console.log('\nStep 6: Checking login indicators...');
    
    // Check if we're still on login page (login failed) or redirected
    const isOnLoginPage = page.url().includes('/auth/login');
    const isOnHomePage = page.url() === 'http://localhost:3000/' || page.url() === 'http://localhost:3000/en' || page.url() === 'http://localhost:3000/en/';
    
    console.log(`On login page: ${isOnLoginPage}`);
    console.log(`On home page: ${isOnHomePage}`);
    
    // Look for user menu, profile, or logout button
    const userMenuVisible = await page.locator('[aria-label*="user" i], [aria-label*="account" i], button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Profile")').first().isVisible().catch(() => false);
    console.log(`User menu/profile visible: ${userMenuVisible}`);
    
    // Check if login form is still visible (means login failed)
    const loginFormVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    const isLoggedIn = !isOnLoginPage && !loginFormVisible;
    
    console.log(isLoggedIn ? '✓ User appears to be logged in' : '✗ User does NOT appear to be logged in');
    
    // Step 7: Refresh the page
    console.log('\nStep 7: Refreshing the page to test session persistence...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log('✓ Page refreshed');
    
    // Step 8: Verify session persists after refresh
    console.log('\nStep 8: Verifying session persists after refresh...');
    const urlAfterRefresh = page.url();
    console.log(`URL after refresh: ${urlAfterRefresh}`);
    
    const redirectedToLogin = urlAfterRefresh.includes('/auth/login');
    const loginFormVisibleAfterRefresh = await page.locator('input[type="email"]').isVisible().catch(() => false);
    
    const sessionPersists = !redirectedToLogin && !loginFormVisibleAfterRefresh;
    
    console.log(sessionPersists ? '✓ Session persists after refresh' : '✗ Session does NOT persist (redirected to login)');
    
    // Step 9: Take final screenshot
    console.log('\nStep 9: Taking final screenshot...');
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-refresh.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-refresh.png');
    
    // Final Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`1. Login page loaded: ✓`);
    console.log(`2. Credentials filled: ✓`);
    console.log(`3. Sign in attempted: ✓`);
    console.log(`4. Authentication cookies: ${hasAuthCookies ? '✓' : '✗'}`);
    console.log(`5. User logged in: ${isLoggedIn ? '✓' : '✗'}`);
    console.log(`6. Page refreshed: ✓`);
    console.log(`7. Session persists: ${sessionPersists ? '✓' : '✗'}`);
    
    const testPassed = hasAuthCookies && isLoggedIn && sessionPersists;
    
    console.log(`\n${testPassed ? '✓✓✓' : '✗✗✗'} Feature #44 (Session Persistence): ${testPassed ? 'PASSING' : 'FAILING'} ${testPassed ? '✓✓✓' : '✗✗✗'}`);
    
    if (!testPassed) {
      console.log('\nPossible issues:');
      if (!hasAuthCookies) console.log('  - Authentication cookies not being set');
      if (!isLoggedIn) console.log('  - Login not successful (check credentials or authentication flow)');
      if (!sessionPersists) console.log('  - Session not persisting after page refresh');
    }
    
    // Wait to observe the result
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('\n✗ Error during test:', error.message);
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();
