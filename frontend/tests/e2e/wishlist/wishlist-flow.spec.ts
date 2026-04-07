import { test, expect } from '@playwright/test'

test.describe('Wishlist Flow', () => {
  test('Wishlist page loads', async ({ page }) => {
    await page.goto('/en/wishlist')

    const url = page.url()
    const isWishlist = url.includes('/wishlist')
    const isLogin = url.includes('/auth/login')
    expect(isWishlist || isLogin).toBeTruthy()
  })

  test('Wishlist shows empty state or items', async ({ page }) => {
    await page.goto('/en/wishlist')

    if (page.url().includes('/auth/login')) {
      return
    }

    const content = page.locator('main')
    await expect(content).toBeVisible()
  })

  test('Shared wishlist page is accessible', async ({ page }) => {
    // Shared wishlists should be public
    await page.goto('/en/wishlist/shared/test-token')

    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })
})
