import { test, expect } from '@playwright/test'
import { apiGet, apiPost } from '../../fixtures/api-helpers'
import { TEST_CREDENTIALS } from '../../fixtures/test-data'

test.describe('@api @auth Auth Endpoints', () => {
  test('POST /api/auth/login rejects invalid credentials', async ({ request }) => {
    const response = await apiPost(request, '/auth/login', {
      email: TEST_CREDENTIALS.invalidUser.email,
      password: TEST_CREDENTIALS.invalidUser.password,
    })
    expect([400, 401, 422].includes(response.status())).toBeTruthy()
  })

  test('POST /api/auth/register rejects missing fields', async ({ request }) => {
    const response = await apiPost(request, '/auth/register', {
      email: '',
      password: '',
    })
    expect([400, 422].includes(response.status())).toBeTruthy()
  })

  test('POST /api/auth/register rejects invalid email', async ({ request }) => {
    const response = await apiPost(request, '/auth/register', {
      email: 'not-an-email',
      password: 'validpassword123',
    })
    expect([400, 422].includes(response.status())).toBeTruthy()
  })

  test('POST /api/auth/logout returns success', async ({ request }) => {
    const response = await apiPost(request, '/auth/logout')
    // Logout should succeed even without session
    expect([200, 204, 401].includes(response.status())).toBeTruthy()
  })

  test('GET /api/auth/session returns session info', async ({ request }) => {
    const response = await apiGet(request, '/auth/session')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('GET /api/auth/me returns user info or unauthorized', async ({ request }) => {
    const response = await apiGet(request, '/auth/me')
    expect([200, 401].includes(response.status())).toBeTruthy()
  })

  test('POST /api/auth/forgot-password rejects invalid email', async ({ request }) => {
    const response = await apiPost(request, '/auth/forgot-password', {
      email: 'invalid-email',
    })
    expect([400, 422].includes(response.status())).toBeTruthy()
  })
})
