import { test, chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';

test('Homepage screenshot and Lighthouse audit', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/en/...');
  await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for the page to be fully loaded
  await page.waitForTimeout(2000);
  
  console.log('Taking screenshot...');
  await page.screenshot({ path: '/tmp/homepage-screenshot.png', fullPage: true });
  console.log('Screenshot saved to /tmp/homepage-screenshot.png');
  
  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  await browser.close();
});
