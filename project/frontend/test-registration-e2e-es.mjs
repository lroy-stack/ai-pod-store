import { chromium } from 'playwright';

async function testRegistrationSpanish() {
  const timestamp = Date.now();
  const testEmail = `testuser${timestamp}@example.com`;
  
  console.log('Starting registration E2E test (Spanish)...');
  console.log('Test email:', testEmail);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  try {
    // Step 1: Navigate to Spanish registration page
    console.log('\n1. Navigating to Spanish registration page...');
    await page.goto('http://localhost:3000/es/auth/register', { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    console.log('   ✓ Page loaded');
    
    // Verify the page loaded correctly
    const pageTitle = await page.title();
    console.log('   Page title:', pageTitle);
    
    // Step 2: Fill in the registration form
    console.log('\n2. Filling in registration form...');
    
    // Wait for form to be visible
    await page.waitForSelector('form', { timeout: 5000 });
    
    // Fill in name
    const nameInput = await page.locator('input[name="name"], input[id="name"]').first();
    await nameInput.fill('Usuario de Prueba');
    console.log('   ✓ Name filled');
    
    // Fill in email
    const emailInput = await page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.fill(testEmail);
    console.log('   ✓ Email filled');
    
    // Fill in password
    const passwordInput = await page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill('password123');
    console.log('   ✓ Password filled');
    
    // Fill in confirm password
    const confirmPasswordInput = await page.locator('input[name="confirmPassword"], input[name="confirm_password"]').first();
    await confirmPasswordInput.fill('password123');
    console.log('   ✓ Confirm password filled');
    
    // Check terms checkbox
    const termsCheckbox = await page.locator('input[type="checkbox"][name="terms"], input[type="checkbox"][id="terms"]').first();
    await termsCheckbox.check();
    console.log('   ✓ Terms checkbox checked');
    
    // Take screenshot before submission
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-form-filled-es.png', fullPage: true });
    console.log('   ✓ Screenshot saved: registration-form-filled-es.png');
    
    // Step 3: Submit the form
    console.log('\n3. Submitting form...');
    const submitButton = await page.locator('button[type="submit"]').first();
    const submitButtonText = await submitButton.textContent();
    console.log('   Submit button text:', submitButtonText);
    
    await submitButton.click();
    console.log('   ✓ Form submitted');
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Step 4: Verify the response
    console.log('\n4. Verifying response...');
    
    // Check for success message in Spanish
    const successMessageEs = await page.locator('text="¡Registro exitoso!"').count();
    const successMessageEn = await page.locator('text="Registration successful!"').count();
    const hasSuccessMessage = successMessageEs > 0 || successMessageEn > 0;
    console.log('   Success message present:', hasSuccessMessage);
    console.log('   Spanish success message:', successMessageEs > 0);
    console.log('   English success message:', successMessageEn > 0);
    
    // Check for error alerts
    const errorAlertCount = await page.locator('[role="alert"][class*="error"], [class*="alert-error"], .error-message').count();
    const hasErrorMessage = errorAlertCount > 0;
    console.log('   Error alert present:', hasErrorMessage);
    
    // Check if form is disabled
    const submitButtonDisabled = await submitButton.isDisabled().catch(() => false);
    console.log('   Submit button disabled:', submitButtonDisabled);
    
    // Step 5: Take screenshot of success state
    console.log('\n5. Taking screenshot of final state...');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-success-state-es.png', fullPage: true });
    console.log('   ✓ Screenshot saved: registration-success-state-es.png');
    
    // Step 6: Check for console errors
    console.log('\n6. Console errors detected:');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log('   ⚠', err));
    } else {
      console.log('   ✓ No console errors');
    }
    
    // Final summary
    console.log('\n=== TEST SUMMARY (Spanish) ===');
    console.log('Test email:', testEmail);
    console.log('Success message:', hasSuccessMessage ? '✓ PASS' : '✗ FAIL');
    console.log('No error messages:', !hasErrorMessage ? '✓ PASS' : '✗ FAIL');
    console.log('Form disabled:', submitButtonDisabled ? '✓ PASS' : '⚠ WARNING');
    console.log('No console errors:', consoleErrors.length === 0 ? '✓ PASS' : '⚠ WARNING');
    
    const allPassed = hasSuccessMessage && !hasErrorMessage;
    console.log('\nOverall result:', allPassed ? '✓ TEST PASSED' : '✗ TEST FAILED');
    
    await browser.close();
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n✗ Test error:', error.message);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-error-state-es.png', fullPage: true });
    console.log('Error screenshot saved: registration-error-state-es.png');
    await browser.close();
    process.exit(1);
  }
}

testRegistrationSpanish();
