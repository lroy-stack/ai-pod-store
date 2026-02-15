import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'fs';

async function runLighthouse() {
  // Launch browser with remote debugging
  const browser = await chromium.launch({
    args: ['--remote-debugging-port=9222', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const options = {
      port: 9222,
      output: ['json', 'html'],
      onlyCategories: ['performance'],
    };

    const runnerResult = await lighthouse('http://localhost:3000/en/', options);
    
    const { lhr } = runnerResult;
    const performanceScore = Math.round(lhr.categories.performance.score * 100);
    const metrics = lhr.audits.metrics.details.items[0];

    const report = {
      performanceScore: performanceScore,
      firstContentfulPaint: metrics.firstContentfulPaint,
      largestContentfulPaint: metrics.largestContentfulPaint,
      totalBlockingTime: metrics.totalBlockingTime,
      cumulativeLayoutShift: metrics.cumulativeLayoutShift,
      speedIndex: metrics.speedIndex,
      interactive: metrics.interactive,
      passed: performanceScore >= 80
    };

    console.log(JSON.stringify(report, null, 2));
    writeFileSync('/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/frontend/lighthouse-results.json', JSON.stringify(lhr, null, 2));
    writeFileSync('/Users/lr0y/POD-AI-PDR/pod-agent-harness/pod_workspace/project/frontend/lighthouse-report.html', runnerResult.report[1]);
  } finally {
    await browser.close();
  }
}

runLighthouse().catch(console.error);
