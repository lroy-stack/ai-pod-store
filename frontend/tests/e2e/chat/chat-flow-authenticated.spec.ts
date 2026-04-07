import { test, expect } from '@playwright/test'

test.describe('@e2e Chat Flow (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Login first to bypass welcome modals
    await page.goto('/en/auth/login')

    // Wait for page to load
    await page.waitForTimeout(2000)

    // Dismiss cookie consent if present
    const acceptCookies = page.getByRole('button', { name: /accept all/i })
    if (await acceptCookies.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptCookies.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Fill login form with real E2E test credentials
    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')
    const submitBtn = page.locator('button[type="submit"]')

    await emailInput.fill('l.roy.lwe@gmail.com')
    await passwordInput.fill('TestPass123456!')
    await submitBtn.click()

    // Wait for successful login (redirects to homepage)
    await page.waitForURL(/\/en($|\/)/, { timeout: 15000 })

    // Now navigate to chat page
    await page.goto('/en/chat')
    await page.waitForTimeout(2000)
  })

  test('Authenticated user can send message and receive response', async ({ page }) => {
    // Close welcome modal if it appears (look for X button or Continue as guest)
    const closeModalBtn = page.locator('button[aria-label*="Close"], button:has-text("×")').first()
    if (await closeModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeModalBtn.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Alternative: click "Continue as guest" if present
    const continueBtn = page.getByText('Continue as guest')
    if (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await continueBtn.click({ force: true })
      await page.waitForTimeout(1000)
    }

    // Now find the chat input
    const chatInput = page.locator('textarea, input[type="text"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // Type and send message
    await chatInput.fill('Hello, show me products')
    await chatInput.press('Enter')

    // Verify input cleared
    await expect(chatInput).toHaveValue('')

    // Wait for AI response (look for "Add to Cart" buttons or response text)
    const hasResponse = await page.locator('button:has-text("Add to Cart"), p:has-text("Absolutely"), p:has-text("found"), p:has-text("I")').first().isVisible({ timeout: 30_000 }).catch(() => false)

    expect(hasResponse).toBe(true)
  })
})
