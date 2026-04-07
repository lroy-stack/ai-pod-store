import { test, expect } from '@playwright/test'

test.describe('@auth Password Reset Flow', () => {
  test('Forgot password page loads', async ({ page }) => {
    await page.goto('/en/auth/forgot-password')
    await expect(page).toHaveURL(/\/auth\/forgot-password/)
  })

  test('Forgot password form has email field', async ({ page }) => {
    await page.goto('/en/auth/forgot-password')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await expect(emailInput).toBeVisible()
  })

  test('Forgot password rejects invalid email', async ({ page }) => {
    await page.goto('/en/auth/forgot-password')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    await emailInput.fill('not-an-email')

    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()

    // HTML5 validation should catch this
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    expect(isInvalid).toBeTruthy()
  })

  test('Reset password page loads', async ({ page }) => {
    await page.goto('/en/auth/reset-password')
    // Page may require a token parameter
    const content = page.locator('main, body')
    await expect(content).toBeVisible()
  })
})
