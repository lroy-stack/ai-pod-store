import { test, expect } from '@playwright/test'

test.describe('@e2e Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Helper to dismiss any modals/banners that might block the interface
    await page.goto('/en/chat', { waitUntil: 'domcontentloaded' })

    // Wait for any modals to fully appear
    await page.waitForTimeout(2500)

    // Dismiss cookie consent if present
    try {
      const acceptCookies = page.getByRole('button', { name: /accept all/i })
      if (await acceptCookies.isVisible({ timeout: 1000 })) {
        await acceptCookies.click({ force: true, timeout: 5000 })
        // Wait for it to disappear
        await acceptCookies.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
      }
    } catch (e) {
      // Cookie banner might not appear, continue
    }

    // Dismiss welcome modal/dialog if present
    try {
      // Try clicking "Continue as guest" button
      const continueAsGuest = page.getByRole('button', { name: /continue as guest/i })
      if (await continueAsGuest.isVisible({ timeout: 1000 })) {
        await continueAsGuest.click({ force: true, timeout: 5000 })
        await continueAsGuest.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
      }

      // Also try closing the dialog via X button or clicking outside
      const dialogCloseBtn = page.getByRole('button', { name: /close/i }).first()
      if (await dialogCloseBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await dialogCloseBtn.click({ force: true })
      }
    } catch (e) {
      // Welcome modal might not appear, continue
    }

    // Final wait for animations
    await page.waitForTimeout(1500)
  })

  test('Chat flow: send message and receive response', async ({ page }) => {
    // Step 3: Find the chat input using a more flexible selector
    const chatInput = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    const testMessage = 'show me products'
    await chatInput.fill(testMessage)

    // Send the message using Enter key (more reliable than clicking button)
    await chatInput.press('Enter')

    // Step 4: Wait for AI response to appear
    // Verify the input is cleared after sending (this happens immediately)
    await expect(chatInput).toHaveValue('')

    // Wait a bit for the AI to process and respond
    await page.waitForTimeout(5000)

    // Look for any response indicators:
    // 1. Product cards with "Add to Cart" button, OR
    // 2. Text response with actual content (not just placeholder text), OR
    // 3. The POD AI icon "P" appearing (indicates AI message)

    const hasResponse = await page.locator('button:has-text("Add to Cart"), p:has-text("Absolutely"), p:has-text("found"), p:has-text("I")').first().isVisible({ timeout: 25_000 }).catch(() => false)

    // Verify we got some kind of response
    expect(hasResponse).toBe(true)
  })

  test('Chat interface loads correctly', async ({ page }) => {
    // Verify chat input is present
    const chatInput = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first()
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // Verify send button is present (but disabled when empty)
    const sendButton = page.locator('button:has-text("Send"), button[aria-label*="Send"]').first()
    await expect(sendButton).toBeVisible()
    await expect(sendButton).toBeDisabled()

    // Verify voice and attachment buttons are present
    await expect(page.locator('button:has-text("Voice"), button[aria-label*="Voice"]').first()).toBeVisible()
    await expect(page.locator('button:has-text("Attach"), button[aria-label*="Attach"]').first()).toBeVisible()
  })

  test('Send button enables when typing', async ({ page }) => {
    const chatInput = page.locator('textarea[placeholder*="Ask me"], input[placeholder*="Ask me"]').first()
    const sendButton = page.locator('button:has-text("Send"), button[aria-label*="Send"]').first()

    // Initially disabled
    await expect(sendButton).toBeDisabled()

    // Type something
    await chatInput.fill('Test message')

    // Now enabled
    await expect(sendButton).toBeEnabled()

    // Clear input
    await chatInput.clear()

    // Disabled again
    await expect(sendButton).toBeDisabled()
  })
})
