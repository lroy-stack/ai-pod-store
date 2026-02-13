const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n=== Testing Feature #14: Locale Routing ===\n');

  // Test 1: English locale (/en)
  console.log('1. Testing /en (English)...');
  await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const enContent = await page.textContent('body');
  console.log('   - Page loaded successfully');
  console.log('   - Body text preview:', enContent.substring(0, 200).replace(/\s+/g, ' '));
  
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot-en.png', fullPage: true });
  console.log('   - Screenshot saved: screenshot-en.png');

  // Test 2: Spanish locale (/es)
  console.log('\n2. Testing /es (Spanish)...');
  await page.goto('http://localhost:3000/es', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const esContent = await page.textContent('body');
  console.log('   - Page loaded successfully');
  console.log('   - Body text preview:', esContent.substring(0, 200).replace(/\s+/g, ' '));
  
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot-es.png', fullPage: true });
  console.log('   - Screenshot saved: screenshot-es.png');

  // Test 3: German locale (/de)
  console.log('\n3. Testing /de (German)...');
  await page.goto('http://localhost:3000/de', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  const deContent = await page.textContent('body');
  console.log('   - Page loaded successfully');
  console.log('   - Body text preview:', deContent.substring(0, 200).replace(/\s+/g, ' '));
  
  await page.screenshot({ path: '/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/screenshot-de.png', fullPage: true });
  console.log('   - Screenshot saved: screenshot-de.png');

  // Verify content is different between locales
  console.log('\n=== Content Verification ===');
  const enEs = enContent === esContent;
  const enDe = enContent === deContent;
  const esDe = esContent === deContent;
  
  console.log('   - English vs Spanish content same?', enEs, enEs ? 'FAIL' : 'PASS');
  console.log('   - English vs German content same?', enDe, enDe ? 'FAIL' : 'PASS');
  console.log('   - Spanish vs German content same?', esDe, esDe ? 'FAIL' : 'PASS');

  // Look for specific locale indicators
  console.log('\n=== Language-Specific Text Detection ===');
  
  const hasEnglish = /\b(the|and|is|are|this|that|welcome|about|contact)\b/i.test(enContent);
  console.log('   - English page has English words?', hasEnglish ? 'PASS' : 'FAIL');
  
  const hasSpanish = /\b(el|la|los|las|y|es|son|este|esta|bienvenido|sobre|contacto)\b/i.test(esContent);
  console.log('   - Spanish page has Spanish words?', hasSpanish ? 'PASS' : 'FAIL');
  
  const hasGerman = /\b(der|die|das|und|ist|sind|dieser|diese|willkommen|über|kontakt)\b/i.test(deContent);
  console.log('   - German page has German words?', hasGerman ? 'PASS' : 'FAIL');

  console.log('\n=== Test Complete ===\n');

  await browser.close();
})();
