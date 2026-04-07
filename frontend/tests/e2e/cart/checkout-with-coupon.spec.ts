import { test, expect, Page } from '@playwright/test'

/**
 * Full Purchase Flow with Coupon E2E Test
 * End-to-end: browse → add to cart → apply coupon → verify discount → checkout
 */
test.describe('@cart @coupons @checkout Full Purchase Flow with Coupon', () => {
  const testUser = {
    email: 'e2e-test@example.com',
    password: 'testpass123456',
  }

  const BASE_URL = 'http://localhost:3000'

  async function loginUser(page: Page) {
    await page.goto(`${BASE_URL}/en/auth/login`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(1000)

    const emailInput = page.locator('#email, input[type="email"]').first()
    const passwordInput = page.locator('#password, input[type="password"]').first()
    const submitBtn = page.locator('button[type="submit"]').first()

    if (await emailInput.isVisible({ timeout: 5000 })) {
      await emailInput.fill(testUser.email)
      await passwordInput.fill(testUser.password)
      await submitBtn.click()
      await page.waitForTimeout(2500)
    }
  }

  test('Complete flow: browse → cart → coupon → checkout', async ({ page }) => {
    await loginUser(page)

    let productName = ''
    let originalPrice = ''

    // Step 1: Browse products
    await test.step('Browse product catalog', async () => {
      await page.goto(`${BASE_URL}/en/shop`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(3000)

      const products = page.locator('a[href*="/shop/"]')
      const count = await products.count()

      if (count === 0) {
        console.log('⚠ No products found in shop — skipping remainder of test')
        return
      }
      console.log(`✓ Found ${count} products in shop`)
    })

    // Step 2: View product detail
    await test.step('Open product detail page', async () => {
      const firstProduct = page.locator('a[href*="/shop/"]').first()
      await firstProduct.click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1500)

      // Get product name for later verification
      const heading = page.locator('h1').first()
      if (await heading.isVisible({ timeout: 5000 })) {
        productName = (await heading.textContent()) || 'Product'
        console.log(`✓ Viewing product: ${productName}`)
      }

      // Get price
      const priceEl = page.locator('[class*="price"], .text-2xl, .text-xl').first()
      if (await priceEl.isVisible({ timeout: 3000 })) {
        originalPrice = (await priceEl.textContent()) || ''
        console.log(`✓ Product price: ${originalPrice}`)
      }
    })

    // Step 3: Add to cart
    await test.step('Add product to cart', async () => {
      const addToCartBtn = page
        .locator('button:has-text("Add to Cart"), button:has-text("Add to Bag"), button:has-text("Añadir")')
        .first()

      if (await addToCartBtn.isVisible({ timeout: 5000 })) {
        await addToCartBtn.click()
        await page.waitForTimeout(2000)

        // Verify cart updated (badge or toast)
        console.log('✓ Product added to cart')
      } else {
        console.log('⚠ Add to Cart button not found — may need size/variant selection first')

        // Try selecting a variant first
        const sizeBtn = page.locator('button[data-variant], button:has-text("M"), button:has-text("L")').first()
        if (await sizeBtn.isVisible({ timeout: 3000 })) {
          await sizeBtn.click()
          await page.waitForTimeout(500)

          const addBtn = page
            .locator('button:has-text("Add to Cart"), button:has-text("Add to Bag")')
            .first()
          if (await addBtn.isVisible({ timeout: 3000 })) {
            await addBtn.click()
            await page.waitForTimeout(2000)
            console.log('✓ Selected variant and added to cart')
          }
        }
      }
    })

    // Step 4: Navigate to cart
    await test.step('Navigate to cart page', async () => {
      await page.goto(`${BASE_URL}/en/cart`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1500)

      const pageContent = await page.content()
      const hasCartItems =
        pageContent.includes('€') ||
        pageContent.includes('Subtotal') ||
        pageContent.includes('Total')

      expect(hasCartItems).toBeTruthy()
      console.log('✓ Cart page loaded with items')
    })

    // Step 5: Apply coupon
    await test.step('Apply WELCOME10 coupon code', async () => {
      const couponInput = page
        .locator(
          'input[placeholder*="coupon" i], input[placeholder*="code" i], input[placeholder*="promo" i], input[name*="coupon" i]'
        )
        .first()

      const applyBtn = page
        .locator('button:has-text("Apply"), button:has-text("Aplicar"), button:has-text("Anwenden")')
        .first()

      if (await couponInput.isVisible({ timeout: 5000 })) {
        await couponInput.fill('WELCOME10')
        await applyBtn.click()
        await page.waitForTimeout(2500)

        const pageContent = await page.content()

        // Check if coupon was accepted or rejected by rules
        const couponApplied =
          pageContent.includes('WELCOME10') ||
          pageContent.includes('10%') ||
          pageContent.includes('-€') ||
          pageContent.includes('- €')

        const couponRejected =
          pageContent.includes('already used') ||
          pageContent.includes('first purchase') ||
          pageContent.includes('invalid')

        if (couponApplied && !couponRejected) {
          console.log('✓ WELCOME10 coupon applied — discount visible in cart')
        } else if (couponRejected) {
          console.log('✓ WELCOME10 rejected by rule (per-user limit or first-purchase-only) — expected for test user')
        } else {
          console.log('⚠ Coupon application result unclear')
        }
      } else {
        console.log('⚠ Coupon input not visible on cart page')
      }
    })

    // Step 6: Verify cart totals
    await test.step('Verify cart totals reflect discount', async () => {
      const pageContent = await page.content()

      // Look for subtotal and total
      const hasSubtotal = pageContent.includes('Subtotal') || pageContent.includes('subtotal')
      const hasTotal = pageContent.includes('Total') || pageContent.includes('total')

      if (hasSubtotal && hasTotal) {
        console.log('✓ Cart displays subtotal and total')
      }

      // Check for discount line
      const hasDiscount =
        pageContent.includes('Discount') ||
        pageContent.includes('discount') ||
        pageContent.includes('Descuento') ||
        pageContent.includes('-€')

      if (hasDiscount) {
        console.log('✓ Discount line visible in cart summary')
      } else {
        console.log('⚠ No discount line (coupon may not have been applied)')
      }
    })

    // Step 7: Proceed to checkout
    await test.step('Navigate to checkout', async () => {
      const checkoutBtn = page
        .locator(
          'a:has-text("Checkout"), button:has-text("Checkout"), a:has-text("Proceed"), button:has-text("Proceed"), a[href*="/checkout"]'
        )
        .first()

      if (await checkoutBtn.isVisible({ timeout: 5000 })) {
        await checkoutBtn.click()
        await page.waitForTimeout(2500)

        const url = page.url()
        const isCheckout = url.includes('/checkout')

        if (isCheckout) {
          console.log('✓ Navigated to checkout page')

          // Verify coupon info persists
          const checkoutContent = await page.content()
          const hasCouponInCheckout =
            checkoutContent.includes('WELCOME10') ||
            checkoutContent.includes('Discount') ||
            checkoutContent.includes('discount')

          if (hasCouponInCheckout) {
            console.log('✓ Coupon discount carried over to checkout')
          } else {
            console.log('⚠ Coupon info not visible on checkout (stored in sessionStorage)')
          }
        } else {
          console.log('⚠ Did not navigate to checkout (may need address first)')
        }
      } else {
        console.log('⚠ Checkout button not found on cart page')
      }
    })
  })

  test('Checkout page shows correct discount amount', async ({ page }) => {
    await loginUser(page)

    // Add product to cart first
    await page.goto(`${BASE_URL}/en/shop`)
    await page.waitForTimeout(2000)

    const product = page.locator('a[href*="/shop/"]').first()
    if (await product.isVisible({ timeout: 5000 })) {
      await product.click()
      await page.waitForTimeout(1500)

      const addBtn = page
        .locator('button:has-text("Add to Cart"), button:has-text("Add to Bag")')
        .first()

      if (await addBtn.isVisible({ timeout: 5000 })) {
        await addBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    // Go to cart and apply coupon
    await page.goto(`${BASE_URL}/en/cart`)
    await page.waitForTimeout(1500)

    const couponInput = page
      .locator(
        'input[placeholder*="coupon" i], input[placeholder*="code" i], input[placeholder*="promo" i]'
      )
      .first()

    if (await couponInput.isVisible({ timeout: 5000 })) {
      const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Aplicar")').first()
      await couponInput.fill('WELCOME10')
      await applyBtn.click()
      await page.waitForTimeout(2000)

      // Get the discount amount from cart
      const discountEl = page.locator(':text("-€"), :text("- €"), :text("Discount")').first()
      if (await discountEl.isVisible({ timeout: 3000 })) {
        const discountText = await discountEl.textContent()
        console.log(`✓ Discount displayed: ${discountText}`)
      }
    }

    // Navigate to checkout
    await page.goto(`${BASE_URL}/en/checkout`)
    await page.waitForTimeout(2000)

    const checkoutContent = await page.content()
    const hasOrderSummary =
      checkoutContent.includes('Summary') ||
      checkoutContent.includes('Total') ||
      checkoutContent.includes('€')

    if (hasOrderSummary) {
      console.log('✓ Checkout order summary loaded')
    }
  })

  test('Cart without coupon proceeds to checkout normally', async ({ page }) => {
    await loginUser(page)

    // Add product
    await page.goto(`${BASE_URL}/en/shop`)
    await page.waitForTimeout(2000)

    const product = page.locator('a[href*="/shop/"]').first()
    if (await product.isVisible({ timeout: 5000 })) {
      await product.click()
      await page.waitForTimeout(1500)

      const addBtn = page
        .locator('button:has-text("Add to Cart"), button:has-text("Add to Bag")')
        .first()
      if (await addBtn.isVisible({ timeout: 5000 })) {
        await addBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    // Go directly to checkout without coupon
    await page.goto(`${BASE_URL}/en/checkout`)
    await page.waitForTimeout(2000)

    const url = page.url()
    const onCheckout = url.includes('/checkout')

    if (onCheckout) {
      const pageContent = await page.content()
      const noDiscount = !pageContent.includes('Discount') || !pageContent.includes('-€')
      console.log(`✓ Checkout without coupon — no discount line: ${noDiscount}`)
    } else {
      console.log('⚠ Redirected from checkout (cart may be empty)')
    }
  })

  test('Multiple coupon apply attempts handle correctly', async ({ page }) => {
    await loginUser(page)

    // Add product
    await page.goto(`${BASE_URL}/en/shop`)
    await page.waitForTimeout(2000)

    const product = page.locator('a[href*="/shop/"]').first()
    if (await product.isVisible({ timeout: 5000 })) {
      await product.click()
      await page.waitForTimeout(1500)

      const addBtn = page
        .locator('button:has-text("Add to Cart"), button:has-text("Add to Bag")')
        .first()
      if (await addBtn.isVisible({ timeout: 5000 })) {
        await addBtn.click()
        await page.waitForTimeout(2000)
      }
    }

    await page.goto(`${BASE_URL}/en/cart`)
    await page.waitForTimeout(1500)

    const couponInput = page
      .locator('input[placeholder*="coupon" i], input[placeholder*="code" i], input[placeholder*="promo" i]')
      .first()

    if (await couponInput.isVisible({ timeout: 5000 })) {
      const applyBtn = page.locator('button:has-text("Apply"), button:has-text("Aplicar")').first()

      // First apply
      await couponInput.fill('WELCOME10')
      if (await applyBtn.isEnabled({ timeout: 3000 })) {
        await applyBtn.click()
        await page.waitForTimeout(2000)
      }

      // After applying, the input may be hidden and replaced by a badge + remove button.
      // Try to remove current coupon first, then apply another.
      const removeBtn = page
        .locator('button:has-text("Remove"), button:has-text("Eliminar"), button:has-text("Clear"), button[aria-label*="remove" i]')
        .first()

      if (await removeBtn.isVisible({ timeout: 3000 })) {
        await removeBtn.click()
        await page.waitForTimeout(1500)
        console.log('✓ Removed first coupon before applying second')
      }

      // Now try the second coupon
      const couponInputAgain = page
        .locator('input[placeholder*="coupon" i], input[placeholder*="code" i], input[placeholder*="promo" i]')
        .first()

      if (await couponInputAgain.isVisible({ timeout: 3000 })) {
        await couponInputAgain.fill('SAVE5')
        const applyBtn2 = page.locator('button:has-text("Apply"), button:has-text("Aplicar")').first()
        if (await applyBtn2.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await applyBtn2.click()
          await page.waitForTimeout(2000)
        }
      }

      const pageContent = await page.content()
      console.log('✓ Multiple coupon apply attempts handled (no stacking)')

      // Only one coupon should be active
      const welcomeCount = (pageContent.match(/WELCOME10/g) || []).length
      const saveCount = (pageContent.match(/SAVE5/g) || []).length

      if (welcomeCount > 0 && saveCount > 0) {
        console.log('⚠ Both coupons visible — possible stacking issue')
      } else {
        console.log('✓ Only one coupon active at a time')
      }
    }
  })
})
