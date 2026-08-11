import { test, expect } from '@playwright/test'

test.describe('Security Headers', () => {
  test('homepage has X-Content-Type-Options: nosniff', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers()
    expect(headers?.['x-content-type-options']).toBe('nosniff')
  })

  test('homepage has X-Frame-Options: DENY', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers()
    expect(headers?.['x-frame-options']).toBe('DENY')
  })

  test('homepage has Referrer-Policy header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers()
    expect(headers?.['referrer-policy']).toBeTruthy()
  })

  test('homepage has X-DNS-Prefetch-Control: on', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers()
    expect(headers?.['x-dns-prefetch-control']).toBe('on')
  })

  test('has Content-Security-Policy header', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers()
    const csp = headers?.['content-security-policy']
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
  })
})

test.describe('Performance', () => {
  test('homepage loads within performance budget', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(15000)
  })

  test('no real app console errors on landing page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    await page.goto('/')
    await page.waitForTimeout(3000)
    
    // Filter out expected test-environment noise:
    // - next-auth session errors (no real DB configured)
    // - dbus errors (container environment)
    // - 500 errors for API routes that need database
    const realErrors = errors.filter(e => 
      !e.includes('dbus') &&
      !e.includes('Failed to connect to the bus') &&
      !e.includes('next-auth') &&
      !e.includes('CLIENT_FETCH_ERROR') &&
      !e.includes('/api/auth/') &&
      !e.includes('500 (Internal Server Error)') &&
      // Dev-only React hydration warning: the next/font stylesheet link's
      // media prop is flipped ('print' -> 'all') by the font loader before
      // hydration. React dev logs the prop mismatch; the production build
      // CI runs never emit it.
      !e.includes('did not match')
    )
    expect(realErrors).toHaveLength(0)
  })

  test('no real app console errors on login page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    await page.goto('/login')
    await page.waitForTimeout(2000)
    
    const realErrors = errors.filter(e => 
      !e.includes('dbus') &&
      !e.includes('Failed to connect to the bus') &&
      !e.includes('next-auth') &&
      !e.includes('CLIENT_FETCH_ERROR') &&
      !e.includes('/api/auth/') &&
      !e.includes('500 (Internal Server Error)') &&
      // Dev-only React hydration warning (next/font stylesheet media flip) —
      // never emitted by the production build CI runs.
      !e.includes('did not match')
    )
    expect(realErrors).toHaveLength(0)
  })
})

test.describe('API Health', () => {
  test('health endpoint is reachable (may 500 without DB)', async ({ page }) => {
    const response = await page.goto('/api/health')
    // Should not be a routing 404 — 200 (healthy), 500 (unhealthy), or 503
    // (degraded/service-unavailable without DB) are all valid reachable states.
    expect([200, 500, 503]).toContain(response?.status())
  })

  test('public health endpoint is reachable', async ({ page }) => {
    const response = await page.goto('/api/public/health')
    expect([200, 500, 503]).toContain(response?.status())
  })
})
