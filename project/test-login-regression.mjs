import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('1. Navigating to login page...');
    const response = await page.goto('http://localhost:3000/en/auth/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Check response status
    const status = response.status();
    console.log(`   ✓ Page loaded with status: ${status}`);
    if (status !== 200) {
      console.log(`   ✗ WARNING: Expected status 200, got ${status}`);
    }
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    console.log('\n2. Checking for login form...');
    
    // Check for email field
    const emailField = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const emailVisible = await emailField.isVisible({ timeout: 5000 }).catch(() => false);
    if (emailVisible) {
      console.log('   ✓ Email field is visible');
    } else {
      console.log('   ✗ Email field NOT found');
    }
    
    // Check for password field
    const passwordField = await page.locator('input[type="password"], input[name="password"]').first();
    const passwordVisible = await passwordField.isVisible({ timeout: 5000 }).catch(() => false);
    if (passwordVisible) {
      console.log('   ✓ Password field is visible');
    } else {
      console.log('   ✗ Password field NOT found');
    }
    
    console.log('\n3. Checking for social login buttons...');
    
    // Check for Google button
    const googleButton = await page.locator('button:has-text("Google"), [aria-label*="Google" i], [title*="Google" i]').first();
    const googleVisible = await googleButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (googleVisible) {
      console.log('   ✓ Google login button is visible');
    } else {
      console.log('   ✗ Google login button NOT found');
    }
    
    // Check for Apple button
    const appleButton = await page.locator('button:has-text("Apple"), [aria-label*="Apple" i], [title*="Apple" i]').first();
    const appleVisible = await appleButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (appleVisible) {
      console.log('   ✓ Apple login button is visible');
    } else {
      console.log('   ✗ Apple login button NOT found');
    }
    
    console.log('\n4. Checking page styling...');
    
    // Check body background color
    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      const bgColor = window.getComputedStyle(body).backgroundColor;
      return bgColor;
    });
    console.log(`   Body background color: ${bodyBg}`);
    
    // Check if there's visible text content
    const bodyText = await page.evaluate(() => {
      return document.body.innerText.length;
    });
    console.log(`   Body text content length: ${bodyText} characters`);
    
    // Check for any visible headings
    const headings = await page.locator('h1, h2, h3').count();
    console.log(`   Number of headings found: ${headings}`);
    
    console.log('\n5. Taking screenshot...');
    await page.screenshot({ 
      path: 'login-page-regression-screenshot.png',
      fullPage: true 
    });
    console.log('   ✓ Screenshot saved as: login-page-regression-screenshot.png');
    
    console.log('\n--- Additional Page Information ---');
    
    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    // Get all button text
    const buttons = await page.locator('button').allTextContents();
    console.log(`Buttons found: ${buttons.join(', ')}`);
    
    // Check for any error messages
    const errors = await page.locator('[role="alert"], .error, .alert-error').count();
    console.log(`Error elements found: ${errors}`);
    
    console.log('\n✅ Regression test complete!');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    await page.screenshot({ path: 'login-page-error-screenshot.png' });
    console.log('Error screenshot saved as: login-page-error-screenshot.png');
  } finally {
    await browser.close();
  }
})();
