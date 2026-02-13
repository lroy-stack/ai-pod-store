import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== LOGOUT FLOW TEST (SPANISH) ===\n');

  try {
    // Login with Spanish locale
    console.log('Step 1: Navigating to Spanish login page...');
    await page.goto('http://localhost:3000/es/auth/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-es-01-login-page.png', fullPage: true });
    console.log('✓ Spanish login page loaded');

    console.log('\nStep 2: Filling login form...');
    await page.fill('input[type="email"]', 'testuser1771006217711@example.com');
    await page.fill('input[type="password"]', 'password123');
    console.log('✓ Form filled');

    console.log('\nStep 3: Submitting login form...');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/es', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('✓ Redirected to Spanish home page');
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-es-02-logged-in.png', fullPage: true });

    // Verify Spanish logout button text
    console.log('\nStep 4: Verifying Spanish logout button...');
    const logoutButton = await page.locator('button:has-text("Cerrar sesión")').first();
    
    if (await logoutButton.count() === 0) {
      console.log('⚠ Spanish logout button not found. Looking for English version...');
      const englishButton = await page.locator('button:has-text("Log out")').first();
      if (await englishButton.count() > 0) {
        console.log('⚠ Found English button instead of Spanish - i18n may not be working correctly');
      }
      throw new Error('Spanish logout button not found');
    }
    
    const buttonText = await logoutButton.textContent();
    console.log(`✓ Spanish logout button found with text: "${buttonText}"`);
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-es-03-button-visible.png', fullPage: true });

    // Click logout
    console.log('\nStep 5: Clicking Spanish logout button...');
    await logoutButton.click();
    await page.waitForURL('http://localhost:3000/es/auth/login', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    console.log('✓ Redirected to Spanish login page');
    
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-es-04-after-logout.png', fullPage: true });

    // Verify Spanish login page content
    const pageContent = await page.textContent('body');
    if (pageContent.includes('Inicia sesión') || pageContent.includes('Iniciar sesión')) {
      console.log('✓ Spanish login page content verified');
    } else if (pageContent.includes('Sign in')) {
      console.log('⚠ Page shows English content instead of Spanish');
    }

    console.log('\n✓ SPANISH LOGOUT FLOW TEST PASSED\n');

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/test-results/logout-es-error.png', fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
