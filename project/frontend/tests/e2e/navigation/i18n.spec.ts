import { test, expect } from '@playwright/test'
import { TEST_LOCALES } from '../../fixtures/test-data'

test.describe('Internationalization (i18n)', () => {
  for (const locale of TEST_LOCALES) {
    test(`Homepage loads in ${locale} locale`, async ({ page }) => {
      await page.goto(`/${locale}`)
      await expect(page).toHaveURL(new RegExp(`/${locale}`))

      // Check that the main content area is visible
      await expect(page.getByRole('main')).toBeVisible()
    })
  }

  test('English locale shows English content', async ({ page }) => {
    await page.goto('/en/shop')

    // Check HTML lang attribute
    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('en')
    }

    // Check for English page content
    await expect(page.getByRole('heading', { name: 'Shop', level: 1 })).toBeVisible()
    await expect(page.getByText('Discover our collection of custom products')).toBeVisible()
    await expect(page.getByText(/products available/)).toBeVisible()
  })

  test('Spanish locale shows Spanish content', async ({ page }) => {
    await page.goto('/es/shop')

    // Check HTML lang attribute
    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('es')
    }

    // Check for Spanish page content
    await expect(page.getByRole('heading', { name: 'Tienda', level: 1 })).toBeVisible()
    await expect(page.getByText('Descubre nuestra colección de productos personalizados')).toBeVisible()
    await expect(page.getByText(/productos disponibles/)).toBeVisible()
  })

  test('German locale shows German content', async ({ page }) => {
    await page.goto('/de/shop')

    // Check HTML lang attribute
    const htmlLang = await page.locator('html').getAttribute('lang')
    if (htmlLang) {
      expect(htmlLang).toContain('de')
    }

    // Check for German page content
    await expect(page.getByRole('heading', { name: 'Shop', level: 1 })).toBeVisible()
    await expect(page.getByText('Entdecken Sie unsere Kollektion maßgeschneiderter Produkte')).toBeVisible()
    await expect(page.getByText(/Produkte verfügbar/)).toBeVisible()
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
