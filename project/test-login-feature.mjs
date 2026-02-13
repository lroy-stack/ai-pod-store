import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testLoginFeature() {
  console.log('Starting login feature E2E test...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down actions for better visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Track console messages
  const consoleMessages = [];
  const consoleErrors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push({ type: msg.type(), text });
    if (msg.type() === 'error') {
      consoleErrors.push(text);
      console.log(`[BROWSER ERROR] ${text}`);
    } else {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
    }
  });
  
  // Track page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    consoleErrors.push(error.message);
  });
  
  try {
    // Step 1: Navigate to login page
    console.log('\n=== Step 1: Navigate to login page ===');
    await page.goto('http://localhost:3000/en/auth/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const initialUrl = page.url();
    console.log('Current URL:', initialUrl);
    await page.screenshot({ 
      path: join(__dirname, 'login-page-initial.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: login-page-initial.png');
    
    // Verify page loaded correctly
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check for key elements
    const emailInput = await page.locator('input[name="email"], input[type="email"], input[placeholder*="email" i]');
    const passwordInput = await page.locator('input[name="password"], input[type="password"]');
    const submitButton = await page.locator('button:has-text("Sign in"), button[type="submit"]:has-text("Sign")');
    
    const emailInputExists = await emailInput.count() > 0;
    const passwordInputExists = await passwordInput.count() > 0;
    const submitButtonExists = await submitButton.count() > 0;
    
    console.log('Email input exists:', emailInputExists);
    console.log('Password input exists:', passwordInputExists);
    console.log('Submit button exists:', submitButtonExists);
    
    if (!emailInputExists || !passwordInputExists || !submitButtonExists) {
      throw new Error('Login form elements not found on the page');
    }
    
    // Step 2: Fill in the login form
    console.log('\n=== Step 2: Fill in login form ===');
    const testEmail = 'testuser1771006217711@example.com';
    const testPassword = 'password123';
    
    await emailInput.first().fill(testEmail);
    console.log('Filled email:', testEmail);
    await page.screenshot({ 
      path: join(__dirname, 'login-page-email-filled.png'),
      fullPage: true 
    });
    
    await passwordInput.first().fill(testPassword);
    console.log('Filled password: ********');
    await page.screenshot({ 
      path: join(__dirname, 'login-page-form-filled.png'),
      fullPage: true 
    });
    
    // Step 3: Submit the form
    console.log('\n=== Step 3: Submit login form ===');
    
    // Wait for navigation after clicking submit
    const navigationPromise = page.waitForNavigation({ 
      waitUntil: 'networkidle',
      timeout: 30000 
    }).catch(err => {
      console.log('Navigation wait info:', err.message);
      return null;
    });
    
    await submitButton.first().click();
    console.log('Clicked submit button');
    
    // Wait a bit for the form submission
    await page.waitForTimeout(2000);
    
    await navigationPromise;
    
    // Step 4: Verify response
    console.log('\n=== Step 4: Verify login response ===');
    
    // Wait for any potential redirects or UI updates
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('Current URL after submission:', currentUrl);
    
    await page.screenshot({ 
      path: join(__dirname, 'login-page-after-submit.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: login-page-after-submit.png');
    
    // Check for actual error messages (not just any alert text)
    const errorSelectors = [
      '[role="alert"]:has-text("error")',
      '[role="alert"]:has-text("invalid")',
      '[role="alert"]:has-text("failed")',
      '.error-message',
      '.alert-error',
      '[class*="error"][class*="message"]'
    ];
    
    let actualErrors = [];
    for (const selector of errorSelectors) {
      const elements = await page.locator(selector).allTextContents();
      actualErrors = actualErrors.concat(elements);
    }
    
    console.log('Error messages found:', actualErrors.length > 0 ? actualErrors : 'None');
    
    // Check if redirected away from login page
    const isOnLoginPage = currentUrl.includes('/auth/login');
    const isRedirectedToHome = currentUrl.includes('/en') && !isOnLoginPage;
    
    console.log('Still on login page:', isOnLoginPage);
    console.log('Redirected to home page:', isRedirectedToHome);
    
    if (isRedirectedToHome) {
      console.log('SUCCESS: User was redirected to home page after login');
      await page.screenshot({ 
        path: join(__dirname, 'login-success-homepage.png'),
        fullPage: true 
      });
      console.log('Screenshot saved: login-success-homepage.png');
      
      // Check if homepage shows "Welcome to POD AI Store"
      const welcomeText = await page.locator('text=Welcome to POD AI Store').count();
      console.log('Homepage welcome message visible:', welcomeText > 0);
    }
    
    // Step 5: Check session cookies
    console.log('\n=== Step 5: Check session cookies ===');
    const cookies = await context.cookies();
    
    const accessToken = cookies.find(c => c.name === 'sb-access-token' || c.name.includes('access-token'));
    const refreshToken = cookies.find(c => c.name === 'sb-refresh-token' || c.name.includes('refresh-token'));
    
    console.log('All cookies found:', cookies.map(c => c.name).join(', '));
    console.log('Access token cookie exists:', !!accessToken);
    console.log('Refresh token cookie exists:', !!refreshToken);
    
    if (accessToken) {
      console.log('Access token details:', {
        name: accessToken.name,
        domain: accessToken.domain,
        path: accessToken.path,
        httpOnly: accessToken.httpOnly,
        secure: accessToken.secure
      });
    }
    
    if (refreshToken) {
      console.log('Refresh token details:', {
        name: refreshToken.name,
        domain: refreshToken.domain,
        path: refreshToken.path,
        httpOnly: refreshToken.httpOnly,
        secure: refreshToken.secure
      });
    }
    
    // Step 6: Check browser console
    console.log('\n=== Step 6: Browser console errors ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:');
      consoleErrors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    } else {
      console.log('No console errors detected');
    }
    
    // Final verification summary
    console.log('\n=== TEST SUMMARY ===');
    const testResults = {
      'Login page loaded successfully': emailInputExists && passwordInputExists && submitButtonExists,
      'Form filled and submitted': true,
      'No error messages displayed': actualErrors.length === 0,
      'Redirected to home page': isRedirectedToHome,
      'Session cookies set (access-token)': !!accessToken,
      'Session cookies set (refresh-token)': !!refreshToken,
      'No console errors': consoleErrors.length === 0
    };
    
    console.log('\n--- Test Results ---');
    for (const [test, passed] of Object.entries(testResults)) {
      console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${test}`);
    }
    
    const allTestsPassed = Object.values(testResults).every(result => result === true);
    
    if (allTestsPassed) {
      console.log('\n========================================');
      console.log('*** ALL TESTS PASSED ***');
      console.log('Feature #41: User can log in with email/password - WORKING');
      console.log('========================================');
    } else {
      console.log('\n========================================');
      console.log('*** SOME TESTS FAILED ***');
      console.log('========================================');
    }
    
    // Keep browser open for a moment to inspect
    await page.waitForTimeout(3000);
    
    return allTestsPassed;
    
  } catch (error) {
    console.error('\n!!! TEST FAILED WITH ERROR !!!');
    console.error(error.message);
    console.error(error.stack);
    
    // Take error screenshot
    try {
      await page.screenshot({ 
        path: join(__dirname, 'login-test-error.png'),
        fullPage: true 
      });
      console.log('Error screenshot saved: login-test-error.png');
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }
    
    return false;
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

testLoginFeature()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
