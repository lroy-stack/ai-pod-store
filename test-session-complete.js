const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('=== FEATURE #44: Session Persistence Test ===\n');
    
    // Part 1: Register a new user
    console.log('PART 1: USER REGISTRATION\n');
    console.log('Step 1: Navigating to registration page...');
    await page.goto('http://localhost:3000/en/auth/register', { waitUntil: 'networkidle' });
    console.log('✓ Registration page loaded');
    
    console.log('\nStep 2: Filling complete registration form...');
    const testEmail = `testuser${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    // Fill all form fields
    const nameInput = await page.locator('input[name="name"], input[type="text"]').first();
    await nameInput.fill('Test User');
    console.log('✓ Name: Test User');
    
    const emailInput = await page.locator('input[type="email"]').first();
    await emailInput.fill(testEmail);
    console.log(`✓ Email: ${testEmail}`);
    
    const passwordInputs = await page.locator('input[type="password"]').all();
    if (passwordInputs.length > 0) {
      await passwordInputs[0].fill(testPassword);
      console.log('✓ Password filled');
    }
    
    // Fill confirm password if exists
    if (passwordInputs.length > 1) {
      await passwordInputs[1].fill(testPassword);
      console.log('✓ Confirm password filled');
    }
    
    // Check terms checkbox
    const termsCheckbox = await page.locator('input[type="checkbox"]').first();
    const isChecked = await termsCheckbox.isChecked().catch(() => false);
    if (!isChecked) {
      await termsCheckbox.check();
      console.log('✓ Terms checkbox checked');
    }
    
    console.log('\nStep 3: Submitting registration...');
    const submitButton = await page.locator('button[type="submit"], button:has-text("Create account"), button:has-text("Register"), button:has-text("Sign up")').first();
    await submitButton.click();
    
    // Wait for navigation or error
    await page.waitForTimeout(3000);
    
    const registrationUrl = page.url();
    console.log(`✓ Registration form submitted`);
    console.log(`Current URL: ${registrationUrl}`);
    
    const stillOnRegisterPage = registrationUrl.includes('/auth/register');
    const registrationSuccess = !stillOnRegisterPage;
    
    if (registrationSuccess) {
      console.log('✓ Registration successful - redirected away from registration page');
    } else {
      console.log('✗ Still on registration page - may need email confirmation');
      await page.screenshot({ 
        path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-registration-result.png', 
        fullPage: true 
      });
    }
    
    // Part 2: Login
    console.log('\n\nPART 2: USER LOGIN\n');
    console.log('Step 4: Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log('✓ Login page loaded');
    
    console.log('\nStep 5: Filling login credentials...');
    const loginEmailInput = await page.locator('input[type="email"]').first();
    await loginEmailInput.fill(testEmail);
    console.log(`✓ Email: ${testEmail}`);
    
    const loginPasswordInput = await page.locator('input[type="password"]').first();
    await loginPasswordInput.fill(testPassword);
    console.log('✓ Password filled');
    
    console.log('\nStep 6: Submitting login form...');
    const loginButton = await page.locator('button[type="submit"]').first();
    
    // Wait for potential navigation
    const navPromise = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
    await loginButton.click();
    await navPromise;
    await page.waitForTimeout(2000);
    
    const loginUrl = page.url();
    console.log('✓ Login submitted');
    console.log(`Current URL: ${loginUrl}`);
    
    // Take screenshot after login attempt
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-login.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-login.png');
    
    // Part 3: Check cookies
    console.log('\n\nPART 3: AUTHENTICATION COOKIES CHECK\n');
    const cookies = await context.cookies();
    console.log(`Total cookies: ${cookies.length}`);
    
    console.log('\nAll cookies found:');
    cookies.forEach(cookie => {
      console.log(`  - ${cookie.name} (httpOnly: ${cookie.httpOnly}, secure: ${cookie.secure})`);
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
      console.log('\n✓ Authentication cookies detected:');
      authCookies.forEach(cookie => {
        console.log(`  - ${cookie.name}`);
      });
    } else {
      console.log('\n✗ No authentication cookies found');
    }
    
    // Part 4: Verify login state
    console.log('\n\nPART 4: LOGIN STATE VERIFICATION\n');
    
    const isOnAuthPage = loginUrl.includes('/auth/');
    const loginFormStillVisible = await page.locator('input[type="email"]').isVisible().catch(() => false);
    
    console.log(`Still on auth page: ${isOnAuthPage}`);
    console.log(`Login form visible: ${loginFormStillVisible}`);
    
    const isLoggedIn = !isOnAuthPage && !loginFormStillVisible;
    console.log(isLoggedIn ? '\n✓ User is logged in' : '\n✗ User is NOT logged in');
    
    // Part 5: Test session persistence
    console.log('\n\nPART 5: SESSION PERSISTENCE\n');
    console.log('Step 7: Refreshing page to test session...');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log('✓ Page refreshed');
    
    const urlAfterRefresh = page.url();
    console.log(`URL after refresh: ${urlAfterRefresh}`);
    
    const backToAuth = urlAfterRefresh.includes('/auth/');
    const loginFormAfterRefresh = await page.locator('input[type="email"]').isVisible().catch(() => false);
    
    const sessionPersists = !backToAuth && !loginFormAfterRefresh;
    console.log(sessionPersists ? '\n✓ Session persists after refresh' : '\n✗ Session lost - redirected to auth');
    
    // Take final screenshot
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-after-refresh.png', 
      fullPage: true 
    });
    console.log('✓ Screenshot saved: session-after-refresh.png');
    
    // Final summary
    console.log('\n\n=== TEST RESULTS SUMMARY ===');
    console.log(`1. Registration completed: ${registrationSuccess ? '✓' : '⚠'}`);
    console.log(`2. Login attempted: ✓`);
    console.log(`3. Auth cookies present: ${hasAuthCookies ? '✓' : '✗'}`);
    console.log(`4. User logged in: ${isLoggedIn ? '✓' : '✗'}`);
    console.log(`5. Session persists: ${sessionPersists ? '✓' : '✗'}`);
    
    const testPassed = hasAuthCookies && isLoggedIn && sessionPersists;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Feature #44 (Session Persistence): ${testPassed ? 'PASSING ✓✓✓' : 'FAILING ✗✗✗'}`);
    console.log(`${'='.repeat(60)}`);
    
    if (!testPassed) {
      console.log('\nDiagnostics:');
      if (!hasAuthCookies) {
        console.log('  - No authentication cookies set (check Supabase integration)');
      }
      if (!isLoggedIn) {
        console.log('  - Login failed (check credentials or email confirmation requirement)');
      }
      if (!sessionPersists) {
        console.log('  - Session not persisting (check cookie configuration)');
      }
      console.log(`\nTest account: ${testEmail}`);
    }
    
    // Keep browser open briefly
    await page.waitForTimeout(3000);
    
  } catch (error) {
    console.error('\n✗ TEST ERROR:', error.message);
    console.error(error.stack);
    await page.screenshot({ 
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/session-test-error.png', 
      fullPage: true 
    });
  } finally {
    await browser.close();
  }
})();
