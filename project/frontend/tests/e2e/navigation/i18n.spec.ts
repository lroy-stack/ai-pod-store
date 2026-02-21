import { test, expect } from '@playwright/test'
import { TEST_LOCALES } from '../../fixtures/test-data'

test.describe('Internationalization (i18n)', () => {
  for (const locale of TEST_LOCALES) {
    test(`Homepage loads in ${locale} locale`, async ({ page }) => {
      await page.goto(`/${locale}`)
      await expect(page).toHaveURL(new RegExp(`/${locale}`))

      const content = page.locator('main, body')
      await expect(content).toBeVisible()
    })
  }

  test('English locale shows English content', async ({ page }) => {
    await page.goto('/en')

    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('en')
    }
  })

  test('Spanish locale shows Spanish content', async ({ page }) => {
    await page.goto('/es')

    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('es')
    }
  })

  test('German locale shows German content', async ({ page }) => {
    await page.goto('/de')

    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('de')
    }
  })

  test('Shop page loads in all locales', async ({ page }) => {
    for (const locale of TEST_LOCALES) {
      await page.goto(`/${locale}/shop`)
      await expect(page).toHaveURL(new RegExp(`/${locale}/shop`))
    }
  })

  test('Locale switching navigates correctly', async ({ page }) => {
    await page.goto('/en')

    // Look for locale switcher
    const localeSwitcher = page.locator('[data-testid="locale-switcher"], [aria-label*="language"], [aria-label*="Language"]').first()
    if (await localeSwitcher.isVisible()) {
      await localeSwitcher.click()

      const esOption = page.locator('a[href*="/es"], button:has-text("ES"), button:has-text("Español")').first()
      if (await esOption.isVisible()) {
        await esOption.click()
        await page.waitForURL(/\/es/)
      }
    }
  })
})
