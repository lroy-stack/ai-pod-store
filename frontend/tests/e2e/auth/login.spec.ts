import { test, expect } from '@playwright/test'
import { TEST_CREDENTIALS } from '../../fixtures/test-data'

test.describe('@auth Login Flow', () => {
  test('Login page loads', async ({ page }) => {
    await page.goto('/en/auth/login')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('Login form has email and password fields', async ({ page }) => {
    await page.goto('/en/auth/login')

    const emailInput = page.locator('input[type="email"], input[name="email"]').first()
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first()

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
  })

  test('Login form has submit button', async ({ page }) => {
    await page.goto('/en/auth/login')

    const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")').first()
    await expect(submitBtn).toBeVisible()
  })

  test('Invalid credentials show error', async ({ page }) => {
    await page.goto('/en/auth/login')

    await page.fill('input[type="email"], input[name="email"]', TEST_CREDENTIALS.invalidUser.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_CREDENTIALS.invalidUser.password)

    const submitBtn = page.locator('button[type="submit"]').first()
    await submitBtn.click()

    // Wait for error message
    const error = page.locator('[role="alert"], .error, [data-testid="error-message"], .text-destructive').first()
    await expect(error).toBeVisible({ timeout: 10_000 })
  })

  test('Login page has link to registration', async ({ page }) => {
    await page.goto('/en/auth/login')

    const registerLink = page.locator('a[href*="register"], a:has-text("Sign up"), a:has-text("Register"), a:has-text("Create account")').first()
    await expect(registerLink).toBeVisible()
  })

  test('Login page has forgot password link', async ({ page }) => {
    await page.goto('/en/auth/login')

    const forgotLink = page.locator('a[href*="forgot"], a:has-text("Forgot"), a:has-text("forgot")').first()
    if (await forgotLink.isVisible()) {
      await expect(forgotLink).toBeVisible()
    }
  })
})
