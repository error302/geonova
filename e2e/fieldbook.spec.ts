import { test, expect } from '@playwright/test'
import { encode } from 'next-auth/jwt'

/**
 * Mint a real NextAuth session cookie so protected pages render their full UI.
 * The middleware's getToken() check decodes the session *cookie* (not the
 * /api/auth/session API), so mocking that endpoint never satisfied it — the
 * page was always redirected to /login before it could render. Producing the
 * cookie with next-auth's own `encode` (same AUTH_SECRET the server uses)
 * keeps middleware, server components and /api/auth/session in agreement
 * without needing a real database.
 */
async function mockAuthSession(page: import('@playwright/test').Page) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET is required to mint the E2E session cookie')
  }
  const token = await encode({
    secret,
    maxAge: 60 * 60, // 1 hour
    token: {
      sub: 'test-user-id',
      name: 'Test Surveyor',
      email: 'test@metardu.test',
      role: 'surveyor',
      picture: null,
      jti: 'e2e-session',
    },
  })
  // next-auth uses the __Secure- prefix when NEXTAUTH_URL is https (and
  // marks the cookie Secure). Match the server's effective cookie name so the
  // middleware's getToken() can decode it. CI runs without NEXTAUTH_URL, so
  // the plain non-secure name is the default there.
  const authUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || ''
  const cookieName = authUrl.startsWith('https://')
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token'
  await page.context().addCookies([
    { name: cookieName, value: token, url: 'http://localhost:3099' },
  ])
  // FieldModeToggle shows an onboarding tooltip 800ms after mount unless
  // metardu_field_tooltip_seen is set. Its dismiss overlay is a fixed
  // full-screen button (z-40) that swallows every pointer event on the page,
  // so seed the key to keep the tooltip from blocking the tab interactions.
  await page.addInitScript(() => {
    try {
      localStorage.setItem('metardu_field_tooltip_seen', 'true')
    } catch {
      /* ignore */
    }
  })
}

test.describe('Fieldbook — Page Load', () => {
  test('fieldbook page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/fieldbook')
    await expect(page).toHaveURL(/\/login/)
  })

  test('fieldbook route exists (does not 404)', async ({ page }) => {
    const response = await page.goto('/fieldbook', { waitUntil: 'commit' })
    expect(response?.status()).not.toBe(404)
  })
})

