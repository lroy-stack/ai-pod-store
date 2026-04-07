import { APIRequestContext } from '@playwright/test'
import { TEST_URLS } from './test-data'

export async function apiGet(request: APIRequestContext, path: string) {
  return request.get(`${TEST_URLS.api}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function apiPost(request: APIRequestContext, path: string, data?: unknown) {
  return request.post(`${TEST_URLS.api}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    data,
  })
}

export async function apiDelete(request: APIRequestContext, path: string) {
  return request.delete(`${TEST_URLS.api}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function authenticatedRequest(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  token: string,
  data?: unknown
) {
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    data,
  }
  const url = `${TEST_URLS.api}${path}`

  switch (method) {
    case 'GET':
      return request.get(url, options)
    case 'POST':
      return request.post(url, options)
    case 'DELETE':
      return request.delete(url, options)
  }
}

export async function streamChat(request: APIRequestContext, messages: Array<{ role: string; content: string }>) {
  const response = await request.post(`${TEST_URLS.api}/chat`, {
    headers: { 'Content-Type': 'application/json' },
    data: { messages },
  })
  return response
}
