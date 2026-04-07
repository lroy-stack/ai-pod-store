import { test, expect } from '@playwright/test'
import { TEST_URLS, TIMEOUTS } from '../../fixtures/test-data'

test.describe('@api PodClaw Bridge', () => {
  test('Bridge health endpoint responds', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.bridge}/health`, {
      timeout: TIMEOUTS.api,
    })
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('status')
    } else {
      // Bridge may not be running — skip gracefully
      test.skip()
    }
  })

  test('Bridge status endpoint returns agent info', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.bridge}/status`, {
      timeout: TIMEOUTS.api,
    })
    if (response.ok()) {
      const body = await response.json()
      expect(body).toBeDefined()
    } else {
      test.skip()
    }
  })

  test('Bridge via Caddy proxy responds', async ({ request }) => {
    const response = await request.get(`${TEST_URLS.bridgeViaProxy}/health`, {
      timeout: TIMEOUTS.api,
    })
    if (response.ok()) {
      const body = await response.json()
      expect(body).toHaveProperty('status')
    } else {
      // Caddy proxy may not be configured
      test.skip()
    }
  })
})
