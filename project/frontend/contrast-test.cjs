const puppeteer = require('puppeteer');

// Function to convert RGB to relative luminance
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Function to calculate contrast ratio
function getContrastRatio(rgb1, rgb2) {
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Function to parse RGB string to object
function parseRGB(rgbString) {
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
}

// Function to parse hex color to RGB object
function hexToRGB(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testContrast(page, mode) {
  console.log(`\n=== ${mode.toUpperCase()} MODE CONTRAST RATIOS ===\n`);

  // Test 1: Primary text on background
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  
  const bodyColor = await page.evaluate(() => {
    return window.getComputedStyle(document.body).color;
  });

  const bodyBgRGB = parseRGB(bodyBg);
  const bodyColorRGB = parseRGB(bodyColor);
  
  if (bodyBgRGB && bodyColorRGB) {
    const ratio = getContrastRatio(bodyBgRGB, bodyColorRGB);
    console.log(`1. Primary text on background:`);
    console.log(`   Foreground: ${bodyColor}`);
    console.log(`   Background: ${bodyBg}`);
    console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
    console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
    console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
  }

  // Test 2: Primary text on card
  const cardElement = await page.evaluate(() => {
    const card = document.querySelector('[class*="card"]');
    if (!card) return null;
    const styles = window.getComputedStyle(card);
    return {
      bg: styles.backgroundColor,
      color: styles.color
    };
  });

  if (cardElement && cardElement.bg && cardElement.color) {
    const cardBgRGB = parseRGB(cardElement.bg);
    const cardColorRGB = parseRGB(cardElement.color);
    
    if (cardBgRGB && cardColorRGB) {
      const ratio = getContrastRatio(cardBgRGB, cardColorRGB);
      console.log(`2. Primary text on card:`);
      console.log(`   Foreground: ${cardElement.color}`);
      console.log(`   Background: ${cardElement.bg}`);
      console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
      console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
      console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
    }
  } else {
    console.log(`2. Primary text on card: No card element found\n`);
  }

  // Test 3: Muted text on background
  const mutedElement = await page.evaluate(() => {
    const muted = document.querySelector('.text-muted-foreground, [class*="text-muted"]');
    if (!muted) return null;
    const styles = window.getComputedStyle(muted);
    let bg = styles.backgroundColor;
    
    // Walk up the DOM tree to find a non-transparent background
    let currentEl = muted;
    while (currentEl && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      currentEl = currentEl.parentElement;
      if (currentEl) {
        bg = window.getComputedStyle(currentEl).backgroundColor;
      }
    }
    
    return {
      color: styles.color,
      bg: bg
    };
  });

  if (mutedElement && mutedElement.bg && mutedElement.color) {
    const mutedBgRGB = parseRGB(mutedElement.bg);
    const mutedColorRGB = parseRGB(mutedElement.color);
    
    if (mutedBgRGB && mutedColorRGB) {
      const ratio = getContrastRatio(mutedBgRGB, mutedColorRGB);
      console.log(`3. Muted text on background:`);
      console.log(`   Foreground: ${mutedElement.color}`);
      console.log(`   Background: ${mutedElement.bg}`);
      console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
      console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
      console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
    }
  } else {
    console.log(`3. Muted text on background: No muted text element found\n`);
  }

  // Test 4: Primary button
  const buttonElement = await page.evaluate(() => {
    const button = document.querySelector('button.bg-primary, button:not([class*="outline"]):not([class*="ghost"]):not([class*="variant"])');
    if (!button) return null;
    const styles = window.getComputedStyle(button);
    return {
      bg: styles.backgroundColor,
      color: styles.color
    };
  });

  if (buttonElement && buttonElement.bg && buttonElement.color) {
    const btnBgRGB = parseRGB(buttonElement.bg);
    const btnColorRGB = parseRGB(buttonElement.color);
    
    if (btnBgRGB && btnColorRGB) {
      const ratio = getContrastRatio(btnBgRGB, btnColorRGB);
      console.log(`4. Primary button:`);
      console.log(`   Foreground: ${buttonElement.color}`);
      console.log(`   Background: ${buttonElement.bg}`);
      console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
      console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
      console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
    }
  } else {
    console.log(`4. Primary button: No primary button found\n`);
  }

  // Also test the specified color pairs from globals.css
  console.log(`\n--- CSS Variable Tests (Expected Values) ---\n`);
  
  if (mode === 'light') {
    // Light mode expected colors
    const tests = [
      { name: 'foreground on background', fg: '#1d1d1f', bg: '#fafafa' },
      { name: 'card-foreground on card', fg: '#1d1d1f', bg: '#ffffff' },
      { name: 'muted-foreground on background', fg: '#86868b', bg: '#fafafa' },
      { name: 'primary-foreground on primary', fg: '#ffffff', bg: '#0071e3' }
    ];

    tests.forEach(test => {
      const fgRGB = hexToRGB(test.fg);
      const bgRGB = hexToRGB(test.bg);
      if (fgRGB && bgRGB) {
        const ratio = getContrastRatio(fgRGB, bgRGB);
        console.log(`${test.name}:`);
        console.log(`   Foreground: ${test.fg}`);
        console.log(`   Background: ${test.bg}`);
        console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
        console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
        console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
      }
    });
  } else {
    // Dark mode expected colors
    const tests = [
      { name: 'foreground on background', fg: '#f5f5f7', bg: '#0a0a0b' },
      { name: 'card-foreground on card', fg: '#f5f5f7', bg: '#1c1c1e' },
      { name: 'muted-foreground on background', fg: '#98989d', bg: '#0a0a0b' }
    ];

    tests.forEach(test => {
      const fgRGB = hexToRGB(test.fg);
      const bgRGB = hexToRGB(test.bg);
      if (fgRGB && bgRGB) {
        const ratio = getContrastRatio(fgRGB, bgRGB);
        console.log(`${test.name}:`);
        console.log(`   Foreground: ${test.fg}`);
        console.log(`   Background: ${test.bg}`);
        console.log(`   Contrast Ratio: ${ratio.toFixed(2)}:1`);
        console.log(`   WCAG AA (4.5:1): ${ratio >= 4.5 ? 'PASS ✓' : 'FAIL ✗'}`);
        console.log(`   WCAG AAA (7:1): ${ratio >= 7 ? 'PASS ✓' : 'FAIL ✗'}\n`);
      }
    });
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Test Light Mode
  await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle0' });
  await sleep(2000);

  // Force light mode by removing dark class
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await sleep(500);

  await testContrast(page, 'light');
  await page.screenshot({ path: '/tmp/contrast-test-light.png', fullPage: true });

  // Test Dark Mode
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  await sleep(500);

  await testContrast(page, 'dark');
  await page.screenshot({ path: '/tmp/contrast-test-dark.png', fullPage: true });

  console.log('\n=== SUMMARY ===\n');
  console.log('Screenshots saved:');
  console.log('  - Light mode: /tmp/contrast-test-light.png');
  console.log('  - Dark mode: /tmp/contrast-test-dark.png\n');

  await browser.close();
})();
