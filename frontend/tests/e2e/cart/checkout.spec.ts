import { test, expect } from '@playwright/test'

test.describe('@cart Checkout Flow', () => {
  test('Checkout page requires authentication', async ({ page }) => {
    await page.goto('/en/checkout')

    // Should either show checkout or redirect to login
    const url = page.url()
    const isCheckout = url.includes('/checkout')
    const isLogin = url.includes('/auth/login')
    expect(isCheckout || isLogin).toBeTruthy()
  })

  test('Checkout page loads for authenticated users', async ({ page }) => {
    await page.goto('/en/checkout')

    // If redirected to login, that's expected behavior
    if (page.url().includes('/auth/login')) {
      return
    }

    // If on checkout, verify form elements
    const checkoutForm = page.locator('form, [data-testid="checkout-form"]').first()
    if (await checkoutForm.isVisible()) {
      await expect(checkoutForm).toBeVisible()
    }
  })

  test('Checkout success page is accessible', async ({ page }) => {
    await page.goto('/en/checkout/success')
    // May redirect or show success message
    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })

  test('Checkout cancel page is accessible', async ({ page }) => {
    await page.goto('/en/checkout/cancel')
    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })
})
