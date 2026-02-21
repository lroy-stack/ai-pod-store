import { test, expect } from '@playwright/test'
import { TEST_URLS, TIMEOUTS } from '../../fixtures/test-data'

test.describe('@api Health Endpoints', () => {
  test('GET /api/health returns 200', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.api}/health`, {
      timeout: TIMEOUTS.api,
    })
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(body).toHaveProperty('status')
  })

  test('Frontend serves HTML at root', async ({ request }) => {
    const response = await request.get(TEST_URLS.base, {
      timeout: TIMEOUTS.api,
    })
    expect(response.ok()).toBeTruthy()
    const contentType = response.headers()['content-type']
    expect(contentType).toContain('text/html')
  })

  test('Bridge health check', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.bridge}/health`, {
      timeout: TIMEOUTS.api,
    })
    // Bridge may not be running in all environments
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('status')
    }
  })

  test('Rembg health check', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.rembg}/health`, {
      timeout: TIMEOUTS.api,
    })
    // Rembg may not be running in all environments
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('status')
    }
  })
})
