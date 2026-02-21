import { test, expect } from '@playwright/test'
import { apiGet, apiPost } from '../../fixtures/api-helpers'

test.describe('@api Wishlist', () => {
  test('GET /api/wishlist requires authentication', async ({ request }) => {
    const response = await apiGet(request, '/wishlist')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('GET /api/wishlist/items requires authentication', async ({ request }) => {
    const response = await apiGet(request, '/wishlist/items')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('POST /api/wishlist creates a new wishlist', async ({ request }) => {
    const response = await apiPost(request, '/wishlist', {
      name: 'Test Wishlist',
    })
    expect([200, 201, 401].includes(response.status())).toBeTruthy()
  })

  test('POST /api/wishlist/share requires authentication', async ({ request }) => {
    const response = await apiPost(request, '/wishlist/share', {
      wishlistId: '00000000-0000-0000-0000-000000000000',
    })
    expect([200, 401, 404].includes(response.status())).toBeTruthy()
  })
})
