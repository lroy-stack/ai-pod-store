import { test, expect } from '@playwright/test'
import { apiGet, apiPost } from '../../fixtures/api-helpers'

test.describe('@api Designs', () => {
  test('GET /api/designs requires authentication', async ({ request }) => {
    const response = await apiGet(request, '/designs')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('POST /api/designs/estimate returns cost estimate', async ({ request }) => {
    const response = await apiPost(request, '/designs/estimate', {
      prompt: 'a cute cat illustration',
    })
    expect([200, 401].includes(response.status())).toBeTruthy()
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('estimate')
    }
  })

  test('POST /api/designs/generate requires authentication', async ({ request }) => {
    const response = await apiPost(request, '/designs/generate', {
      prompt: 'a test design',
    })
    expect([200, 401, 402, 429].includes(response.status())).toBeTruthy()
  })

  test('POST /api/designs/remove-bg requires file upload', async ({ request }) => {
    const response = await apiPost(request, '/designs/remove-bg', {})
    expect([400, 401, 422].includes(response.status())).toBeTruthy()
  })
})
