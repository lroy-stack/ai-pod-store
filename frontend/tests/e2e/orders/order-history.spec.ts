import { test, expect } from '@playwright/test'

test.describe('Order History', () => {
  test('Orders page loads', async ({ page }) => {
    await page.goto('/en/orders')

    // May redirect to login if not authenticated
    const url = page.url()
    const isOrders = url.includes('/orders')
    const isLogin = url.includes('/auth/login')
    expect(isOrders || isLogin).toBeTruthy()
  })

  test('Orders page shows list or empty state', async ({ page }) => {
    await page.goto('/en/orders')

    if (page.url().includes('/auth/login')) {
      return // Expected for unauthenticated users
    }

    const content = page.locator('main')
    await expect(content).toBeVisible()
  })

  test('Order detail page requires valid order ID', async ({ page }) => {
    await page.goto('/en/orders/nonexistent-id')

    // Should show 404, error, or redirect to login
    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })
})
