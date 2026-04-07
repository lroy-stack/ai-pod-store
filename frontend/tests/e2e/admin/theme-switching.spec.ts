import { test, expect } from '@playwright/test'

/**
 * Theme Switching E2E Test
 * Tests that changing the active theme in admin panel reflects on the frontend
 *
 * Note: Admin panel is desktop-only, so we skip mobile browsers
 */
test.describe('@admin Theme Switching', () => {
  test.skip(({ browserName }) => (browserName as string) === 'mobile-chrome', 'Admin panel requires desktop browser')
  // Admin credentials come from environment variables only.
  // Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local before running tests.
  const adminUser = {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  }

  test('Theme switching from admin reflects in frontend', async ({ browser }) => {
    // Step 1: Login to admin and navigate to branding page
    const adminContext = await browser.newContext()
    const adminPage = await adminContext.newPage()

    await test.step('Login to admin panel', async () => {
      await adminPage.goto('http://localhost:3001/login')
      await adminPage.waitForLoadState('domcontentloaded')

      const emailInput = adminPage.locator('#email, input[type="email"]').first()
      const passwordInput = adminPage.locator('#password, input[type="password"]').first()
      const submitBtn = adminPage.locator('button[type="submit"]').first()

      await expect(emailInput).toBeVisible({ timeout: 5000 })
      await emailInput.fill(adminUser.email)
      await passwordInput.fill(adminUser.password)
      await submitBtn.click()

      await adminPage.waitForURL(/localhost:3001\/$|\/dashboard/, { timeout: 10000 })
      console.log('✓ Admin logged in successfully')
    })

    // Step 2: Navigate to branding page
    await test.step('Navigate to branding page', async () => {
      await adminPage.goto('http://localhost:3001/branding')
      await adminPage.waitForLoadState('domcontentloaded')
      await adminPage.waitForTimeout(2000) // Wait for themes to load

      // Verify we're on branding page by checking page content
      await expect(adminPage.locator('h1:has-text("Branding")')).toBeVisible({ timeout: 5000 })
      console.log('✓ Branding page loaded')
    })

    // Step 3: Get current active theme and find another theme to activate
    let initialThemeSlug: string = ''
    let targetThemeSlug: string = ''
    let targetThemeName: string = ''

    await test.step('Identify themes to switch', async () => {
      // Fetch themes from API
      const themesResponse = await adminPage.request.get('http://localhost:3001/api/admin/themes')
      expect(themesResponse.ok()).toBeTruthy()
      const themes = await themesResponse.json()

      // Find currently active theme
      const activeTheme = themes.find((t: any) => t.is_active)
      expect(activeTheme).toBeDefined()
      initialThemeSlug = activeTheme.slug
      console.log(`✓ Current active theme: ${activeTheme.name} (${initialThemeSlug})`)

      // Find a different theme to activate (prefer Forest Eco or first non-active)
      const targetTheme = themes.find((t: any) => !t.is_active && t.slug === 'forest-eco') ||
                          themes.find((t: any) => !t.is_active)
      expect(targetTheme).toBeDefined()
      targetThemeSlug = targetTheme.slug
      targetThemeName = targetTheme.name
      console.log(`✓ Target theme to activate: ${targetThemeName} (${targetThemeSlug})`)
    })

    // Step 4: Activate the target theme
    await test.step('Activate different theme', async () => {
      // Find the theme card with the target theme name
      const themeCards = adminPage.locator('[class*="card"]')
      let activateButton: any = null

      // Find the card containing the target theme name and its activate button
      const cardCount = await themeCards.count()
      for (let i = 0; i < cardCount; i++) {
        const cardText = await themeCards.nth(i).textContent()
        if (cardText && cardText.includes(targetThemeName)) {
          // Found the right card, look for Activate button
          const buttons = themeCards.nth(i).locator('button:has-text("Activate")')
          const buttonCount = await buttons.count()
          if (buttonCount > 0) {
            activateButton = buttons.first()
            break
          }
        }
      }

      expect(activateButton).toBeTruthy()
      await activateButton.click()

      // Wait for activation to complete (button will change or card will show "Active" badge)
      await adminPage.waitForTimeout(2000)

      // Verify the theme is now active
      const themesResponse = await adminPage.request.get('http://localhost:3001/api/admin/themes')
      const themes = await themesResponse.json()
      const nowActiveTheme = themes.find((t: any) => t.is_active)
      expect(nowActiveTheme.slug).toBe(targetThemeSlug)
      console.log(`✓ Theme activated: ${targetThemeName}`)
    })

    // Step 5: Open frontend and verify CSS variables changed
    await test.step('Verify theme change on frontend', async () => {
      const frontendContext = await browser.newContext()
      const frontendPage = await frontendContext.newPage()

      await frontendPage.goto('http://localhost:3000/en/')
      await frontendPage.waitForLoadState('domcontentloaded')
      await frontendPage.waitForTimeout(2000) // Wait for theme to load

      // Get the current theme from frontend API
      const themeResponse = await frontendPage.request.get('http://localhost:3000/api/storefront/theme')
      expect(themeResponse.ok()).toBeTruthy()
      const frontendTheme = await themeResponse.json()

      // Verify frontend is using the newly activated theme
      expect(frontendTheme.slug).toBe(targetThemeSlug)
      console.log(`✓ Frontend API returns correct theme: ${frontendTheme.name}`)

      // Verify CSS variables are injected in the DOM
      const styleTag = await frontendPage.locator('style#dynamic-theme-style, style#server-theme-style').first()
      const styleExists = await styleTag.count() > 0
      expect(styleExists).toBeTruthy()

      if (styleExists) {
        const styleContent = await styleTag.textContent()
        expect(styleContent).toBeTruthy()

        // Check for presence of theme-specific CSS variable (e.g., --background)
        expect(styleContent).toContain('--background')
        expect(styleContent).toContain('--primary')
        console.log('✓ CSS variables injected into frontend DOM')
      }

      // Verify computed styles on root element
      const rootStyles = await frontendPage.evaluate(() => {
        const root = document.documentElement
        const styles = window.getComputedStyle(root)
        return {
          background: styles.getPropertyValue('--background').trim(),
          primary: styles.getPropertyValue('--primary').trim(),
          foreground: styles.getPropertyValue('--foreground').trim(),
        }
      })

      // CSS variables should have values (not empty)
      expect(rootStyles.background).toBeTruthy()
      expect(rootStyles.primary).toBeTruthy()
      console.log(`✓ CSS variables computed on root: --background="${rootStyles.background}", --primary="${rootStyles.primary}"`)

      await frontendContext.close()
    })

    // Step 6: Switch back to original theme (cleanup)
    await test.step('Switch back to original theme', async () => {
      await adminPage.goto('http://localhost:3001/branding')
      await adminPage.waitForLoadState('domcontentloaded')
      await adminPage.waitForTimeout(2000)

      // Find original theme card and activate it
      const themeCards = adminPage.locator('[class*="card"]')
      let activateButton: any = null

      const cardCount = await themeCards.count()
      for (let i = 0; i < cardCount; i++) {
        const cardText = await themeCards.nth(i).textContent()
        // Look for the card with the original theme (match by slug in the API response)
        if (cardText) {
          const buttons = themeCards.nth(i).locator('button:has-text("Activate")')
          const buttonCount = await buttons.count()
          if (buttonCount > 0) {
            // Click first non-active theme's activate button that matches initial slug
            // (We need to identify by fetching themes again)
            const themesResponse = await adminPage.request.get('http://localhost:3001/api/admin/themes')
            const themes = await themesResponse.json()
            const originalTheme = themes.find((t: any) => t.slug === initialThemeSlug)

            if (originalTheme && cardText.includes(originalTheme.name)) {
              activateButton = buttons.first()
              break
            }
          }
        }
      }

      if (activateButton) {
        await activateButton.click()
        await adminPage.waitForTimeout(2000)
        console.log(`✓ Switched back to original theme: ${initialThemeSlug}`)
      }
    })

    await adminContext.close()
  })

  test('Branding page displays theme cards with Activate buttons', async ({ page }) => {
    await test.step('Login to admin', async () => {
      await page.goto('http://localhost:3001/login')
      const emailInput = page.locator('#email, input[type="email"]').first()
      const passwordInput = page.locator('#password, input[type="password"]').first()
      const submitBtn = page.locator('button[type="submit"]').first()

      await emailInput.fill(adminUser.email)
      await passwordInput.fill(adminUser.password)
      await submitBtn.click()
      await page.waitForURL(/localhost:3001/, { timeout: 10000 })
    })

    await test.step('Check branding page elements', async () => {
      // Navigate to branding by clicking the sidebar link (preserves session)
      const brandingLink = page.locator('a[href*="/branding"], a:has-text("Branding")').first()
      await expect(brandingLink).toBeVisible({ timeout: 5000 })
      await brandingLink.click()
      await page.waitForURL(/\/branding/, { timeout: 10000 })
      await page.waitForTimeout(2000)

      // Verify theme cards exist
      const themeCards = page.locator('[class*="card"]')
      const cardCount = await themeCards.count()
      expect(cardCount).toBeGreaterThan(0)
      console.log(`✓ Found ${cardCount} theme cards`)

      // Verify at least one Activate button exists (for non-active themes)
      const activateButtons = page.locator('button:has-text("Activate")')
      const activateCount = await activateButtons.count()
      expect(activateCount).toBeGreaterThan(0)
      console.log(`✓ Found ${activateCount} Activate buttons`)

      // Verify at least one Active badge exists (for the active theme)
      const activeBadge = page.locator('text=Active').first()
      await expect(activeBadge).toBeVisible()
      console.log('✓ Active badge found for current theme')
    })
  })
})
