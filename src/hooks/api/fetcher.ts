/**
 * Centralised fetch wrapper for API calls used by React Query hooks.
 *
 * - Automatically handles JSON parsing
 * - Redirects to /login on 401 responses
 * - Throws typed errors for React Query's error handling
 */

export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    throw new ApiError('Unauthorized', 401, 'UNAUTHORIZED')
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`
    let errorCode: string | undefined

    try {
      const body = (await response.json()) as { error?: string; code?: string }
      if (body.error) errorMessage = body.error
      if (body.code) errorCode = body.code
    } catch {
      // response body is not JSON — use default message
    }

    throw new ApiError(errorMessage, response.status, errorCode)
  }

  return response.json() as Promise<T>
}
