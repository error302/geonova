/* eslint-disable no-console */
/**
 * Self-check for the API client.
 * ponytail: one runnable check, the smallest thing that fails if logic breaks.
 * Run:  npx tsx src/lib/api/__tests__/client.selfcheck.ts
 */

import { api, apiGet, apiPost, apiDelete, apiInvalidate, apiInvalidateAll, ApiError } from '../client'
import { z } from 'zod'
import assert from 'node:assert'

const ProjectSchema = z.object({ id: z.string(), name: z.string() })
type Project = z.infer<typeof ProjectSchema>

const origFetch = globalThis.fetch

function installMock(opts: { status: number; body: unknown; headers?: Record<string, string> }) {
  globalThis.fetch = (async (_input: RequestInfo | URL, _init?: RequestInit) => {
    // ponytail: 204 No Content MUST NOT have a body per HTTP spec
    if (opts.status === 204) {
      return new Response(null, {
        status: 204,
        headers: { 'Content-Type': 'application/json', ...opts.headers },
      })
    }
    return new Response(JSON.stringify(opts.body), {
      status: opts.status,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    })
  }) as typeof fetch
}

function restoreFetch() { globalThis.fetch = origFetch }

let pass = 0
let fail = 0
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    const r = fn()
    if (r instanceof Promise) await r
    pass++
    console.log(`   ${name}`)
  } catch (err) {
    fail++
    console.error(`   ${name}: ${(err as Error).message}`)
  }
}

async function main() {
  console.log('API client self-check\n')

  await check('200 OK with valid schema returns parsed body', async () => {
    installMock({ status: 200, body: { id: 'p1', name: 'FR 583' } })
    const result = await api('/api/projects/p1', ProjectSchema)
    assert.equal(result.id, 'p1')
    assert.equal(result.name, 'FR 583')
    restoreFetch()
  })

  await check('204 No Content returns undefined', async () => {
    installMock({ status: 204, body: null })
    const result = await api<null | undefined>('/api/projects/p1', z.null().optional())
    assert.equal(result, undefined)
    restoreFetch()
  })

  await check('401 throws ApiError with code UNAUTHORIZED', async () => {
    installMock({ status: 401, body: { error: 'Authentication required', code: 'UNAUTHORIZED' } })
    await assert.rejects(
      () => api('/api/projects/p1', ProjectSchema),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.status, 401)
        assert.equal(err.code, 'UNAUTHORIZED')
        assert.equal(err.isUnauthorized, true)
        return true
      },
    )
    restoreFetch()
  })

  await check('400 VALIDATION_ERROR includes issues array', async () => {
    installMock({
      status: 400,
      body: { error: 'Validation failed', code: 'VALIDATION_ERROR',
              issues: [{ path: ['name'], message: 'Required' }] },
    })
    await assert.rejects(
      () => api('/api/projects', ProjectSchema, { method: 'POST', body: {} as BodyInit }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.code, 'VALIDATION_ERROR')
        assert.ok(err.issues && err.issues.length > 0)
        assert.equal(err.isValidation, true)
        return true
      },
    )
    restoreFetch()
  })

  await check('Response schema mismatch throws ApiError', async () => {
    installMock({ status: 200, body: { id: 'p1' } })
    await assert.rejects(
      () => api('/api/projects/p1', ProjectSchema),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.code, 'INTERNAL_ERROR')
        assert.match(err.message, /schema mismatch/)
        return true
      },
    )
    restoreFetch()
  })

  await check('apiGet caches responses within TTL', async () => {
    let callCount = 0
    globalThis.fetch = (async () => {
      callCount++
      return new Response(JSON.stringify({ id: 'p1', name: `call-${callCount}` }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    apiInvalidateAll()
    const r1 = await apiGet('/api/projects/p1', ProjectSchema, { ttlMs: 5000 })
    const r2 = await apiGet('/api/projects/p1', ProjectSchema, { ttlMs: 5000 })
    assert.equal(callCount, 1)
    assert.deepEqual(r1, r2)
    restoreFetch()
  })

  await check('apiInvalidate forces next apiGet to re-fetch', async () => {
    let callCount = 0
    globalThis.fetch = (async () => {
      callCount++
      return new Response(JSON.stringify({ id: 'p1', name: 'X' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    apiInvalidateAll()
    await apiGet('/api/projects/p2', ProjectSchema, { ttlMs: 5000 })
    apiInvalidate('/api/projects/p2')
    await apiGet('/api/projects/p2', ProjectSchema, { ttlMs: 5000 })
    assert.equal(callCount, 2)
    restoreFetch()
  })

  await check('apiPost sends JSON body with Content-Type header', async () => {
    let capturedInit: RequestInit | undefined
    globalThis.fetch = (async (_input, init) => {
      capturedInit = init
      return new Response(JSON.stringify({ id: 'p2', name: 'new' }), {
        status: 201, headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof fetch
    await apiPost('/api/projects', ProjectSchema, { name: 'new' })
    assert.equal(capturedInit?.method, 'POST')
    assert.equal((capturedInit?.headers as Record<string, string>)?.['Content-Type'], 'application/json')
    assert.equal(capturedInit?.body, JSON.stringify({ name: 'new' }))
    restoreFetch()
  })

  await check('apiDelete without schema accepts 204', async () => {
    installMock({ status: 204, body: null })
    await apiDelete('/api/projects/p3')
    restoreFetch()
  })

  await check('Server with no code field falls back to status-based guess', async () => {
    installMock({ status: 404, body: { error: 'Not found' } })
    await assert.rejects(
      () => api('/api/projects/missing', ProjectSchema),
      (err: unknown) => {
        assert.ok(err instanceof ApiError)
        assert.equal(err.code, 'NOT_FOUND')
        assert.equal(err.isNotFound, true)
        return true
      },
    )
    restoreFetch()
  })

  console.log(`\n${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((err) => { console.error('Self-check crashed:', err); process.exit(1) })
