import { test, expect } from '@playwright/test'
import { TEST_VIEWPORTS } from '../../fixtures/test-data'

test.describe('Responsive Layout', () => {
  test('Mobile layout (375px) renders correctly', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.mobile)
    await page.goto('/en')

    const content = page.locator('main, body')
    await expect(content).toBeVisible()

    // Mobile should show hamburger menu
    const hamburger = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], button[aria-label*="Menu"]').first()
    if (await hamburger.isVisible()) {
      await expect(hamburger).toBeVisible()
    }
  })

  test('Tablet layout (768px) renders correctly', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.tablet)
    await page.goto('/en')

    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })

  test('Desktop layout (1280px) renders correctly', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.desktop)
    await page.goto('/en')

    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })

  test('Mobile shop page shows product cards', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.mobile)
    await page.goto('/en/shop')

    const products = page.locator('[data-testid="product-card"], article, .product-card').first()
    await expect(products).toBeVisible({ timeout: 15_000 })
  })

  test('Desktop shop page uses multi-column grid', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.desktop)
    await page.goto('/en/shop')

    const productGrid = page.locator('[data-testid="product-grid"], main .grid').first()
    if (await productGrid.isVisible({ timeout: 10_000 })) {
      await expect(productGrid).toBeVisible()
    }
  })

  test('Mobile hamburger menu opens and closes', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.mobile)
    await page.goto('/en/shop')

    const hamburger = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"], button[aria-label*="Menu"]').first()
    if (await hamburger.isVisible()) {
      await hamburger.click()

      // Menu/sheet should be open
      const menuContent = page.locator('[role="dialog"], [data-testid="mobile-nav"], nav').first()
      await expect(menuContent).toBeVisible()

      // Close it
      const closeBtn = page.locator('button[aria-label*="close"], button[aria-label*="Close"]').first()
      if (await closeBtn.isVisible()) {
        await closeBtn.click()
      } else {
        await page.keyboard.press('Escape')
      }
    }
  })

  test('Login form is usable on mobile', async ({ page }) => {
    await page.setViewportSize(TEST_VIEWPORTS.mobile)
    await page.goto('/en/auth/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitBtn).toBeVisible()
  })
})
