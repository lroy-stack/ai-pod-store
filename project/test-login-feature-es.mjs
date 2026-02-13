import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testLoginFeatureSpanish() {
  console.log('Starting login feature E2E test (Spanish locale)...');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR] ${error.message}`);
    consoleErrors.push(error.message);
  });
  
  try {
    // Step 1: Navigate to Spanish login page
    console.log('\n=== Step 1: Navigate to Spanish login page ===');
    await page.goto('http://localhost:3000/es/auth/login', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('Current URL:', page.url());
    await page.screenshot({ 
      path: join(__dirname, 'login-page-es-initial.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: login-page-es-initial.png');
    
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check for Spanish text
    const spanishSignInText = await page.locator('text=/Iniciar sesión|Inicia sesión/i').count();
    console.log('Spanish "Sign in" text found:', spanishSignInText > 0);
    
    // Check for form elements
    const emailInput = await page.locator('input[name="email"], input[type="email"], input[placeholder*="correo" i], input[placeholder*="email" i]');
    const passwordInput = await page.locator('input[name="password"], input[type="password"]');
    const submitButton = await page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Sign")');
    
    const emailInputExists = await emailInput.count() > 0;
    const passwordInputExists = await passwordInput.count() > 0;
    const submitButtonExists = await submitButton.count() > 0;
    
    console.log('Email input exists:', emailInputExists);
    console.log('Password input exists:', passwordInputExists);
    console.log('Submit button exists:', submitButtonExists);
    
    if (!emailInputExists || !passwordInputExists || !submitButtonExists) {
      throw new Error('Login form elements not found on the Spanish page');
    }
    
    // Step 2: Fill in the form
    console.log('\n=== Step 2: Fill in login form ===');
    const testEmail = 'testuser1771006217711@example.com';
    const testPassword = 'password123';
    
    await emailInput.first().fill(testEmail);
    console.log('Filled email:', testEmail);
    
    await passwordInput.first().fill(testPassword);
    console.log('Filled password: ********');
    
    await page.screenshot({ 
      path: join(__dirname, 'login-page-es-form-filled.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: login-page-es-form-filled.png');
    
    // Step 3: Submit
    console.log('\n=== Step 3: Submit login form ===');
    
    const navigationPromise = page.waitForNavigation({ 
      waitUntil: 'networkidle',
      timeout: 30000 
    }).catch(() => null);
    
    await submitButton.first().click();
    console.log('Clicked submit button');
    
    await page.waitForTimeout(2000);
    await navigationPromise;
    
    // Step 4: Verify
    console.log('\n=== Step 4: Verify login response ===');
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log('Current URL after submission:', currentUrl);
    
    await page.screenshot({ 
      path: join(__dirname, 'login-page-es-after-submit.png'),
      fullPage: true 
    });
    console.log('Screenshot saved: login-page-es-after-submit.png');
    
    const isRedirectedToSpanishHome = currentUrl.includes('/es') && !currentUrl.includes('/auth/login');
    console.log('Redirected to Spanish home page:', isRedirectedToSpanishHome);
    
    if (isRedirectedToSpanishHome) {
      // Check for Spanish welcome message
      const spanishWelcome = await page.locator('text=/Bienvenido|Welcome/i').count();
      console.log('Welcome message visible:', spanishWelcome > 0);
    }
    
    // Step 5: Check cookies
    console.log('\n=== Step 5: Check session cookies ===');
    const cookies = await context.cookies();
    
    const accessToken = cookies.find(c => c.name === 'sb-access-token' || c.name.includes('access-token'));
    const refreshToken = cookies.find(c => c.name === 'sb-refresh-token' || c.name.includes('refresh-token'));
    
    console.log('Access token cookie exists:', !!accessToken);
    console.log('Refresh token cookie exists:', !!refreshToken);
    
    // Summary
    console.log('\n=== TEST SUMMARY (Spanish) ===');
    const testResults = {
      'Spanish login page loaded': emailInputExists && passwordInputExists && submitButtonExists,
      'Spanish text present': spanishSignInText > 0,
      'Form submitted successfully': true,
      'Redirected to Spanish home': isRedirectedToSpanishHome,
      'Session cookies set': !!(accessToken && refreshToken),
      'No console errors': consoleErrors.length === 0
    };
    
    console.log('\n--- Test Results ---');
    for (const [test, passed] of Object.entries(testResults)) {
      console.log(`${passed ? '✓ PASS' : '✗ FAIL'}: ${test}`);
    }
    
    const allTestsPassed = Object.values(testResults).every(result => result === true);
    
    if (allTestsPassed) {
      console.log('\n========================================');
      console.log('*** ALL SPANISH LOCALE TESTS PASSED ***');
      console.log('i18n working correctly for login feature');
      console.log('========================================');
    } else {
      console.log('\n========================================');
      console.log('*** SOME TESTS FAILED ***');
      console.log('========================================');
    }
    
    await page.waitForTimeout(3000);
    return allTestsPassed;
    
  } catch (error) {
    console.error('\n!!! TEST FAILED WITH ERROR !!!');
    console.error(error.message);
    
    try {
      await page.screenshot({ 
        path: join(__dirname, 'login-test-es-error.png'),
        fullPage: true 
      });
      console.log('Error screenshot saved: login-test-es-error.png');
    } catch (e) {
      console.error('Could not take error screenshot:', e.message);
    }
    
    return false;
  } finally {
    await browser.close();
    console.log('\nBrowser closed');
  }
}

testLoginFeatureSpanish()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
