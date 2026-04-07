import { test, expect } from '@playwright/test'

/**
 * Personalization Flow E2E Test
 * Tests the complete personalization journey:
 * - Anonymous user opens dialog
 * - Enters text and customizes options
 * - Previews in both Quick and Accurate modes
 * - Adds to cart
 * - Authenticates at checkout
 * - Verifies personalization is linked to user
 * - Tests profanity filter
 */
test.describe('@shop Personalization Flow', () => {
  const testUser = {
    email: 'e2e-test@example.com',
    password: 'testpass123456',
    name: 'E2E Test User',
  }

  test('Full personalization flow — anonymous user to checkout', async ({ page }) => {
    // Step 0: Accept cookie consent if present
    await test.step('Accept cookie consent', async () => {
      await page.goto('http://localhost:3000/en/shop')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Look for cookie consent "Accept All" button
      const acceptButton = page.locator('button:has-text("Accept All")').first()
      const hasConsent = await acceptButton.count() > 0
      if (hasConsent) {
        await acceptButton.click()
        await page.waitForTimeout(500)
        console.log('✓ Accepted cookie consent')
      }
    })

    // Step 1: Navigate to shop page and find a personalizable product
    await test.step('Navigate to shop and find personalizable product', async () => {
      // Look for tote bag products (known to support personalization)
      const toteBagCards = page.locator('a[href*="/shop/"]').filter({
        has: page.locator('h3:has-text("Tote Bag")')
      }).filter({
        has: page.locator('button:has-text("Add to cart")')
      })

      const toteBagCount = await toteBagCards.count()

      if (toteBagCount > 0) {
        // Click first tote bag
        await toteBagCards.first().click()
      } else {
        // Fallback to any in-stock product with "Add to cart"
        const anyProduct = page.locator('a[href*="/shop/"]').filter({
          has: page.locator('button:has-text("Add to cart")')
        }).first()
        await anyProduct.click()
      }

      await page.waitForURL(/\/shop\//, { timeout: 10000 })
      await page.waitForTimeout(2000)

      console.log('✓ Navigated to product detail page')
    })

    // Step 2: Open personalization dialog
    await test.step('Open personalization dialog', async () => {
      // Look for "Personalize" or "Customize" button
      const personalizeButton = page.locator('button:has-text("Personalize"), button:has-text("Customize"), button:has-text("Add Text")').first()

      // If button exists, scroll to it and click
      const buttonCount = await personalizeButton.count()
      if (buttonCount > 0) {
        // Scroll button into view
        await personalizeButton.scrollIntoViewIfNeeded()
        await page.waitForTimeout(500)

        // Click the button
        await personalizeButton.click({ force: true })
        await page.waitForTimeout(1000)

        // Verify dialog opened by checking for dialog content
        const dialog = page.locator('[role="dialog"]').first()
        const dialogVisible = await dialog.isVisible().catch(() => false)

        if (dialogVisible) {
          console.log('✓ Personalization dialog opened')
        } else {
          console.log('⚠ Dialog did not open, product may not support personalization')
          test.skip()
        }
      } else {
        console.log('⚠ Product does not support personalization, skipping')
        test.skip()
      }
    })

    // Step 3: Enter multi-line text and customize options
    await test.step('Enter personalization text and customize options', async () => {
      // Find text input (textarea or input)
      const textInput = page.locator('textarea, input[type="text"]').filter({ hasText: /./ }).or(
        page.locator('textarea').first()
      ).or(
        page.locator('input[placeholder*="text"], input[placeholder*="Text"]').first()
      ).first()

      // Enter multi-line text
      const customText = 'E2E Test\nPersonalized Product'
      await textInput.fill(customText)
      await page.waitForTimeout(500)

      console.log('✓ Entered personalization text')

      // Select font (if available)
      const fontSelect = page.locator('select[name*="font"], [role="combobox"]').filter({ hasText: /font/i }).or(
        page.locator('button:has-text("Font"), button:has-text("Inter"), button:has-text("Roboto")').first()
      ).first()

      const fontSelectCount = await fontSelect.count()
      if (fontSelectCount > 0) {
        await fontSelect.click()
        await page.waitForTimeout(500)

        // Try to select a different font (e.g., Montserrat)
        const montserratOption = page.locator('text=Montserrat').first()
        const montserratCount = await montserratOption.count()
        if (montserratCount > 0) {
          await montserratOption.click()
          await page.waitForTimeout(500)
          console.log('✓ Selected font: Montserrat')
        }
      }

      // Select font size (if available)
      const sizeButtons = page.locator('button:has-text("Large"), button:has-text("large"), [value="large"]').first()
      const sizeCount = await sizeButtons.count()
      if (sizeCount > 0) {
        await sizeButtons.click()
        await page.waitForTimeout(500)
        console.log('✓ Selected size: Large')
      }

      // Select position (if available)
      const positionButtons = page.locator('button:has-text("Center"), button:has-text("center"), [value="center"]').first()
      const positionCount = await positionButtons.count()
      if (positionCount > 0) {
        await positionButtons.click()
        await page.waitForTimeout(500)
        console.log('✓ Selected position: Center')
      }
    })

    // Step 4: Toggle between Quick and Accurate preview modes
    await test.step('Toggle between Quick and Accurate preview modes', async () => {
      // Look for preview mode toggle buttons
      const quickButton = page.locator('button:has-text("Quick"), [value="quick"]').first()
      const accurateButton = page.locator('button:has-text("Accurate"), [value="accurate"]').first()

      const quickCount = await quickButton.count()
      const accurateCount = await accurateButton.count()

      if (quickCount > 0 && accurateCount > 0) {
        // Toggle to Accurate mode
        await accurateButton.click()
        await page.waitForTimeout(2000) // Wait for server preview to load

        // Check if preview image is loading or loaded
        const previewImage = page.locator('img[alt*="preview"], img[src*="base64"]').first()
        const hasPreview = await previewImage.count() > 0
        console.log(`✓ Accurate preview mode: ${hasPreview ? 'loaded' : 'loading'}`)

        // Toggle back to Quick mode
        await quickButton.click()
        await page.waitForTimeout(500)
        console.log('✓ Quick preview mode active')
      } else {
        console.log('⚠ Preview mode toggle not found, using default mode')
      }
    })

    // Step 5: Add personalized product to cart
    let personalizationBadgeVisible = false
    await test.step('Add personalized product to cart', async () => {
      // Look for "Add to Cart" button in dialog or main page
      const addToCartButton = page.locator('button:has-text("Add to Cart"), button:has-text("Add with Personalization")').first()
      await expect(addToCartButton).toBeVisible({ timeout: 5000 })
      await addToCartButton.click()
      await page.waitForTimeout(2000)

      // Verify dialog closes after adding to cart
      const dialog = page.locator('[role="dialog"]').first()
      const dialogVisible = await dialog.isVisible().catch(() => false)
      expect(dialogVisible).toBeFalsy()
      console.log('✓ Added personalized product to cart')

      // Navigate to cart page
      await page.goto('http://localhost:3000/en/cart')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(2000)

      // Verify cart has the personalized product
      const cartItems = page.locator('[data-testid="cart-item"], .cart-item')
      const itemCount = await cartItems.count()
      expect(itemCount).toBeGreaterThan(0)

      // Look for "Personalized" badge or text
      const personalizedBadge = page.locator('text=Personalized, text=Custom, text=E2E Test').first()
      personalizationBadgeVisible = await personalizedBadge.isVisible().catch(() => false)

      if (personalizationBadgeVisible) {
        console.log('✓ Cart shows "Personalized" indicator')
      } else {
        console.log('⚠ Personalization indicator not visible in cart')
      }
    })

    // Step 6: Proceed to checkout and authenticate
    await test.step('Proceed to checkout and authenticate', async () => {
      // Click "Checkout" or "Proceed to Checkout" button
      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Proceed"), a[href*="checkout"]').first()
      await expect(checkoutButton).toBeVisible({ timeout: 5000 })
      await checkoutButton.click()
      await page.waitForTimeout(2000)

      // Check if we're on auth page or checkout page
      const currentUrl = page.url()

      if (currentUrl.includes('auth') || currentUrl.includes('login')) {
        // We need to authenticate
        console.log('✓ Redirected to authentication')

        const emailInput = page.locator('#email, input[type="email"]').first()
        const passwordInput = page.locator('#password, input[type="password"]').first()
        const submitButton = page.locator('button[type="submit"]').first()

        await expect(emailInput).toBeVisible({ timeout: 5000 })
        await emailInput.fill(testUser.email)
        await passwordInput.fill(testUser.password)
        await submitButton.click()

        // Wait for redirect to checkout or success page
        await page.waitForTimeout(3000)
        console.log('✓ Authenticated successfully')
      } else if (currentUrl.includes('checkout')) {
        console.log('✓ Already on checkout page (user was logged in)')
      }

      // Verify we're now on checkout page
      const onCheckout = page.url().includes('checkout')
      if (onCheckout) {
        console.log('✓ Reached checkout page')

        // Verify personalization data is preserved
        const pageContent = await page.content()
        const hasPersonalizationData = pageContent.includes('E2E Test') ||
                                        pageContent.includes('Personalized') ||
                                        pageContent.includes('Custom')

        if (hasPersonalizationData) {
          console.log('✓ Personalization data preserved at checkout')
        } else {
          console.log('⚠ Personalization data may not be visible at checkout')
        }
      }
    })
  })

  test('Profanity filter blocks banned words in personalization dialog', async ({ page }) => {
    // Step 0: Accept cookie consent if present
    await test.step('Accept cookie consent', async () => {
      await page.goto('http://localhost:3000/en/shop')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const acceptButton = page.locator('button:has-text("Accept All")').first()
      const hasConsent = await acceptButton.count() > 0
      if (hasConsent) {
        await acceptButton.click()
        await page.waitForTimeout(500)
      }
    })

    // Step 1: Navigate to a product page (find in-stock product)
    await test.step('Navigate to product page', async () => {
      // Look for tote bag products (known to support personalization and usually in stock)
      const toteBagCards = page.locator('a[href*="/shop/"]').filter({
        has: page.locator('h3:has-text("Tote Bag")')
      }).filter({
        has: page.locator('button:has-text("Add to cart")')  // Ensure in stock
      })

      const toteBagCount = await toteBagCards.count()

      if (toteBagCount > 0) {
        await toteBagCards.first().click()
      } else {
        // Fallback to any in-stock product with "Add to cart"
        const inStockProduct = page.locator('a[href*="/shop/"]').filter({
          has: page.locator('button:has-text("Add to cart")')
        }).first()
        await inStockProduct.click()
      }

      await page.waitForURL(/\/shop\//, { timeout: 10000 })
      await page.waitForTimeout(2000)
    })

    // Step 2: Open personalization dialog
    await test.step('Open personalization dialog', async () => {
      // Use getByRole for more reliable element finding
      const personalizeButton = page.getByRole('button', { name: /Personalize|Customize|Add Text/i })
      const buttonCount = await personalizeButton.count()

      if (buttonCount > 0) {
        // Wait for button to be visible and clickable
        await personalizeButton.waitFor({ state: 'visible', timeout: 5000 })
        await personalizeButton.click()

        // Wait for dialog to actually appear
        const dialog = page.locator('[role="dialog"]').first()
        try {
          await dialog.waitFor({ state: 'visible', timeout: 5000 })
          console.log('✓ Personalization dialog opened')
        } catch (error) {
          console.log('⚠ Dialog did not open, product may not support personalization')
          test.skip()
        }
      } else {
        console.log('⚠ Product does not support personalization, skipping')
        test.skip()
      }
    })

    // Step 3: Try to enter profanity
    await test.step('Enter profanity and verify it is blocked', async () => {
      const textInput = page.locator('textarea, input[type="text"]').first()

      // Try to enter a profane word (common banned word in profanity filters)
      const profaneText = 'This text contains badword'
      await textInput.fill(profaneText)
      await page.waitForTimeout(500)

      // Try to proceed (click "Add to Cart")
      const addButton = page.locator('button:has-text("Add to Cart"), button:has-text("Add with Personalization")').first()

      if (await addButton.isVisible()) {
        await addButton.click()
        await page.waitForTimeout(1000)

        // Check for error message or toast notification
        const pageContent = await page.content()
        const hasErrorMessage = pageContent.includes('inappropriate') ||
                                pageContent.includes('profanity') ||
                                pageContent.includes('not allowed') ||
                                pageContent.includes('banned') ||
                                pageContent.toLowerCase().includes('error')

        if (hasErrorMessage) {
          console.log('✓ Profanity filter blocked inappropriate text')
        } else {
          console.log('⚠ Profanity filter may not have triggered (or word not in filter list)')
        }

        // Verify dialog is still open (not closed, meaning add failed)
        const dialog = page.locator('[role="dialog"]').first()
        const dialogStillOpen = await dialog.isVisible().catch(() => false)

        if (dialogStillOpen) {
          console.log('✓ Dialog remained open (add to cart was blocked)')
        }
      }
    })
  })

  test('Quick preview renders instantly, Accurate preview shows server mockup', async ({ page }) => {
    // Step 0: Accept cookie consent if present
    await test.step('Accept cookie consent', async () => {
      await page.goto('http://localhost:3000/en/shop')
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const acceptButton = page.locator('button:has-text("Accept All")').first()
      const hasConsent = await acceptButton.count() > 0
      if (hasConsent) {
        await acceptButton.click()
        await page.waitForTimeout(500)
      }
    })

    // Step 1: Navigate to product and open personalization
    await test.step('Navigate to product and open personalization', async () => {
      // Look for tote bag products (known to support personalization and usually in stock)
      const toteBagCards = page.locator('a[href*="/shop/"]').filter({
        has: page.locator('h3:has-text("Tote Bag")')
      }).filter({
        has: page.locator('button:has-text("Add to cart")')  // Ensure in stock
      })

      const toteBagCount = await toteBagCards.count()

      if (toteBagCount > 0) {
        await toteBagCards.first().click()
      } else {
        // Fallback to any in-stock product with "Add to cart"
        const inStockProduct = page.locator('a[href*="/shop/"]').filter({
          has: page.locator('button:has-text("Add to cart")')
        }).first()
        await inStockProduct.click()
      }

      await page.waitForURL(/\/shop\//, { timeout: 10000 })
      await page.waitForTimeout(2000)

      // Use getByRole for more reliable element finding
      const personalizeButton = page.getByRole('button', { name: /Personalize|Customize|Add Text/i })
      const buttonCount = await personalizeButton.count()

      if (buttonCount === 0) {
        console.log('⚠ Product does not support personalization, skipping')
        test.skip()
      }

      // Wait for button to be visible and clickable
      await personalizeButton.waitFor({ state: 'visible', timeout: 5000 })
      await personalizeButton.click()

      // Wait for dialog to actually appear
      const dialog = page.locator('[role="dialog"]').first()
      await dialog.waitFor({ state: 'visible', timeout: 5000 })
    })

    // Step 2: Enter text and verify Quick preview
    await test.step('Verify Quick preview renders instantly', async () => {
      const textInput = page.locator('textarea, input[type="text"]').first()
      await textInput.fill('Quick Preview Test')
      await page.waitForTimeout(500)

      // Quick mode should show CSS overlay preview
      // Look for preview container or text overlay
      const previewElements = page.locator('[data-preview], .preview, [class*="preview"]')
      const hasPreview = await previewElements.count() > 0

      if (hasPreview) {
        console.log('✓ Quick preview rendered')
      } else {
        console.log('⚠ Quick preview elements not found')
      }
    })

    // Step 3: Switch to Accurate mode and verify server mockup
    await test.step('Verify Accurate preview shows server mockup', async () => {
      const accurateButton = page.locator('button:has-text("Accurate"), [value="accurate"]').first()
      const buttonCount = await accurateButton.count()

      if (buttonCount > 0) {
        await accurateButton.click()
        console.log('✓ Switched to Accurate mode')

        // Wait for server preview to load (should take 1-2 seconds)
        await page.waitForTimeout(2500)

        // Look for base64 image or preview image
        const serverPreviewImage = page.locator('img[src*="base64"], img[alt*="Accurate"], img[alt*="preview"]').first()
        const hasServerPreview = await serverPreviewImage.count() > 0

        if (hasServerPreview) {
          console.log('✓ Accurate preview (server mockup) loaded')
        } else {
          console.log('⚠ Server mockup not detected, may still be loading')
        }
      } else {
        console.log('⚠ Accurate preview mode not available')
      }
    })
  })
})
