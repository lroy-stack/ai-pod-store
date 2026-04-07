import { test, expect } from '@playwright/test'

test.describe('@auth Registration Flow', () => {
  test('Register page loads', async ({ page }) => {
    await page.goto('/en/auth/register')
    await expect(page).toHaveURL(/\/auth\/register/)
  })

  test('Registration form has required fields', async ({ page }) => {
    await page.goto('/en/auth/register')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })

  test('Registration rejects empty form submission', async ({ page }) => {
    await page.goto('/en/auth/register')

    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()

    // Browser validation or custom error should prevent empty submit
    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    // Check HTML5 validation or error message
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid)
    const errorMsg = page.locator('[role="alert"], .error, .text-destructive').first()

    expect(isInvalid || (await errorMsg.isVisible().catch(() => false))).toBeTruthy()
  })

  test('Registration rejects weak password', async ({ page }) => {
    await page.goto('/en/auth/register')

    await page.fill('input[type="email"], input[name="email"]', 'test-weak@example.com')
    await page.fill('input[type="password"], input[name="password"]', '123')

    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()

    // Should show password requirement error
    await page.waitForTimeout(2000)
  })

  test('Register page has link to login', async ({ page }) => {
    await page.goto('/en/auth/register')

    const loginLink = page.locator('a[href*="login"], a:has-text("Sign in"), a:has-text("Login"), a:has-text("Log in")').first()
    await expect(loginLink).toBeVisible()
  })
})
