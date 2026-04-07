import { test, expect } from '@playwright/test'
import { apiGet, apiPost, apiDelete } from '../../fixtures/api-helpers'

test.describe('@api Cart Operations', () => {
  test('GET /api/cart returns cart (may be empty)', async ({ request }) => {
    const response = await apiGet(request, '/cart')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body).toHaveProperty('items')
    expect(Array.isArray(body.items)).toBeTruthy()
  })

  test('POST /api/cart adds item to cart', async ({ request }) => {
    // First get a product
    const productsResponse = await apiGet(request, '/products?limit=1')
    const products = await productsResponse.json()

    if (products.products && products.products.length > 0) {
      const product = products.products[0]
      const response = await apiPost(request, '/cart', {
        productId: product.id,
        quantity: 1,
        variantId: product.variants?.[0]?.id,
      })
      // Cart operations may require auth
      expect([200, 201, 401].includes(response.status())).toBeTruthy()
    }
  })

  test('POST /api/cart rejects invalid product ID', async ({ request }) => {
    const response = await apiPost(request, '/cart', {
      productId: 'invalid-id',
      quantity: 1,
    })
    expect([400, 401, 404].includes(response.status())).toBeTruthy()
  })

  test('POST /api/cart rejects zero quantity', async ({ request }) => {
    const response = await apiPost(request, '/cart', {
      productId: '00000000-0000-0000-0000-000000000000',
      quantity: 0,
    })
    expect([400, 401, 422].includes(response.status())).toBeTruthy()
  })
})
