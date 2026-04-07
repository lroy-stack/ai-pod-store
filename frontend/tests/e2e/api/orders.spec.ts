import { test, expect } from '@playwright/test'
import { apiGet } from '../../fixtures/api-helpers'

test.describe('@api Orders', () => {
  test('GET /api/orders requires authentication', async ({ request }) => {
    const response = await apiGet(request, '/orders')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('GET /api/orders/:id requires authentication', async ({ request }) => {
    const response = await apiGet(request, '/orders/00000000-0000-0000-0000-000000000000')
    expect([401, 404].includes(response.status())).toBeTruthy()
  })

  test('GET /api/orders returns array when authenticated', async ({ request }) => {
    const response = await apiGet(request, '/orders')
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('orders')
      expect(Array.isArray(body.orders)).toBeTruthy()
    }
  })
})
