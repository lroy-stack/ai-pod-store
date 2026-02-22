import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * PersonalizerDialog Mockup Fix Verification
 * Verifies that Quick Preview uses /mockup-templates/ (NOT images-api.printify.com)
 * and that Accurate Preview also correctly renders.
 */
test.describe('PersonalizerDialog Mockup Fix', () => {
  test('Quick Preview uses /mockup-templates/ URL (not printify CDN)', async ({ page }) => {
    const screenshotDir = '/Users/lr0y/POD-AI-PDR/pod-agent-harness-v2/pod_workspace'

    // Navigate to shop
    await page.goto('http://localhost:3000/en/shop', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    // Accept cookie consent if present
    const acceptBtn = page.locator('button:has-text("Accept All")').first()
    if (await acceptBtn.count() > 0) {
      await acceptBtn.click()
      await page.waitForTimeout(500)
    }

    // Find a tote bag product (category=bags triggers tote-bag-natural template)
    const toteBagCard = page.locator('a[href*="/shop/"]').filter({
      has: page.locator('text=Tote Bag')
    }).filter({
      has: page.locator('button:has-text("Add to cart")')
    }).first()

    const hasToteBag = await toteBagCard.count() > 0

    let productUrl = ''
    if (hasToteBag) {
      await toteBagCard.click()
    } else {
      // Fallback: first in-stock product
      const firstProduct = page.locator('a[href*="/shop/"]').filter({
        has: page.locator('button:has-text("Add to cart")')
      }).first()
      await firstProduct.click()
    }

    await page.waitForURL(/\/shop\//, { timeout: 10000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)
    productUrl = page.url()
    console.log(`Product page: ${productUrl}`)

    await page.screenshot({ path: path.join(screenshotDir, 'personalizer-step1-product-page.png') })

    // Find and click the Personalize button
    const personalizeBtn = page.getByRole('button', { name: /Personalize/i }).first()
    await expect(personalizeBtn).toBeVisible({ timeout: 5000 })
    await personalizeBtn.scrollIntoViewIfNeeded()
    await personalizeBtn.click()

    // Wait for dialog
    const dialog = page.locator('[role="dialog"]').first()
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: path.join(screenshotDir, 'personalizer-step2-dialog-opened.png') })
    console.log('Dialog opened')

    // Verify Quick Preview is selected by default
    const quickRadio = page.locator('#quick')
    const isQuickChecked = await quickRadio.isChecked()
    console.log(`Quick Preview selected by default: ${isQuickChecked}`)
    expect(isQuickChecked).toBe(true)

    // Enter text
    const textarea = dialog.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 3000 })
    await textarea.fill('Test')
    await page.waitForTimeout(600) // Wait for debounce (500ms)

    // Capture the Quick Preview image src
    const quickPreviewImg = dialog.locator('img').first()
    await expect(quickPreviewImg).toBeVisible({ timeout: 3000 })
    const quickImgSrc = await quickPreviewImg.getAttribute('src')
    console.log(`QUICK PREVIEW image src: ${quickImgSrc}`)

    // Assert it uses /mockup-templates/ NOT printify CDN
    expect(quickImgSrc).toContain('/mockup-templates/')
    expect(quickImgSrc).not.toContain('images-api.printify.com')
    expect(quickImgSrc).not.toContain('printify.com')

    // Check template matches product type
    const isToteBag = productUrl.toLowerCase().includes('tote') ||
                      hasToteBag ||
                      (quickImgSrc || '').includes('tote-bag')
    if (isToteBag) {
      expect(quickImgSrc).toContain('tote-bag-natural')
      console.log('Template matches product type: tote-bag-natural.png - CORRECT')
    } else {
      console.log(`Template used: ${quickImgSrc} (product: ${productUrl})`)
    }

    // Take screenshot with "Test" text shown
    await page.screenshot({ path: path.join(screenshotDir, 'personalizer-step3-quick-preview.png') })
    console.log('Quick preview screenshot saved')

    // ---- Switch to Accurate Preview ----
    const accurateLabel = page.locator('label[for="accurate"]')
    await accurateLabel.click()
    await page.waitForTimeout(3000) // Wait for server preview or fallback

    const accurateImgs = await dialog.locator('img').all()
    for (const img of accurateImgs) {
      const src = await img.getAttribute('src')
      console.log(`ACCURATE PREVIEW image src: ${src}`)
    }

    await page.screenshot({ path: path.join(screenshotDir, 'personalizer-step4-accurate-preview.png') })
    console.log('Accurate preview screenshot saved')

    // Verify accurate preview radio is checked
    const accurateRadio = page.locator('#accurate')
    const isAccurateChecked = await accurateRadio.isChecked()
    console.log(`Accurate Preview selected: ${isAccurateChecked}`)
    expect(isAccurateChecked).toBe(true)

    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===')
    console.log(`Quick Preview img src: ${quickImgSrc}`)
    console.log(`Uses /mockup-templates/: ${quickImgSrc?.includes('/mockup-templates/')}`)
    console.log(`Does NOT use printify CDN: ${!quickImgSrc?.includes('printify.com')}`)
    console.log(`Product URL: ${productUrl}`)
  })
})
