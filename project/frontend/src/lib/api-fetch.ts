import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '@/lib/csrf'

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  return document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  )?.[1] ?? null
}

export { getCsrfToken }

export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers)
  const method = (init?.method ?? 'GET').toUpperCase()

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  return fetch(input, { ...init, headers })
}
