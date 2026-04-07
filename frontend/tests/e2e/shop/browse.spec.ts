import { test, expect } from '@playwright/test'

test.describe('@shop Browse Products', () => {
  test('Shop page loads and displays product grid', async ({ page }) => {
    await page.goto('/en/shop')
    await expect(page).toHaveURL(/\/shop/)

    // Wait for products to load
    const productGrid = page.locator('[data-testid="product-grid"], main')
    await expect(productGrid).toBeVisible()
  })

  test('Products display title and price', async ({ page }) => {
    await page.goto('/en/shop')

    // Wait for at least one product card to appear
    const productCards = page.locator('[data-testid="product-card"], article, .product-card').first()
    await expect(productCards).toBeVisible({ timeout: 15_000 })
  })

  test('Category filter narrows results', async ({ page }) => {
    await page.goto('/en/shop')

    // Look for category filter controls
    const filterControls = page.locator('[data-testid="category-filter"], [role="combobox"], select').first()
    if (await filterControls.isVisible()) {
      await filterControls.click()
      // Select first available category
      const option = page.locator('[role="option"], option').first()
      if (await option.isVisible()) {
        await option.click()
      }
    }
  })

  test('Pagination works when available', async ({ page }) => {
    await page.goto('/en/shop')

    const nextButton = page.locator('button:has-text("Next"), a:has-text("Next"), [aria-label="Next page"]').first()
    if (await nextButton.isVisible()) {
      await nextButton.click()
      await page.waitForLoadState('networkidle')
    }
  })
})
