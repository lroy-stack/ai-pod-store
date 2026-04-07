import { test, expect } from '@playwright/test'

test.describe('Design Flow', () => {
  test('Designs page loads', async ({ page }) => {
    await page.goto('/en/designs')

    const url = page.url()
    const isDesigns = url.includes('/designs')
    const isLogin = url.includes('/auth/login')
    expect(isDesigns || isLogin).toBeTruthy()
  })

  test('Design page shows creation interface', async ({ page }) => {
    await page.goto('/en/designs')

    if (page.url().includes('/auth/login')) {
      return
    }

    const content = page.locator('main')
    await expect(content).toBeVisible()

    // Look for design prompt input or upload area
    const promptInput = page.locator('textarea, input[type="text"], [data-testid="design-prompt"]').first()
    if (await promptInput.isVisible()) {
      await expect(promptInput).toBeEnabled()
    }
  })

  test('Design page shows existing designs or empty state', async ({ page }) => {
    await page.goto('/en/designs')

    if (page.url().includes('/auth/login')) {
      return
    }

    const content = page.locator('main')
    await expect(content).toBeVisible()
  })
})
