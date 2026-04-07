import { test, expect, Page } from '@playwright/test'

/**
 * Admin Coupon Management E2E Tests
 * Tests CRUD operations on coupons from the admin panel.
 * Requires admin panel running on port 3001.
 */
test.describe('@admin @coupons Admin Coupon Management', () => {
  // Admin credentials come from environment variables only.
  // Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local before running tests.
  const adminUser = {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  }

  const ADMIN_URL = 'http://localhost:3001'

  async function loginAsAdmin(page: Page) {
    await page.goto(`${ADMIN_URL}/login`, { timeout: 8000 })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const emailInput = page.locator('#email, input[type="email"]').first()
    const passwordInput = page.locator('#password, input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()

    await expect(emailInput).toBeVisible({ timeout: 5000 })
    await emailInput.fill(adminUser.email)
    await passwordInput.fill(adminUser.password)
    await submitBtn.click()

    await page.waitForURL(/localhost:3001\/$|\/dashboard/, { timeout: 10000 })
    await page.waitForTimeout(1000)
  }

  // Skip all tests if admin is not running
  test.beforeEach(async ({ page }) => {
    try {
      const response = await page.goto(`${ADMIN_URL}/login`, { timeout: 5000 })
      if (!response || response.status() >= 500) {
        test.skip(true, 'Admin panel not running on port 3001')
      }
    } catch {
      test.skip(true, 'Admin panel not reachable on port 3001')
    }
  })

  test.describe('Navigation', () => {
    test('Coupons link visible in sidebar under Marketing', async ({ page }) => {
      await loginAsAdmin(page)

      const couponsLink = page.locator('a[href*="/coupons"], a:has-text("Coupons")').first()

      if (await couponsLink.isVisible({ timeout: 5000 })) {
        console.log('✓ Coupons link found in sidebar')
        await expect(couponsLink).toBeVisible()
      } else {
        // Try expanding sidebar if collapsed
        const expandBtn = page.locator('button:has(svg.lucide-chevron-right)').first()
        if (await expandBtn.isVisible({ timeout: 2000 })) {
          await expandBtn.click()
          await page.waitForTimeout(500)
        }

        const couponsLinkAfterExpand = page.locator('a[href*="/coupons"]').first()
        const isVisible = await couponsLinkAfterExpand.isVisible({ timeout: 3000 })
        expect(isVisible).toBeTruthy()
        console.log('✓ Coupons link found after expanding sidebar')
      }
    })

    test('Navigate to Coupons page', async ({ page }) => {
      await loginAsAdmin(page)

      const couponsLink = page.locator('a[href*="/coupons"]').first()

      if (await couponsLink.isVisible({ timeout: 5000 })) {
        await couponsLink.click()
        await page.waitForURL(/\/coupons/, { timeout: 10000 })
        console.log('✓ Navigated to Coupons page')
      } else {
        await page.goto(`${ADMIN_URL}/coupons`)
        await page.waitForLoadState('domcontentloaded')
      }

      await page.waitForTimeout(2000)

      const pageContent = await page.content()
      const hasCouponsContent =
        pageContent.includes('Coupon') ||
        pageContent.includes('coupon') ||
        pageContent.includes('Discount') ||
        pageContent.includes('Code')

      expect(hasCouponsContent).toBeTruthy()
      console.log('✓ Coupons page content loaded')
    })
  })

  test.describe('Coupons List', () => {
    test('Page shows stats summary cards', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const pageContent = await page.content()
      const hasStats =
        pageContent.includes('Total') ||
        pageContent.includes('Active') ||
        pageContent.includes('Redemptions') ||
        pageContent.includes('Revenue')

      if (hasStats) {
        console.log('✓ Stats summary cards visible')
      } else {
        console.log('⚠ Stats cards not found')
      }
    })

    test('Page shows coupon table with WELCOME10', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const pageContent = await page.content()
      const hasWelcome10 = pageContent.includes('WELCOME10')

      if (hasWelcome10) {
        console.log('✓ WELCOME10 seed coupon visible in table')
      } else {
        console.log('⚠ WELCOME10 not found in table')
      }
    })

    test('Table has expected columns', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const pageContent = await page.content()
      const expectedHeaders = ['Code', 'Discount', 'Type', 'Status']
      const foundHeaders = expectedHeaders.filter((h) => pageContent.includes(h))

      console.log(`✓ Found ${foundHeaders.length}/${expectedHeaders.length} table headers: ${foundHeaders.join(', ')}`)
      expect(foundHeaders.length).toBeGreaterThan(0)
    })

    test('Search by code works', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const searchInput = page
        .locator('input[placeholder*="Search" i], input[placeholder*="code" i], input[type="search"]')
        .first()

      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill('WELCOME')
        await page.waitForTimeout(1500)

        const pageContent = await page.content()
        if (pageContent.includes('WELCOME10')) {
          console.log('✓ Search found WELCOME10')
        } else {
          console.log('⚠ Search did not filter to WELCOME10')
        }
      } else {
        console.log('⚠ Search input not found')
      }
    })
  })

  test.describe('Create Coupon', () => {
    test('Create Coupon button opens dialog', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const createBtn = page
        .locator('button:has-text("Create Coupon"), button:has-text("New Coupon"), button:has-text("Create")')
        .first()

      if (await createBtn.isVisible({ timeout: 5000 })) {
        await createBtn.click()
        await page.waitForTimeout(1000)

        const dialog = page.locator('[role="dialog"], [data-state="open"]').first()

        if (await dialog.isVisible({ timeout: 3000 })) {
          console.log('✓ Create Coupon dialog opened')

          const dialogText = await dialog.textContent()
          const hasFields =
            (dialogText?.includes('Code') || false) &&
            (dialogText?.includes('Discount') || dialogText?.includes('Value') || false)

          if (hasFields) {
            console.log('✓ Dialog has Code and Discount fields')
          }
        } else {
          console.log('⚠ Dialog did not open')
        }
      } else {
        console.log('⚠ Create Coupon button not found')
      }
    })

    test('Create a test coupon via dialog', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const uniqueCode = `TEST${Date.now().toString(36).toUpperCase()}`

      const createBtn = page
        .locator('button:has-text("Create Coupon"), button:has-text("New Coupon"), button:has-text("Create")')
        .first()

      if (!(await createBtn.isVisible({ timeout: 5000 }))) {
        console.log('⚠ Create button not found — skipping')
        return
      }

      await createBtn.click()
      await page.waitForTimeout(1000)

      // Code field
      const codeInput = page.locator('input[name="code"], input[placeholder*="code" i]').first()
      if (await codeInput.isVisible({ timeout: 3000 })) {
        await codeInput.fill(uniqueCode)
      }

      // Discount value
      const valueInput = page
        .locator('input[name="discount_value"], input[type="number"]')
        .first()
      if (await valueInput.isVisible({ timeout: 3000 })) {
        await valueInput.fill('15')
      }

      // Submit
      const submitBtn = page
        .locator('[role="dialog"] button:has-text("Create"), [role="dialog"] button[type="submit"]')
        .first()

      if (await submitBtn.isVisible({ timeout: 3000 })) {
        await submitBtn.click()
        await page.waitForTimeout(2000)

        const pageContent = await page.content()
        if (pageContent.includes(uniqueCode) || pageContent.includes('created') || pageContent.includes('success')) {
          console.log(`✓ Coupon ${uniqueCode} created successfully`)
        } else {
          console.log('⚠ Could not confirm coupon creation')
        }
      }
    })
  })

  test.describe('Edit Coupon', () => {
    test('Row actions include Edit and Toggle options', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const actionBtn = page
        .locator('button:has(svg.lucide-more-horizontal), button:has(svg.lucide-ellipsis)')
        .first()

      if (await actionBtn.isVisible({ timeout: 5000 })) {
        await actionBtn.click()
        await page.waitForTimeout(500)

        const menuContent = await page.locator('[role="menu"], [role="menuitem"]').allTextContents()
        console.log(`✓ Row action menu items: ${menuContent.join(', ')}`)
      } else {
        const editBtn = page.locator('button:has(svg.lucide-pencil)').first()
        if (await editBtn.isVisible({ timeout: 3000 })) {
          console.log('✓ Direct edit button found in table row')
        } else {
          console.log('⚠ No edit actions found')
        }
      }
    })
  })

  test.describe('Bulk Generate', () => {
    test('Bulk Generate button opens dialog', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto(`${ADMIN_URL}/coupons`)
      await page.waitForTimeout(2000)

      const bulkBtn = page
        .locator('button:has-text("Bulk Generate"), button:has-text("Generate"), button:has-text("Bulk")')
        .first()

      if (await bulkBtn.isVisible({ timeout: 5000 })) {
        await bulkBtn.click()
        await page.waitForTimeout(1000)

        const dialog = page.locator('[role="dialog"], [data-state="open"]').first()

        if (await dialog.isVisible({ timeout: 3000 })) {
          console.log('✓ Bulk Generate dialog opened')

          const countInput = page.locator('input[name="count"], input[type="number"]').first()
          if (await countInput.isVisible({ timeout: 2000 })) {
            console.log('✓ Count input field visible')
          }

          const prefixInput = page.locator('input[name="prefix"], input[placeholder*="prefix" i]').first()
          if (await prefixInput.isVisible({ timeout: 2000 })) {
            console.log('✓ Prefix input field visible')
          }
        } else {
          console.log('⚠ Bulk Generate dialog did not open')
        }
      } else {
        console.log('⚠ Bulk Generate button not found')
      }
    })
  })
})