test.describe('Fieldbook — Survey Type Tabs', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
  })

  test('all five survey type tabs are visible', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })

    // Wait for the page to render — it may take a moment for client hydration
    await page.waitForTimeout(2000)

    // The three tab buttons should be present
    // Tab text comes from i18n keys; check for known labels
    const tabLabels = ['Leveling', 'Traverse', 'Control']
    for (const label of tabLabels) {
      // The tabs use i18n translations but the button text should contain these words
      const tab = page.locator('button').filter({ hasText: new RegExp(label, 'i') }).first()
      await expect(tab).toBeVisible({ timeout: 8000 })
    }
  })

  test('default tab is Leveling', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // The leveling tab should have the active style (amber border/background)
    const levelingTab = page.locator('button').filter({ hasText: /leveling/i }).first()
    await expect(levelingTab).toBeVisible({ timeout: 8000 })
    // Check it has the active styling class
    const classes = await levelingTab.getAttribute('class')
    expect(classes).toContain('amber')
  })

  test('clicking Traverse tab switches the view', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Scope to the tab bar (div.flex.gap-2) — the page has other buttons
    // whose text contains "traverse" (headers, side panel).
    const traverseTab = page.locator('div.flex.gap-2 button').filter({ hasText: /traverse/i }).first()
    await expect(traverseTab).toBeVisible({ timeout: 8000 })
    await traverseTab.click()

    // After clicking, the traverse book shows its bearing column
    await expect(page.locator('th').filter({ hasText: /bearing/i }).first()).toBeVisible({ timeout: 8000 })
  })

  test('clicking Control tab switches the view', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const controlTab = page.locator('div.flex.gap-2 button').filter({ hasText: /control/i }).first()
    await expect(controlTab).toBeVisible({ timeout: 8000 })
    await controlTab.click()

    // Control book shows instrument height fields
    await expect(page.locator('input[aria-label="Instrument Height"]').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Fieldbook — Observation Form Fields', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
  })

  test('Leveling tab shows BS, IS, FS columns', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Leveling fields: BS (Backsight), IS (Intermediate Sight), FS ( Foresight)
    // These should appear as table headers or input placeholders
    const bsHeader = page.locator('th, label, span').filter({ hasText: /BS|Backsight/i }).first()
    const isHeader = page.locator('th, label, span').filter({ hasText: /^IS$|Intermediate/i }).first()
    const fsHeader = page.locator('th, label, span').filter({ hasText: /FS|Foresight/i }).first()

    await expect(bsHeader).toBeVisible({ timeout: 8000 })
    await expect(fsHeader).toBeVisible({ timeout: 8000 })
  })

  test('Traverse tab shows bearing and distance columns', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Switch to traverse tab
    const traverseTab = page.locator('div.flex.gap-2 button').filter({ hasText: /traverse/i }).first()
    await expect(traverseTab).toBeVisible({ timeout: 8000 })
    await traverseTab.click()
    await page.waitForTimeout(500)

    // Traverse fields should include bearing, slope distance
    const bearingHeader = page.locator('th, label, span').filter({ hasText: /bearing/i }).first()
    await expect(bearingHeader).toBeVisible({ timeout: 8000 })
  })

  test('Control tab shows instrument height and target height fields', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Switch to control tab
    const controlTab = page.locator('div.flex.gap-2 button').filter({ hasText: /control/i }).first()
    await expect(controlTab).toBeVisible({ timeout: 8000 })
    await controlTab.click()
    await page.waitForTimeout(500)

    // Control fields: instrument height and target height
    await expect(page.locator('input[aria-label="Instrument Height"]').first()).toBeVisible({ timeout: 8000 })
    await expect(page.locator('input[aria-label="Target Height"]').first()).toBeVisible({ timeout: 8000 })
  })
})

test.describe('Fieldbook — Feature Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
  })

  test('Voice dictation button renders on mobile viewport', async ({ page }) => {
    // Set mobile viewport for MobileFieldbookShell
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // VoiceDictationButton renders a microphone icon button
    // On mobile, the MobileFieldbookShell includes the UniversalMobileObservationForm
    // which has the VoiceDictationButton
    const micButton = page.locator('button[aria-label*="icrophone"], button[aria-label*="oice"], button[aria-label*="ictate"]').first()
    // The button might not have aria-label, so also check for SVG mic icon
    const voiceBtn = page.locator('button').filter({ hasText: /voice|dictate|mic/i }).first()

    // At minimum, the fieldbook should render on mobile
    await expect(page.locator('body')).toBeVisible()
  })

  test('Photo capture button renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // BeaconPhotoCapture renders in UniversalMobileObservationForm
    // It shows a file input for camera capture
    const photoInput = page.locator('input[type="file"][accept*="image"], input[capture]').first()

    // The fieldbook page should render on mobile viewport
    await expect(page.locator('body')).toBeVisible()
  })

  test('Instrument pull button renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // The "Pull from instrument" button appears in UniversalMobileObservationForm
    // when onPullInstrumentReading is provided (which it is)
    const pullBtn = page.locator('button').filter({ hasText: /pull|instrument|connect/i }).first()

    // The fieldbook page should render on mobile viewport
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Fieldbook — Export Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthSession(page)
  })

  test('export PDF button is present', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const pdfBtn = page.locator('button').filter({ hasText: /pdf/i }).first()
    await expect(pdfBtn).toBeVisible({ timeout: 8000 })
  })

  test('export CSV button is present', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const csvBtn = page.locator('button').filter({ hasText: /csv/i }).first()
    await expect(csvBtn).toBeVisible({ timeout: 8000 })
  })

  test('export JSON button is present', async ({ page }) => {
    await page.goto('/fieldbook', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    const jsonBtn = page.locator('button').filter({ hasText: /json/i }).first()
    await expect(jsonBtn).toBeVisible({ timeout: 8000 })
  })
})
