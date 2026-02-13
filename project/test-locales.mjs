import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

const locales = [
  { code: 'en', expectedText: 'Welcome to POD AI Store', name: 'English' },
  { code: 'es', expectedText: 'Bienvenido a la Tienda POD AI', name: 'Spanish' },
  { code: 'de', expectedText: 'Willkommen im POD AI Store', name: 'German' }
];

for (const locale of locales) {
  console.log(`--- Testing ${locale.name} (/${locale.code}) ---`);
  try {
    await page.goto(`http://localhost:3000/${locale.code}`, { waitUntil: 'networkidle', timeout: 10000 });
    const langAttr = await page.evaluate(() => document.documentElement.lang);
    console.log(`HTML lang attribute: ${langAttr}`);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const hasExpectedText = bodyText.includes(locale.expectedText);
    console.log(`Expected text "${locale.expectedText}": ${hasExpectedText ? 'FOUND' : 'NOT FOUND'}`);
    await page.screenshot({ path: `locale-${locale.code}.png` });
    console.log(`Screenshot saved: locale-${locale.code}.png`);
    const langMatches = langAttr === locale.code;
    console.log(`Lang attribute matches locale: ${langMatches ? 'YES' : 'NO'}`);
    console.log(`Page text preview: ${bodyText.substring(0, 500).trim()}`);
    console.log('');
  } catch (error) {
    console.error(`Error testing ${locale.name}: ${error.message}`);
  }
}

await browser.close();
console.log('--- All locale tests completed ---');
