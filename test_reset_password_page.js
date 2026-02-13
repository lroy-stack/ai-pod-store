const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    console.log('Navigating to reset password page...');
    await page.goto('http://localhost:3000/en/auth/reset-password', {
      waitUntil: 'networkidle2',
      timeout: 10000
    });
    
    console.log('Page loaded, taking screenshot...');
    await page.screenshot({
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_reset_password_page.png',
      fullPage: true
    });
    
    // Check for key elements on the page
    console.log('\nChecking page elements...');
    
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check for form elements
    const hasPasswordInput = await page.$('input[type="password"]') !== null;
    console.log('Password input present:', hasPasswordInput);
    
    const hasSubmitButton = await page.$('button[type="submit"]') !== null;
    console.log('Submit button present:', hasSubmitButton);
    
    // Get page heading
    const heading = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      return h1 ? h1.textContent : (h2 ? h2.textContent : 'No heading found');
    });
    console.log('Page heading:', heading);
    
    // Get all input fields
    const inputs = await page.evaluate(() => {
      const inputElements = Array.from(document.querySelectorAll('input'));
      return inputElements.map(input => ({
        type: input.type,
        name: input.name,
        placeholder: input.placeholder,
        id: input.id
      }));
    });
    console.log('Input fields:', JSON.stringify(inputs, null, 2));
    
    // Get button text
    const buttonText = await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      return button ? button.textContent : 'No button found';
    });
    console.log('Button text:', buttonText);
    
    console.log('\nScreenshot saved successfully!');
    
  } catch (error) {
    console.error('Error:', error.message);
    await page.screenshot({
      path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot_reset_password_error.png'
    });
  } finally {
    await browser.close();
  }
})();
