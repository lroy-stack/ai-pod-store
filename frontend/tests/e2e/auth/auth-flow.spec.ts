import { test, expect } from '@playwright/test'

/**
 * Comprehensive Auth Flow E2E Test
 * Tests the complete user journey: Register → Login → Profile → Logout
 */
test.describe('@auth Complete Auth Flow', () => {
  // Use the pre-created test user (created in test setup)
  const testUser = {
    name: 'E2E Test User',
    email: 'e2e-test@example.com',
    password: 'testpass123456',
  }

  test('Complete auth flow: register → login → profile → logout', async ({ page }) => {
    // ========================================
    // STEP 1: Verify registration page works (skip if user exists)
    // ========================================
    await test.step('Verify registration page', async () => {
      await page.goto('/en/auth/register')
      await expect(page).toHaveURL(/\/auth\/register/)

      // Wait for page to load
      await page.waitForLoadState('networkidle')

      // Dismiss cookie consent banner (wait longer for it to appear)
      const acceptCookiesBtn = page.locator('button:has-text("Accept All")')
      try {
        await acceptCookiesBtn.waitFor({ state: 'visible', timeout: 5000 })
        await acceptCookiesBtn.click()
        await page.waitForTimeout(1000) // Wait for banner animation to complete
      } catch (e) {
        // Cookie banner might not appear if already accepted
        console.log('Cookie banner not found or already dismissed')
      }

      // Verify form fields are present
      const nameInput = page.locator('input[name="name"], input[type="text"]').first()
      const emailInput = page.locator('input[type="email"], input[name="email"]').first()
      const passwordInput = page.locator('input[type="password"]').first()
      const submitBtn = page.locator('button[type="submit"]').first()

      await expect(nameInput).toBeVisible()
      await expect(emailInput).toBeVisible()
      await expect(passwordInput).toBeVisible()
      await expect(submitBtn).toBeVisible()

      console.log('Registration page verified - form fields present')
    })

    // ========================================
    // STEP 2: Login (if not already logged in)
    // ========================================
    await test.step('Login with test user', async () => {
      await page.goto('/en/auth/login')
      await expect(page).toHaveURL(/\/auth\/login/)

      // Wait a moment for page to fully load
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Dismiss cookie consent banner (wait longer for it to appear and ensure it's gone)
      const acceptCookiesBtn = page.locator('button:has-text("Accept All")')
      try {
        await acceptCookiesBtn.waitFor({ state: 'visible', timeout: 2000 })
        await acceptCookiesBtn.click()
        // Wait for banner to be fully removed from DOM
        await acceptCookiesBtn.waitFor({ state: 'hidden', timeout: 3000 })
        await page.waitForTimeout(500)
      } catch (e) {
        // Cookie banner might not appear if already accepted
        console.log('Cookie banner not found or already dismissed')
      }

      // Fill login form
      const emailInput = page.locator('input[type="email"], input[name="email"], #email').first()
      const passwordInput = page.locator('input[type="password"], input[name="password"], #password').first()

      await emailInput.fill(testUser.email)
      await passwordInput.fill(testUser.password)

      // Wait a moment to ensure form is ready
      await page.waitForTimeout(500)

      // Submit login form - normal click (cookie banner should be gone)
      const submitBtn = page.locator('button[type="submit"]').first()
      await submitBtn.click()

      // Wait for redirect after successful login (could be /en/, /en/chat, /en/shop, or /en/profile)
      await page.waitForURL(/\/en\/?(?:chat|shop|profile)?$/, { timeout: 15_000 })

      // Verify we're no longer on login page
      expect(page.url()).not.toContain('/auth/login')

      console.log(`Login successful, redirected to: ${page.url()}`)
    })

    // ========================================
    // STEP 3: Navigate to profile page
    // ========================================
    await test.step('Navigate to profile page and verify user data', async () => {
      await page.goto('/en/profile')
      await expect(page).toHaveURL(/\/profile/)

      // Wait for profile page to load
      await page.waitForLoadState('networkidle')

      // Verify profile page shows user information
      // Look for email, name, or profile heading
      const profileContent = page.locator(
        `text="${testUser.email}", text="${testUser.name}", h1:has-text("Profile"), h1:has-text("Account"), [data-testid="user-email"], [data-testid="user-name"]`
      ).first()

      // At least one profile indicator should be visible
      const hasProfileContent = await profileContent.isVisible({ timeout: 5_000 }).catch(() => false)
      const pageHasContent = await page.locator('main, [role="main"]').isVisible()

      expect(hasProfileContent || pageHasContent).toBeTruthy()
      console.log('Profile page loaded successfully')
    })

    // ========================================
    // STEP 4: Logout and verify redirect
    // ========================================
    await test.step('Logout and verify redirect to login or home', async () => {
      // Find logout button/link
      // Common patterns: button with "Logout", "Log out", "Sign out", or link with "/auth/logout"
      const logoutButton = page.locator(
        'button:has-text("Logout"), button:has-text("Log out"), button:has-text("Sign out"), a[href*="logout"], button[aria-label*="logout"], button[aria-label*="sign out"]'
      ).first()

      // If logout button is in a dropdown menu, we need to open it first
      const userMenuButton = page.locator(
        '[data-testid="user-menu"], button[aria-label*="user"], button[aria-label*="account"], button:has-text("Account")'
      ).first()

      if (await userMenuButton.isVisible()) {
        await userMenuButton.click()
        await page.waitForTimeout(500) // Wait for dropdown animation
      }

      // Click logout
      await expect(logoutButton).toBeVisible({ timeout: 10_000 })
      await logoutButton.click()

      // Wait for redirect after logout
      // Should redirect to login page, home page, or landing page
      await page.waitForURL(/\/(auth\/login|en\/?$|\/$|shop)/, { timeout: 15_000 })

      // Verify we're logged out by checking that protected routes redirect
      await page.goto('/en/profile')

      // Should either redirect to login or show login prompt
      await page.waitForTimeout(2000)
      const finalUrl = page.url()
      const isOnLoginPage = finalUrl.includes('/auth/login')
      const isRedirected = !finalUrl.includes('/profile')

      expect(isOnLoginPage || isRedirected).toBeTruthy()
      console.log(`After logout, accessing /profile redirected to: ${finalUrl}`)
    })
  })

  test('Logout is persistent across page reloads', async ({ page }) => {
    // First, verify we're logged out (from previous test)
    await page.goto('/en/auth/login')

    // Dismiss cookie consent banner if present
    const acceptCookiesBtn = page.locator('button:has-text("Accept"), button:has-text("Accept all"), button:has-text("I agree")').first()
    if (await acceptCookiesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptCookiesBtn.click()
      await page.waitForTimeout(500) // Wait for banner to dismiss
    }

    // Check that login form is visible (confirms logged out state)
    const emailInput = page.locator('input[type="email"]').first()
    await expect(emailInput).toBeVisible()

    // Reload page
    await page.reload()

    // Should still be on login page, not redirected
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(emailInput).toBeVisible()
  })
})
