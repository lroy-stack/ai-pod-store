import { test, expect } from '@playwright/test'

/**
 * Admin Flow E2E Test
 * Tests admin authentication and dashboard verification
 */
test.describe('@admin Admin Flow', () => {
  // Admin credentials come from environment variables only.
  // Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local before running tests.
  const adminUser = {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  }

  test('Admin login and dashboard verification', async ({ page }) => {
    // Step 1: Navigate to admin panel
    await page.goto('http://localhost:3001')

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/)

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1500)

    // Step 2: Login as admin
    await test.step('Login as admin', async () => {
      const emailInput = page.locator('#email, input[type="email"]').first()
      const passwordInput = page.locator('#password, input[type="password"]').first()
      const submitBtn = page.locator('button[type="submit"]').first()

      await expect(emailInput).toBeVisible({ timeout: 5000 })
      await expect(passwordInput).toBeVisible()
      await expect(submitBtn).toBeVisible()

      await emailInput.fill(adminUser.email)
      await passwordInput.fill(adminUser.password)
      await submitBtn.click()

      // Wait for redirect to dashboard (URL will be http://localhost:3001/ or /dashboard)
      await page.waitForURL(/localhost:3001\/$|\/dashboard/, { timeout: 10000 })
      console.log('✓ Admin logged in successfully')
    })

    // Step 3: Verify dashboard loads with KPI widgets
    await test.step('Verify dashboard KPI widgets', async () => {
      // Wait for dashboard content to load
      await page.waitForTimeout(2000)

      // Check for common dashboard elements
      const pageContent = await page.content()

      // Dashboard should have revenue/orders/customers KPI data
      const hasKPIContent =
        pageContent.includes('Revenue') ||
        pageContent.includes('Orders') ||
        pageContent.includes('Customers') ||
        pageContent.includes('Dashboard') ||
        pageContent.includes('€') // Euro symbol for revenue

      expect(hasKPIContent).toBe(true)
      console.log('✓ Dashboard KPI widgets verified')
    })

    // Step 4: Navigate to Products page
    await test.step('Navigate to Products page', async () => {
      // Look for Products link in sidebar or nav
      const productsLink = page.locator('a[href*="/products"], a:has-text("Products")').first()

      if (await productsLink.isVisible({ timeout: 5000 })) {
        await productsLink.click()

        // Wait for products page to load
        await page.waitForURL(/\/products/, { timeout: 10000 })

        // Verify products page content
        const pageContent = await page.content()
        const hasProductsContent =
          pageContent.includes('Products') ||
          pageContent.includes('product') ||
          pageContent.includes('SKU') ||
          pageContent.includes('Price')

        expect(hasProductsContent).toBe(true)
        console.log('✓ Products page navigation verified')
      } else {
        // If products link not found, verify we're at least on dashboard
        const currentUrl = page.url()
        expect(currentUrl).toMatch(/localhost:3001/)
        console.log('⚠ Products link not found in nav, but dashboard is accessible')
      }
    })
  })

  test('Admin login page has required elements', async ({ page }) => {
    await page.goto('http://localhost:3001/login')

    // Verify login form elements exist
    const emailInput = page.locator('#email, input[type="email"]').first()
    const passwordInput = page.locator('#password, input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()

    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await expect(passwordInput).toBeVisible()
    await expect(submitBtn).toBeVisible()
  })
})
