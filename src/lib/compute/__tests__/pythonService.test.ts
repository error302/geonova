/**
 * callPythonCompute bridge tests (audit C9 "make it work", 2026-08-31).
 *
 * The bridge was a stub that always returned 503 with `fallback: true`
 * ("decommissioned in favor of Edge WASM") while the FastAPI worker kept
 * running in docker-compose, unreachable. These tests pin the revived
 * behaviour:
 *   - unconfigured → honest 503, never a fabricated value, never "simulated"
 *   - task-mode and path-mode call conventions
 *   - worker secret header, auth failures, task failures, timeouts
 */
import { callPythonCompute } from '../pythonService'

const ORIGINAL_URL = process.env.PYTHON_COMPUTE_URL
const ORIGINAL_SECRET = process.env.WORKER_SECRET

const originalFetch = global.fetch

function mockFetchOnce(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  global.fetch = jest.fn(impl) as unknown as typeof fetch
}

describe('callPythonCompute (revived worker bridge)', () => {
  afterEach(() => {
    process.env.PYTHON_COMPUTE_URL = ORIGINAL_URL
    process.env.WORKER_SECRET = ORIGINAL_SECRET
    global.fetch = originalFetch
    jest.restoreAllMocks()
  })

  test('unconfigured worker → honest 503, no fabrication, no fallback flag', async () => {
    delete process.env.PYTHON_COMPUTE_URL
    const fetchSpy = jest.fn(async () => {
      throw new Error('fetch must not be called when the worker is unconfigured')
    })
    const original = global.fetch
    global.fetch = fetchSpy as unknown as typeof fetch
    try {
      const result = await callPythonCompute('gnss_process_rinex', {})
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.status).toBe(503)
        expect(result.error).toMatch(/not configured/i)
        expect(result.fallback).toBeUndefined()
      }
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      global.fetch = original
    }
  })

  test('task-name convention posts {task, params} to /compute with the secret header', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 's3cret'
    let capturedUrl = ''
    let capturedInit: RequestInit | undefined
    mockFetchOnce(async (url, init) => {
      capturedUrl = url
      capturedInit = init
      return new Response(JSON.stringify({ success: true, data: { answer: 42 } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const result = await callPythonCompute<{ answer: number }>('gnss_process_rinex', {
      rinex_obs: 'QUJD',
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.answer).toBe(42)
    expect(capturedUrl).toBe('http://worker:8000/compute')
    expect(capturedInit?.headers).toMatchObject({
      'X-Worker-Secret': 's3cret',
      'Content-Type': 'application/json',
    })
    const body = JSON.parse(String(capturedInit?.body)) as {
      task: string
      params: { rinex_obs: string }
    }
    expect(body).toEqual({ task: 'gnss_process_rinex', params: { rinex_obs: 'QUJD' } })
  })

  test('path convention posts the envelope body as-is to {url}{path}', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000/'
    process.env.WORKER_SECRET = 's3cret'
    let capturedUrl = ''
    let capturedBody = ''
    mockFetchOnce(async (url, init) => {
      capturedUrl = url
      capturedBody = String(init?.body)
      return new Response(JSON.stringify({ success: true, data: null }), { status: 200 })
    })

    const envelope = { task: 'gnss_baseline_process', params: { base_rinex: 'x' } }
    await callPythonCompute('/compute', envelope)

    expect(capturedUrl).toBe('http://worker:8000/compute')  // trailing slash normalised
    expect(JSON.parse(capturedBody)).toEqual(envelope)
  })

  test('worker task failure propagates verbatim (success=false)', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 's3cret'
    mockFetchOnce(async () =>
      new Response(
        JSON.stringify({ success: false, error: 'No ephemeris available: …' }),
        { status: 200 },
      ),
    )

    const result = await callPythonCompute('gnss_process_rinex', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/No ephemeris available/)
      expect(result.fallback).toBeUndefined()
    }
  })

  test('403 from the worker maps to an authentication error', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 'wrong'
    mockFetchOnce(async () =>
      new Response(JSON.stringify({ detail: 'Invalid worker secret' }), { status: 403 }),
    )

    const result = await callPythonCompute('gnss_process_rinex', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(502)
      expect(result.error).toMatch(/WORKER_SECRET/)
    }
  })

  test('network failure maps to an honest unreachable error', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 's3cret'
    mockFetchOnce(async () => {
      throw new Error('ECONNREFUSED')
    })

    const result = await callPythonCompute('gnss_process_rinex', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(502)
      expect(result.error).toMatch(/Could not reach the Python compute worker/)
    }
  })

  test('timeout aborts with a 504', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 's3cret'
    mockFetchOnce((_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      }),
    )

    const result = await callPythonCompute('gnss_process_rinex', {}, { timeoutMs: 20 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(504)
      expect(result.error).toMatch(/timed out/)
    }
  })

  test('HTTP error status without task envelope surfaces the worker detail', async () => {
    process.env.PYTHON_COMPUTE_URL = 'http://worker:8000'
    process.env.WORKER_SECRET = 's3cret'
    mockFetchOnce(async () =>
      new Response(JSON.stringify({ detail: 'Internal worker error' }), { status: 500 }),
    )

    const result = await callPythonCompute('gnss_process_rinex', {})
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(500)
      expect(result.error).toMatch(/Internal worker error/)
    }
  })
})
