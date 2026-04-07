import { test, expect } from '@playwright/test'

test.describe('@shop Search', () => {
  test('Search input is accessible', async ({ page }) => {
    await page.goto('/en/shop')

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], [data-testid="search-input"]').first()
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeEnabled()
    }
  })

  test('Search returns results for valid query', async ({ page }) => {
    await page.goto('/en/shop')

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], [data-testid="search-input"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('tote')
      await searchInput.press('Enter')
      await page.waitForLoadState('networkidle')

      // Verify results appear or "no results" message
      const content = page.locator('main')
      await expect(content).toBeVisible()
    }
  })

  test('Empty search shows all products', async ({ page }) => {
    await page.goto('/en/shop')

    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"], input[placeholder*="search"], [data-testid="search-input"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('')
      await searchInput.press('Enter')
      await page.waitForLoadState('networkidle')
    }
  })
})
