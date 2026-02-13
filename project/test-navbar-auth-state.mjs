import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('\n=== PREPARATION: Ensure logged-out state ===\n');
    
    // Navigate to homepage first
    await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Check if already logged in and logout if necessary
    const navbarLogoutButton = await page.locator('nav button:has-text("Log out")').first();
    const logoutButtonExists = await navbarLogoutButton.isVisible().catch(() => false);
    if (logoutButtonExists) {
      console.log('User already logged in, logging out first...');
      await navbarLogoutButton.click();
      await page.waitForTimeout(2000);
      // Navigate back to homepage after logout
      await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      console.log('Logged out and returned to homepage\n');
    } else {
      console.log('User already logged out, proceeding with test...\n');
    }
    
    console.log('=== STEP 1: Test logged-out state ===\n');
    
    // 1. Ensure we're on English homepage
    console.log('1. Navigating to http://localhost:3000/en/...');
    await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 2. Take screenshot showing navbar with "Log in" button
    console.log('2. Taking screenshot of logged-out navbar...');
    await page.screenshot({ path: 'navbar-logged-out-en.png', fullPage: true });
    console.log('   Screenshot saved: navbar-logged-out-en.png');
    
    // 3. Verify the navbar shows "Log in" button when logged out
    console.log('3. Verifying "Log in" button is present...');
    const loginLink = await page.locator('nav a[href*="/auth/login"]').first();
    const isLoginVisible = await loginLink.isVisible();
    const loginText = await loginLink.textContent();
    console.log(`   "Log in" link visible: ${isLoginVisible}`);
    console.log(`   Login link text: "${loginText}"`);
    
    // Verify logout button is NOT present
    const logoutNotPresent = !(await page.locator('nav button:has-text("Log out")').isVisible().catch(() => false));
    console.log(`   "Log out" button NOT present: ${logoutNotPresent}`);
    
    if (!isLoginVisible || !logoutNotPresent) {
      console.error('   ERROR: Logged-out state not correct!');
      await page.screenshot({ path: 'navbar-logged-out-error.png', fullPage: true });
      process.exit(1);
    }
    
    console.log('\n=== STEP 2: Log in ===\n');
    
    // 4. Navigate to login page
    console.log('4. Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    console.log('   On login page');
    
    // 5. Fill in login form
    console.log('5. Filling login form with test credentials...');
    await page.fill('input[name="email"], input[type="email"]', 'test@example.com');
    await page.fill('input[name="password"], input[type="password"]', 'TestPassword123!');
    console.log('   Form filled with test@example.com / TestPassword123!');
    
    // 6. Submit the form
    console.log('6. Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home after successful login (with or without trailing slash)
    await page.waitForURL(/\/en\/?$/, { timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log('   Login successful, redirected to home');
    
    console.log('\n=== STEP 3: Test logged-in state ===\n');
    
    // 7. Take screenshot after successful login
    console.log('7. Taking screenshot of logged-in navbar...');
    await page.screenshot({ path: 'navbar-logged-in-en.png', fullPage: true });
    console.log('   Screenshot saved: navbar-logged-in-en.png');
    
    // 8. Verify the navbar shows logged-in elements
    console.log('8. Verifying logged-in navbar elements...');
    
    // Check for user avatar (circular div with first letter)
    const avatar = await page.locator('nav div.rounded-full.bg-blue-600').first();
    const avatarVisible = await avatar.isVisible().catch(() => false);
    const avatarText = avatarVisible ? await avatar.textContent() : 'N/A';
    console.log(`   User avatar visible: ${avatarVisible}`);
    console.log(`   Avatar text: "${avatarText}"`);
    
    // Check for user name or email (next to avatar)
    const userName = await page.locator('nav span.text-sm.font-medium.text-gray-900').first();
    const userNameVisible = await userName.isVisible().catch(() => false);
    const userNameText = userNameVisible ? await userName.textContent() : 'N/A';
    console.log(`   User name/email visible: ${userNameVisible}`);
    console.log(`   User name/email text: "${userNameText}"`);
    
    // Check for "Log out" button in navbar
    const logoutButton = await page.locator('nav button:has-text("Log out")').first();
    const logoutVisible = await logoutButton.isVisible().catch(() => false);
    const logoutText = logoutVisible ? await logoutButton.textContent() : 'N/A';
    console.log(`   "Log out" button visible: ${logoutVisible}`);
    console.log(`   Logout button text: "${logoutText}"`);
    
    // Check that "Log in" link is NOT present in navbar
    const loginStillVisible = await page.locator('nav a[href*="/auth/login"]').isVisible().catch(() => false);
    console.log(`   "Log in" link NOT visible: ${!loginStillVisible}`);
    
    if (!logoutVisible || !avatarVisible || !userNameVisible) {
      console.error('\n   ERROR: Logged-in state not complete!');
      await page.screenshot({ path: 'navbar-logged-in-error.png', fullPage: true });
    }
    
    console.log('\n=== STEP 4: Test on Spanish locale ===\n');
    
    // 9. Navigate to Spanish homepage
    console.log('9. Navigating to http://localhost:3000/es/...');
    await page.goto('http://localhost:3000/es/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // 10. Take screenshot showing Spanish navbar
    console.log('10. Taking screenshot of logged-in Spanish navbar...');
    await page.screenshot({ path: 'navbar-logged-in-es.png', fullPage: true });
    console.log('    Screenshot saved: navbar-logged-in-es.png');
    
    // 11. Verify logged-in state persists across locales
    console.log('11. Verifying logged-in state persists in Spanish locale...');
    
    // Check for "Cerrar sesión" (Log out in Spanish)
    const logoutButtonEs = await page.locator('nav button').filter({ hasText: /cerrar sesión|log out/i }).first();
    const logoutVisibleEs = await logoutButtonEs.isVisible().catch(() => false);
    const logoutTextEs = logoutVisibleEs ? await logoutButtonEs.textContent() : 'N/A';
    console.log(`    Logout button visible: ${logoutVisibleEs}`);
    console.log(`    Logout button text: "${logoutTextEs}"`);
    
    // Check for avatar in Spanish locale
    const avatarEs = await page.locator('nav div.rounded-full.bg-blue-600').first();
    const avatarVisibleEs = await avatarEs.isVisible().catch(() => false);
    const avatarTextEs = avatarVisibleEs ? await avatarEs.textContent() : 'N/A';
    console.log(`    User avatar visible: ${avatarVisibleEs}`);
    console.log(`    Avatar text: "${avatarTextEs}"`);
    
    // Check for user name in Spanish locale
    const userNameEs = await page.locator('nav span.text-sm.font-medium.text-gray-900').first();
    const userNameVisibleEs = await userNameEs.isVisible().catch(() => false);
    const userNameTextEs = userNameVisibleEs ? await userNameEs.textContent() : 'N/A';
    console.log(`    User name/email visible: ${userNameVisibleEs}`);
    console.log(`    User name/email text: "${userNameTextEs}"`);
    
    // Check that "Iniciar sesión" (Log in in Spanish) is NOT present
    const loginButtonEs = await page.locator('nav a[href*="/auth/login"]').isVisible().catch(() => false);
    console.log(`    Login link NOT visible: ${!loginButtonEs}`);
    
    console.log('\n=== TEST SUMMARY ===\n');
    console.log('Step 1 - Logged-out state:');
    console.log('  - Login button visible: ' + (isLoginVisible ? 'PASS' : 'FAIL'));
    console.log('  - Logout button not visible: ' + (logoutNotPresent ? 'PASS' : 'FAIL'));
    console.log('Step 2 - Login process: PASS');
    console.log('Step 3 - Logged-in state (EN):');
    console.log('  - Avatar visible: ' + (avatarVisible ? 'PASS' : 'FAIL'));
    console.log('  - User name visible: ' + (userNameVisible ? 'PASS' : 'FAIL'));
    console.log('  - Logout button visible: ' + (logoutVisible ? 'PASS' : 'FAIL'));
    console.log('  - Login link not visible: ' + (!loginStillVisible ? 'PASS' : 'FAIL'));
    console.log('Step 4 - Spanish locale persistence:');
    console.log('  - Avatar visible: ' + (avatarVisibleEs ? 'PASS' : 'FAIL'));
    console.log('  - User name visible: ' + (userNameVisibleEs ? 'PASS' : 'FAIL'));
    console.log('  - Logout button visible: ' + (logoutVisibleEs ? 'PASS' : 'FAIL'));
    console.log('  - Login link not visible: ' + (!loginButtonEs ? 'PASS' : 'FAIL'));
    
    const allPassed = isLoginVisible && logoutNotPresent && avatarVisible && userNameVisible && logoutVisible && !loginStillVisible && avatarVisibleEs && userNameVisibleEs && logoutVisibleEs && !loginButtonEs;
    console.log('\nOverall result: ' + (allPassed ? 'PASS' : 'FAIL'));
    
    if (!allPassed) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\nERROR during test execution:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: 'navbar-auth-test-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
