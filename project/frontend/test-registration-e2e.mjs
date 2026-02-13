import { chromium } from 'playwright';

async function testRegistration() {
  const timestamp = Date.now();
  const testEmail = `testuser${timestamp}@example.com`;
  
  console.log('Starting registration E2E test...');
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
    // Step 1: Navigate to registration page
    console.log('\n1. Navigating to registration page...');
    await page.goto('http://localhost:3000/en/auth/register', { waitUntil: 'networkidle' });
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
    await nameInput.fill('Test User');
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
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-form-filled.png', fullPage: true });
    console.log('   ✓ Screenshot saved: registration-form-filled.png');
    
    // Step 3: Submit the form
    console.log('\n3. Submitting form...');
    const submitButton = await page.locator('button[type="submit"]').first();
    const submitButtonText = await submitButton.textContent();
    console.log('   Submit button text:', submitButtonText);
    
    await submitButton.click();
    console.log('   ✓ Form submitted');
    
    // Wait for response (either success or error)
    await page.waitForTimeout(2000);
    
    // Step 4: Verify the response
    console.log('\n4. Verifying response...');
    
    // Check for success message (look for the specific success text)
    const successMessageCount = await page.locator('text="Registration successful!"').count();
    const hasSuccessMessage = successMessageCount > 0;
    console.log('   Success message present:', hasSuccessMessage);
    
    if (hasSuccessMessage) {
      const successText = await page.locator('text="Registration successful!"').first().textContent();
      console.log('   Success message text:', successText);
    }
    
    // Check for error alerts (more specific - looking for actual error UI elements)
    const errorAlertCount = await page.locator('[role="alert"][class*="error"], [class*="alert-error"], .error-message').count();
    const hasErrorMessage = errorAlertCount > 0;
    console.log('   Error alert present:', hasErrorMessage);
    
    // Check if form is disabled
    const submitButtonDisabled = await submitButton.isDisabled().catch(() => false);
    console.log('   Submit button disabled:', submitButtonDisabled);
    
    // Check if any input is disabled
    const nameInputDisabled = await nameInput.isDisabled().catch(() => false);
    console.log('   Form inputs disabled:', nameInputDisabled);
    
    // Step 5: Take screenshot of success state
    console.log('\n5. Taking screenshot of final state...');
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-success-state.png', fullPage: true });
    console.log('   ✓ Screenshot saved: registration-success-state.png');
    
    // Step 6: Check for console errors
    console.log('\n6. Console errors detected:');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach(err => console.log('   ⚠', err));
    } else {
      console.log('   ✓ No console errors');
    }
    
    // Final summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Test email:', testEmail);
    console.log('Success message:', hasSuccessMessage ? '✓ PASS' : '✗ FAIL');
    console.log('No error messages:', !hasErrorMessage ? '✓ PASS' : '✗ FAIL');
    console.log('Form disabled:', submitButtonDisabled || nameInputDisabled ? '✓ PASS' : '⚠ WARNING');
    console.log('No console errors:', consoleErrors.length === 0 ? '✓ PASS' : '⚠ WARNING');
    
    const allPassed = hasSuccessMessage && !hasErrorMessage;
    console.log('\nOverall result:', allPassed ? '✓ TEST PASSED' : '✗ TEST FAILED');
    
    await browser.close();
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n✗ Test error:', error.message);
    await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/registration-error-state.png', fullPage: true });
    console.log('Error screenshot saved: registration-error-state.png');
    await browser.close();
    process.exit(1);
  }
}

testRegistration();
