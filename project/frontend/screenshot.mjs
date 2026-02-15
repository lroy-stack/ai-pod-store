import { chromium } from 'playwright';

async function takeScreenshot() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3000/en/', { waitUntil: 'networkidle' });
  await page.screenshot({ 
    path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/frontend/homepage-screenshot.png',
    fullPage: true 
  });
  
  await browser.close();
  console.log('Screenshot saved to homepage-screenshot.png');
}

takeScreenshot().catch(console.error);
