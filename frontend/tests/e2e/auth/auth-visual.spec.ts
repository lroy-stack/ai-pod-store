import { test, expect } from '@playwright/test'
import { TEST_VIEWPORTS } from '../../fixtures/test-data'

const AUTH_PAGES = [
  { name: 'login', path: '/en/auth/login' },
  { name: 'register', path: '/en/auth/register' },
] as const

const VIEWPORTS = [
  { name: 'mobile', ...TEST_VIEWPORTS.mobile },
  { name: 'tablet', ...TEST_VIEWPORTS.tablet },
  { name: 'desktop', ...TEST_VIEWPORTS.desktop },
] as const

test.describe('@auth Auth Pages — Visual & Layout', () => {
  for (const authPage of AUTH_PAGES) {
    test.describe(`${authPage.name} page`, () => {

      test('page loads without errors', async ({ page }) => {
        await page.goto(authPage.path)
        await expect(page).toHaveURL(new RegExp(authPage.path))

        // No console errors
        const errors: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'error') errors.push(msg.text())
        })
        await page.waitForTimeout(1000)
        // Filter out known non-critical errors (e.g., network requests to APIs)
        const criticalErrors = errors.filter(e =>
          !e.includes('fetch') && !e.includes('net::') && !e.includes('ERR_CONNECTION') &&
          !e.includes('404') && !e.includes('Failed to load resource')
        )
        expect(criticalErrors).toHaveLength(0)
      })

      test('brand logo is visible and links to home', async ({ page }) => {
        await page.goto(authPage.path)
        const logo = page.locator('a[aria-label="Home"]')
        await expect(logo).toBeVisible()
        await expect(logo).toHaveAttribute('href', /\/en\/?$/)
        // BrandMark renders SVG logo via next/image
        await expect(logo.locator('img').first()).toBeVisible()
      })

      test('card is visible and contains form', async ({ page }) => {
        await page.goto(authPage.path)
        const card = page.locator('[data-slot="card"]')
        await expect(card).toBeVisible()
        // Card has glassmorphism classes
        const cardClass = await card.getAttribute('class')
        expect(cardClass).toContain('backdrop-blur')
      })

      test('submit button is fully visible without scrolling on desktop', async ({ page }) => {
        await page.setViewportSize(TEST_VIEWPORTS.desktop)
        await page.goto(authPage.path)

        const submitBtn = page.locator('button[type="submit"]')
        await expect(submitBtn).toBeVisible()
        await expect(submitBtn).toBeInViewport()
      })

      test('social login buttons are visible', async ({ page }) => {
        await page.goto(authPage.path)

        const googleBtn = page.locator('button', { hasText: 'Google' })
        const appleBtn = page.locator('button', { hasText: 'Apple' })

        await expect(googleBtn).toBeVisible()
        await expect(appleBtn).toBeVisible()
      })

      for (const vp of VIEWPORTS) {
        test(`responsive: all form elements accessible on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height })
          await page.goto(authPage.path)

          // Email input visible
          const emailInput = page.locator('input[type="email"]')
          await expect(emailInput).toBeVisible()

          // Password input visible
          const passwordInput = page.locator('input[type="password"]').first()
          await expect(passwordInput).toBeVisible()

          // Submit button exists and reachable (may need scroll on mobile)
          const submitBtn = page.locator('button[type="submit"]')
          await expect(submitBtn).toBeVisible()

          // Social buttons exist (may need scroll)
          const googleBtn = page.locator('button', { hasText: 'Google' })
          await expect(googleBtn).toBeAttached()
        })

        test(`responsive: card not clipped horizontally on ${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height })
          await page.goto(authPage.path)

          const card = page.locator('[data-slot="card"]')
          await expect(card).toBeVisible()
          const box = await card.boundingBox()
          expect(box).not.toBeNull()
          // Card should not overflow viewport width (allowing for padding)
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width + 1)
        })

        test(`screenshot: ${authPage.name} on ${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height })
          await page.goto(authPage.path)
          // Wait for metaballs to render
          await page.waitForTimeout(1500)
          await page.screenshot({
            path: `test-results/screenshots/${authPage.name}-${vp.name}.png`,
            fullPage: true,
          })
        })
      }
    })
  }

  test.describe('login page — specific', () => {
    test('email input has type="email"', async ({ page }) => {
      await page.goto('/en/auth/login')
      const emailInput = page.locator('#email')
      await expect(emailInput).toHaveAttribute('type', 'email')
    })

    test('remember me checkbox is visible', async ({ page }) => {
      await page.goto('/en/auth/login')
      const checkbox = page.locator('#rememberMe')
      await expect(checkbox).toBeVisible()
    })

    test('forgot password link is visible', async ({ page }) => {
      await page.goto('/en/auth/login')
      const forgotLink = page.locator('a[href*="forgot"]')
      await expect(forgotLink).toBeVisible()
    })
  })

  test.describe('register page — specific', () => {
    test('name input is visible', async ({ page }) => {
      await page.goto('/en/auth/register')
      const nameInput = page.locator('#name')
      await expect(nameInput).toBeVisible()
    })

    test('confirm password field is visible', async ({ page }) => {
      await page.goto('/en/auth/register')
      const confirmPwd = page.locator('#confirmPassword')
      await expect(confirmPwd).toBeVisible()
    })

    test('terms checkbox is visible', async ({ page }) => {
      await page.goto('/en/auth/register')
      const terms = page.locator('#terms')
      await expect(terms).toBeVisible()
    })

    test('password strength indicator appears when typing', async ({ page }) => {
      await page.goto('/en/auth/register')
      const passwordInput = page.locator('#password')

      // No strength indicator initially
      const strengthBar = page.locator('#password-strength')
      await expect(strengthBar).not.toBeVisible()

      // Type password — indicator appears
      await passwordInput.fill('Test1234!')
      await expect(strengthBar).toBeVisible()
    })

    test('field validation shows inline errors on empty submit', async ({ page }) => {
      await page.goto('/en/auth/register')

      const submitBtn = page.locator('button[type="submit"]')
      await submitBtn.click()

      // Should show inline error messages
      const nameError = page.locator('#name-error')
      const emailError = page.locator('#email-error')
      const passwordError = page.locator('#password-error')

      await expect(nameError).toBeVisible()
      await expect(emailError).toBeVisible()
      await expect(passwordError).toBeVisible()
    })

    test('scrollable on small viewport — all content reachable', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 600 }) // Very short viewport
      await page.goto('/en/auth/register')

      // Google button at the bottom should be reachable by scrolling
      const googleBtn = page.locator('button', { hasText: 'Google' })
      await expect(googleBtn).toBeAttached()
      await googleBtn.scrollIntoViewIfNeeded()
      await expect(googleBtn).toBeInViewport()
    })
  })

  test.describe('i18n — pages work in all locales', () => {
    for (const locale of ['en', 'es', 'de']) {
      test(`login page loads in ${locale}`, async ({ page }) => {
        await page.goto(`/${locale}/auth/login`)
        await expect(page).toHaveURL(new RegExp(`/${locale}/auth/login`))
        const heading = page.locator('h2')
        await expect(heading).toBeVisible()
        // Heading should not be empty
        const text = await heading.textContent()
        expect(text!.length).toBeGreaterThan(0)
      })

      test(`register page loads in ${locale}`, async ({ page }) => {
        await page.goto(`/${locale}/auth/register`)
        await expect(page).toHaveURL(new RegExp(`/${locale}/auth/register`))
        const heading = page.locator('h2')
        await expect(heading).toBeVisible()
        const text = await heading.textContent()
        expect(text!.length).toBeGreaterThan(0)
      })
    }
  })
})
