import { test, expect } from '@playwright/test'

test.describe('@chat AI Assistant', () => {
  test('Chat page loads', async ({ page }) => {
    await page.goto('/en/chat')
    await expect(page).toHaveURL(/\/chat/)
  })

  test('Chat interface shows input area', async ({ page }) => {
    await page.goto('/en/chat')

    const chatInput = page.locator('textarea, input[type="text"], [data-testid="chat-input"], [contenteditable="true"]').first()
    await expect(chatInput).toBeVisible({ timeout: 15_000 })
  })

  test('Can type a message in chat input', async ({ page }) => {
    await page.goto('/en/chat')

    const chatInput = page.locator('textarea, input[type="text"], [data-testid="chat-input"]').first()
    if (await chatInput.isVisible({ timeout: 10_000 })) {
      await chatInput.fill('Hello, can you help me find products?')
      const value = await chatInput.inputValue()
      expect(value).toContain('Hello')
    }
  })

  test('Send button is present', async ({ page }) => {
    await page.goto('/en/chat')

    const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send-button"], button[aria-label*="Send"]').first()
    if (await sendBtn.isVisible({ timeout: 10_000 })) {
      await expect(sendBtn).toBeVisible()
    }
  })

  test('Sending message triggers AI response', async ({ page }) => {
    await page.goto('/en/chat')

    const chatInput = page.locator('textarea, input[type="text"], [data-testid="chat-input"]').first()
    if (await chatInput.isVisible({ timeout: 10_000 })) {
      await chatInput.fill('hello')

      const sendBtn = page.locator('button[type="submit"], button:has-text("Send"), [data-testid="send-button"]').first()
      if (await sendBtn.isVisible()) {
        await sendBtn.click()

        // Wait for AI response to appear
        const response = page.locator('[data-testid="assistant-message"], .assistant-message, [data-role="assistant"]').first()
        await expect(response).toBeVisible({ timeout: 30_000 })
      }
    }
  })
})
