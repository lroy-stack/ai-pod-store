import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import fs from 'fs';

const url = 'http://localhost:3000/en/';

(async () => {
  console.log('Launching browser...');
  const browser = await chromium.launch({
    args: ['--remote-debugging-port=9222', '--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle' });
  
  console.log('Running Lighthouse audit...');
  const { lhr } = await lighthouse(url, {
    port: 9222,
    output: ['json', 'html'],
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  });

  // Save reports
  fs.writeFileSync('/tmp/lighthouse-report.json', JSON.stringify(lhr, null, 2));
  console.log('Report saved to /tmp/lighthouse-report.json');

  // Print scores
  console.log('\n=== LIGHTHOUSE SCORES ===');
  console.log('Performance:', Math.round(lhr.categories.performance.score * 100));
  console.log('Accessibility:', Math.round(lhr.categories.accessibility.score * 100));
  console.log('Best Practices:', Math.round(lhr.categories['best-practices'].score * 100));
  console.log('SEO:', Math.round(lhr.categories.seo.score * 100));

  // Print key metrics
  console.log('\n=== CORE WEB VITALS ===');
  console.log('First Contentful Paint:', lhr.audits['first-contentful-paint'].displayValue);
  console.log('Largest Contentful Paint:', lhr.audits['largest-contentful-paint'].displayValue);
  console.log('Total Blocking Time:', lhr.audits['total-blocking-time'].displayValue);
  console.log('Cumulative Layout Shift:', lhr.audits['cumulative-layout-shift'].displayValue);
  console.log('Speed Index:', lhr.audits['speed-index'].displayValue);

  // Print opportunities
  console.log('\n=== TOP PERFORMANCE OPPORTUNITIES ===');
  const opportunities = Object.values(lhr.audits)
    .filter(audit => audit.details?.type === 'opportunity' && audit.numericValue > 0)
    .sort((a, b) => b.numericValue - a.numericValue)
    .slice(0, 5);

  opportunities.forEach(audit => {
    console.log(`- ${audit.title}`);
    console.log(`  Potential savings: ${audit.displayValue || 'N/A'}`);
  });

  await browser.close();
  console.log('\nAudit complete!');
})();
