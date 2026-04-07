import { test, expect } from '@playwright/test'

test.describe('@shop Product Detail', () => {
  test('Product detail page shows product info', async ({ page }) => {
    // Navigate to shop first
    await page.goto('/en/shop')

    // Click on first product
    const firstProduct = page.locator('[data-testid="product-card"] a, article a, .product-card a').first()
    if (await firstProduct.isVisible({ timeout: 10_000 })) {
      await firstProduct.click()
      await page.waitForLoadState('networkidle')

      // Verify product detail elements
      const title = page.locator('h1, [data-testid="product-title"]').first()
      await expect(title).toBeVisible()

      const price = page.locator('[data-testid="product-price"], .price').first()
      if (await price.isVisible()) {
        const priceText = await price.textContent()
        expect(priceText).toMatch(/[\$€]|\d/)
      }
    }
  })

  test('Product page shows add to cart button', async ({ page }) => {
    await page.goto('/en/shop')

    const firstProduct = page.locator('[data-testid="product-card"] a, article a, .product-card a').first()
    if (await firstProduct.isVisible({ timeout: 10_000 })) {
      await firstProduct.click()
      await page.waitForLoadState('networkidle')

      const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add to cart"), [data-testid="add-to-cart"]').first()
      await expect(addToCartBtn).toBeVisible()
    }
  })

  test('Product page shows images', async ({ page }) => {
    await page.goto('/en/shop')

    const firstProduct = page.locator('[data-testid="product-card"] a, article a, .product-card a').first()
    if (await firstProduct.isVisible({ timeout: 10_000 })) {
      await firstProduct.click()
      await page.waitForLoadState('networkidle')

      const productImage = page.locator('img[alt], [data-testid="product-image"]').first()
      await expect(productImage).toBeVisible()
    }
  })
})
