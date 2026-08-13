import { NextRequest } from 'next/server'

/**
 * Build a NextRequest against the local test server.
 *
 * Deduplicates the repeated `new NextRequest('http://localhost/api/...', …)`
 * construction scattered across route tests: the URL base, method/header
 * defaults, and object-vs-string body handling live here once.
 *
 * @param path API path (may include a query string), or a full http(s) URL.
 * @param init Optional method/headers/body — a plain object body is
 *   JSON.stringified automatically; pass a string to send it verbatim.
 */
export function makeRequest(
  path: string,
  init: {
    method?: string
    headers?: Record<string, string>
    body?: unknown
  } = {}
): NextRequest {
  const url = path.startsWith('http') ? path : `http://localhost${path}`
  return new NextRequest(url, {
    method: init.method ?? 'GET',
    headers: init.headers ?? {},
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === 'string'
          ? init.body
          : JSON.stringify(init.body),
  })
}
