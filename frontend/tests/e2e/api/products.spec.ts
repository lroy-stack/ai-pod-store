import { test, expect } from '@playwright/test'
import { apiGet } from '../../fixtures/api-helpers'

test.describe('@api Products', () => {
  test('GET /api/products returns product list', async ({ request }) => {
    const response = await apiGet(request, '/products')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body).toHaveProperty('products')
    expect(Array.isArray(body.products)).toBeTruthy()
  })

  test('GET /api/products supports pagination', async ({ request }) => {
    const response = await apiGet(request, '/products?page=1&limit=4')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body.products.length).toBeLessThanOrEqual(4)
  })

  test('GET /api/products supports search query', async ({ request }) => {
    const response = await apiGet(request, '/products?q=tote')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body).toHaveProperty('products')
  })

  test('GET /api/products supports category filter', async ({ request }) => {
    const response = await apiGet(request, '/products?category=bags')
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body).toHaveProperty('products')
  })

  test('GET /api/products/:id returns single product', async ({ request }) => {
    // First get a product ID from the list
    const listResponse = await apiGet(request, '/products?limit=1')
    const listBody = await listResponse.json()

    if (listBody.products && listBody.products.length > 0) {
      const productId = listBody.products[0].id
      const response = await apiGet(request, `/products/${productId}`)
      expect(response.ok()).toBeTruthy()
      const body = await response.json()
      expect(body).toHaveProperty('id', productId)
    }
  })

  test('GET /api/products/:id returns 404 for non-existent product', async ({ request }) => {
    const response = await apiGet(request, '/products/00000000-0000-0000-0000-000000000000')
    expect(response.status()).toBe(404)
  })
})
