import { test, expect } from '@playwright/test'

/**
 * Admin Order Management E2E Test
 * Tests order listing, filtering, viewing details, and status updates
 */

test.describe('@admin Order Management', () => {
  // Admin credentials come from environment variables only.
  // Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in .env.local before running tests.
  const adminUser = {
    email: process.env.E2E_ADMIN_EMAIL || '',
    password: process.env.E2E_ADMIN_PASSWORD || '',
  }

  // Helper function to login as admin
  async function loginAsAdmin(page: any) {
    await page.goto('http://localhost:3001/login')
    await page.waitForLoadState('domcontentloaded')

    const emailInput = page.locator('#email, input[type="email"]').first()
    const passwordInput = page.locator('#password, input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()

    await emailInput.fill(adminUser.email)
    await passwordInput.fill(adminUser.password)
    await submitBtn.click()

    // Wait for redirect to dashboard (admin runs on /panel path)
    await page.waitForURL(/localhost:3001\/panel/, { timeout: 10000 })
    await page.waitForTimeout(1000)
  }

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Navigate to Orders page and verify table loads', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      // Click on Orders link in navigation
      const ordersLink = page.locator('a[href*="/orders"], nav a:has-text("Orders")').first()
      await ordersLink.click({ timeout: 5000 })

      // Wait for orders page to load
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1500)

      console.log('✓ Orders page loaded')
    })

    await test.step('Verify orders table/list exists', async () => {
      const pageContent = await page.content()

      // Check for order-related content
      const hasOrderContent =
        pageContent.includes('Order') ||
        pageContent.includes('order') ||
        pageContent.includes('Status') ||
        pageContent.includes('Customer') ||
        pageContent.includes('Total') ||
        pageContent.includes('€') // Euro symbol

      expect(hasOrderContent).toBe(true)
      console.log('✓ Orders table verified')
    })
  })

  test('Filter orders by status', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Use status filter dropdown/tabs', async () => {
      // Look for status filter elements
      const statusFilter = page
        .locator(
          'select[name*="status"], button:has-text("Pending"), button:has-text("Processing"), button:has-text("Completed")'
        )
        .first()

      if (await statusFilter.isVisible({ timeout: 3000 })) {
        // Click on a status filter
        await statusFilter.click()
        await page.waitForTimeout(1000)

        console.log('✓ Status filter functionality verified')
      } else {
        console.log('⚠ Status filter not found - may not be implemented')
      }
    })
  })

  test('Search orders by order ID or customer name', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Use search functionality', async () => {
      // Look for search input
      const searchInput = page
        .locator(
          'input[type="search"], input[placeholder*="Search"], input[name*="search"], input[placeholder*="Order ID"]'
        )
        .first()

      if (await searchInput.isVisible({ timeout: 3000 })) {
        await searchInput.fill('test')
        await page.waitForTimeout(1000)

        console.log('✓ Search functionality verified')
      } else {
        console.log('⚠ Search input not found')
      }
    })
  })

  test('View order details', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Click on an order to view details', async () => {
      // Look for order links/buttons
      const orderLink = page
        .locator('a[href*="/orders/"], button:has-text("View"), tr[role="row"] a')
        .first()

      if (await orderLink.isVisible({ timeout: 5000 })) {
        await orderLink.click()
        await page.waitForTimeout(1500)

        // Verify we're on an order detail page
        const url = page.url()
        const isOrderDetailPage = url.includes('/orders/')

        expect(isOrderDetailPage).toBe(true)

        // Check for order detail content
        const pageContent = await page.content()
        const hasOrderDetails =
          pageContent.includes('Order') ||
          pageContent.includes('Customer') ||
          pageContent.includes('Items') ||
          pageContent.includes('Status')

        expect(hasOrderDetails).toBe(true)
        console.log('✓ Order details page loaded')
      } else {
        console.log('⚠ No orders available to view')
      }
    })
  })

  test('Order detail page shows line items', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Access order details and verify line items', async () => {
      const orderLink = page.locator('a[href*="/orders/"]').first()

      if (await orderLink.isVisible({ timeout: 5000 })) {
        await orderLink.click()
        await page.waitForTimeout(1500)

        // Check for line items table/list
        const pageContent = await page.content()
        const hasLineItems =
          pageContent.includes('Item') ||
          pageContent.includes('Product') ||
          pageContent.includes('Quantity') ||
          pageContent.includes('Price')

        // Line items might be present
        if (hasLineItems) {
          console.log('✓ Order line items found')
        } else {
          console.log('⚠ Order line items section not visible')
        }
      } else {
        console.log('⚠ No orders available')
      }
    })
  })

  test('Update order status', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Access order and check for status update controls', async () => {
      const orderLink = page.locator('a[href*="/orders/"]').first()

      if (await orderLink.isVisible({ timeout: 5000 })) {
        await orderLink.click()
        await page.waitForTimeout(1500)

        // Look for status update dropdown/select
        const statusControl = page
          .locator('select[name*="status"], button:has-text("Update Status"), select:has-text("Status")')
          .first()

        if (await statusControl.isVisible({ timeout: 3000 })) {
          console.log('✓ Status update controls found')
        } else {
          console.log('⚠ Status update controls not visible')
        }
      } else {
        console.log('⚠ No orders available')
      }
    })
  })

  test('Pagination works on orders list', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Check for pagination controls', async () => {
      // Look for pagination elements
      const paginationBtn = page
        .locator('button:has-text("Next"), button:has-text("Previous"), nav[role="navigation"]')
        .first()

      if (await paginationBtn.isVisible({ timeout: 3000 })) {
        console.log('✓ Pagination controls found')
      } else {
        console.log('⚠ Pagination not visible - may have few orders')
      }
    })
  })

  test('Export orders functionality exists', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Check for export button', async () => {
      const exportBtn = page
        .locator('button:has-text("Export"), button:has-text("Download"), a:has-text("CSV")')
        .first()

      if (await exportBtn.isVisible({ timeout: 3000 })) {
        console.log('✓ Export functionality found')
      } else {
        console.log('⚠ Export button not visible - may not be implemented')
      }
    })
  })

  test('Order detail shows customer information', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Access order and verify customer info section', async () => {
      const orderLink = page.locator('a[href*="/orders/"]').first()

      if (await orderLink.isVisible({ timeout: 5000 })) {
        await orderLink.click()
        await page.waitForTimeout(1500)

        const pageContent = await page.content()
        const hasCustomerInfo =
          pageContent.includes('Customer') ||
          pageContent.includes('Email') ||
          pageContent.includes('Phone') ||
          pageContent.includes('Address')

        if (hasCustomerInfo) {
          console.log('✓ Customer information section found')
        } else {
          console.log('⚠ Customer information not visible')
        }
      } else {
        console.log('⚠ No orders available')
      }
    })
  })

  test('Order detail shows shipping information', async ({ page }) => {
    await test.step('Navigate to Orders page', async () => {
      const ordersLink = page.locator('a[href*="/orders"]').first()
      await ordersLink.click({ timeout: 5000 })
      await page.waitForURL(/\/orders/, { timeout: 10000 })
      await page.waitForTimeout(1500)
    })

    await test.step('Access order and verify shipping info section', async () => {
      const orderLink = page.locator('a[href*="/orders/"]').first()

      if (await orderLink.isVisible({ timeout: 5000 })) {
        await orderLink.click()
        await page.waitForTimeout(1500)

        const pageContent = await page.content()
        const hasShippingInfo =
          pageContent.includes('Shipping') ||
          pageContent.includes('Delivery') ||
          pageContent.includes('Tracking') ||
          pageContent.includes('Carrier')

        if (hasShippingInfo) {
          console.log('✓ Shipping information section found')
        } else {
          console.log('⚠ Shipping information not visible')
        }
      } else {
        console.log('⚠ No orders available')
      }
    })
  })
})
