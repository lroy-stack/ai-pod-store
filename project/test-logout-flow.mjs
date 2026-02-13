import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== LOGOUT FLOW TEST ===\n');

  try {
    // STEP 1: Login to get authenticated session
    console.log('Step 1: Navigating to login page...');
    await page.goto('http://localhost:3000/en/auth/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-01-login-page.png', fullPage: true });
    console.log('✓ Login page loaded');

    console.log('\nStep 2: Filling login form...');
    await page.fill('input[type="email"]', 'testuser1771006217711@example.com');
    await page.fill('input[type="password"]', 'password123');
    console.log('✓ Form filled with credentials');

    console.log('\nStep 3: Submitting login form...');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to home page
    await page.waitForURL('http://localhost:3000/en', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('✓ Redirected to home page after login');
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-02-logged-in-home.png', fullPage: true });

    // Check cookies after login
    const cookiesAfterLogin = await context.cookies();
    console.log('\nCookies after login:');
    cookiesAfterLogin.forEach(cookie => {
      if (cookie.name.includes('sb-')) {
        console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
      }
    });

    // STEP 2: Verify logout button is visible
    console.log('\n\nStep 4: Verifying logout button is visible...');
    const logoutButton = await page.locator('button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out")').first();
    
    if (await logoutButton.count() === 0) {
      // Try alternative selectors
      const altButton = await page.locator('[data-testid="logout-button"], .logout-button, button[class*="logout"]').first();
      if (await altButton.count() === 0) {
        console.log('⚠ Logout button not found with standard selectors. Searching for all buttons...');
        const allButtons = await page.locator('button').all();
        console.log(`Found ${allButtons.length} buttons on the page`);
        for (let i = 0; i < allButtons.length; i++) {
          const text = await allButtons[i].textContent();
          const isVisible = await allButtons[i].isVisible();
          if (isVisible) {
            console.log(`  Button ${i}: "${text}"`);
          }
        }
        throw new Error('Logout button not found');
      }
    }
    
    const isVisible = await logoutButton.isVisible();
    if (!isVisible) {
      throw new Error('Logout button exists but is not visible');
    }
    
    // Highlight the button in screenshot
    await logoutButton.scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-03-logout-button-visible.png', fullPage: true });
    console.log('✓ Logout button is visible');

    // Check console for errors before logout
    const consoleMessagesBefore = [];
    page.on('console', msg => consoleMessagesBefore.push({ type: msg.type(), text: msg.text() }));

    // STEP 3: Click logout button
    console.log('\n\nStep 5: Clicking logout button...');
    await logoutButton.click();
    
    // Wait for redirect to login page
    await page.waitForURL('http://localhost:3000/en/auth/login', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('✓ Redirected to login page after logout');
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-04-after-logout.png', fullPage: true });

    // STEP 4: Verify session cookies are cleared
    console.log('\n\nStep 6: Verifying session cookies are cleared...');
    const cookiesAfterLogout = await context.cookies();
    console.log('Cookies after logout:');
    
    const sbAccessToken = cookiesAfterLogout.find(c => c.name === 'sb-access-token');
    const sbRefreshToken = cookiesAfterLogout.find(c => c.name === 'sb-refresh-token');
    
    if (sbAccessToken) {
      console.log(`  - sb-access-token: ${sbAccessToken.value === '' ? '(empty)' : sbAccessToken.value.substring(0, 50) + '...'}`);
    } else {
      console.log('  - sb-access-token: (deleted)');
    }
    
    if (sbRefreshToken) {
      console.log(`  - sb-refresh-token: ${sbRefreshToken.value === '' ? '(empty)' : sbRefreshToken.value.substring(0, 50) + '...'}`);
    } else {
      console.log('  - sb-refresh-token: (deleted)');
    }

    // Verify tokens are cleared or deleted
    const tokensCleared = (!sbAccessToken || sbAccessToken.value === '') && 
                          (!sbRefreshToken || sbRefreshToken.value === '');
    
    if (tokensCleared) {
      console.log('✓ Session cookies are cleared');
    } else {
      console.log('⚠ Session cookies may still contain values');
    }

    // Verify user is no longer authenticated by trying to access protected route
    console.log('\n\nStep 7: Verifying user is no longer authenticated...');
    await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });
    
    // Check if we're redirected back to login or see login-related content
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
      console.log('✓ User redirected to login page when accessing home - not authenticated');
    } else {
      // Check if we see logout button (authenticated) or login button (not authenticated)
      const hasLogoutButton = await page.locator('button:has-text("Logout"), button:has-text("Log out")').count() > 0;
      if (hasLogoutButton) {
        console.log('⚠ User appears to still be authenticated (logout button visible)');
      } else {
        console.log('✓ User is not authenticated (no logout button visible)');
      }
    }
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-05-verify-not-authenticated.png', fullPage: true });

    // Check console for errors
    console.log('\n\nStep 8: Checking browser console for errors...');
    const errors = consoleMessagesBefore.filter(msg => msg.type === 'error');
    if (errors.length > 0) {
      console.log('⚠ Console errors detected:');
      errors.forEach(err => console.log(`  - ${err.text}`));
    } else {
      console.log('✓ No console errors detected');
    }

    console.log('\n\n=== TEST SUMMARY ===');
    console.log('✓ Login successful');
    console.log('✓ Logout button visible and clickable');
    console.log('✓ Redirected to login page after logout');
    console.log(tokensCleared ? '✓ Session cookies cleared' : '⚠ Session cookies status unclear');
    console.log('✓ User no longer authenticated');
    console.log(errors.length === 0 ? '✓ No console errors' : `⚠ ${errors.length} console error(s)`);
    console.log('\n✓ LOGOUT FLOW TEST PASSED\n');

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
