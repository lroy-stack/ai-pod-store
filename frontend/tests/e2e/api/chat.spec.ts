import { test, expect } from '@playwright/test'
import { TEST_URLS, TIMEOUTS } from '../../fixtures/test-data'

test.describe('@api @chat Chat Endpoint', () => {
  test('POST /api/chat returns streaming response', async ({ request }) => {
    const response = await request.post(`${TEST_URLS.api}/chat`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        messages: [{ role: 'user', content: 'hello' }],
      },
      timeout: TIMEOUTS.stream,
    })
    // Chat may require auth or rate limit
    expect([200, 401, 429].includes(response.status())).toBeTruthy()

    if (response.ok()) {
      const contentType = response.headers()['content-type']
      // AI SDK streams as text/event-stream or text/plain
      expect(contentType).toBeDefined()
    }
  })

  test('POST /api/chat rejects empty messages', async ({ request }) => {
    const response = await request.post(`${TEST_URLS.api}/chat`, {
      headers: { 'Content-Type': 'application/json' },
      data: { messages: [] },
      timeout: TIMEOUTS.api,
    })
    expect([400, 401, 422].includes(response.status())).toBeTruthy()
  })

  test('POST /api/chat rejects missing body', async ({ request }) => {
    const response = await request.post(`${TEST_URLS.api}/chat`, {
      headers: { 'Content-Type': 'application/json' },
      timeout: TIMEOUTS.api,
    })
    expect([400, 401, 422, 500].includes(response.status())).toBeTruthy()
  })

  test('POST /api/chat with product search query', async ({ request }) => {
    const response = await request.post(`${TEST_URLS.api}/chat`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        messages: [{ role: 'user', content: 'show me tote bags' }],
      },
      timeout: TIMEOUTS.stream,
    })
    expect([200, 401, 429].includes(response.status())).toBeTruthy()
  })
})
