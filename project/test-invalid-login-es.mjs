import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Step 1: Navigate to Spanish login page');
    await page.goto('http://localhost:3000/es/auth/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    console.log('Step 2: Fill in login form with invalid credentials');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    
    console.log('Step 3: Take screenshot before submission');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/invalid-login-form-filled-es.png', fullPage: true });
    
    console.log('Step 4: Click Sign in button');
    await page.click('button[type="submit"]');
    
    // Wait for the response and error message to appear
    await page.waitForTimeout(2000);
    
    console.log('Step 5: Take screenshot after submission');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/invalid-login-error-message-es.png', fullPage: true });
    
    console.log('Step 6: Check for error message');
    const errorElement = await page.locator('div.bg-red-50').first();
    const errorExists = await errorElement.count() > 0;
    
    if (errorExists) {
      const errorText = await errorElement.locator('h3.text-red-800').textContent();
      console.log('✓ Error message found:', errorText);
      console.log('✓ Error styling: bg-red-50 (red background)');
      console.log('✓ Error text color: text-red-800 (dark red text)');
    } else {
      console.log('✗ No error message found');
    }
    
    // Check that we're still on the login page (not redirected)
    const currentUrl = page.url();
    if (currentUrl.includes('/auth/login')) {
      console.log('✓ User remains on login page after failed login');
    } else {
      console.log('✗ Unexpected redirect to:', currentUrl);
    }
    
    console.log('\nSpanish locale test completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/invalid-login-error-es.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
