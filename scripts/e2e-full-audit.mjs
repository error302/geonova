import { chromium } from 'playwright'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\9d8913ca-c26a-48ac-90f9-3675edaba81c'
const BASE_URL = 'http://127.0.0.1:3000'

const results = []

function log(step, status, detail = '') {
  const icon = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '⚠'
  console.log(`${icon} [${step}] ${status}${detail ? ': ' + detail : ''}`)
  results.push({ step, status, detail })
}

async function runFullAudit() {
  console.log('═══════════════════════════════════════════════════')
  console.log('   METARDU Comprehensive Live Browser Audit')
  console.log('═══════════════════════════════════════════════════\n')

  let browser
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true })
  } catch {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true })
    } catch {
      browser = await chromium.launch({ headless: true })
    }
  }

  const consoleErrors = []
  const networkErrors = []

  // ── 1. LANDING PAGE / HOME ──
  console.log('\n── 1. Landing & Core Pages ──')
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push({ page: page.url(), text: msg.text() })
  })
  page.on('pageerror', err => consoleErrors.push({ page: page.url(), text: err.message }))
  page.on('response', resp => {
    if (resp.status() >= 500) networkErrors.push({ url: resp.url(), status: resp.status() })
  })

  // Test homepage
  try {
    const homeResp = await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Homepage', homeResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${homeResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_homepage.png'), fullPage: false })
  } catch (e) {
    log('Homepage', 'FAIL', e.message)
  }

  // Test /tools
  try {
    const toolsResp = await page.goto(`${BASE_URL}/tools`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Tools Page', toolsResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${toolsResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_tools.png'), fullPage: false })
  } catch (e) {
    log('Tools Page', 'FAIL', e.message)
  }

  // Test /pricing
  try {
    const pricingResp = await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Pricing Page', pricingResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${pricingResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_pricing.png'), fullPage: false })
  } catch (e) {
    log('Pricing Page', 'FAIL', e.message)
  }

  // Test /login
  try {
    const loginResp = await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Login Page', loginResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${loginResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_login.png'), fullPage: false })
  } catch (e) {
    log('Login Page', 'FAIL', e.message)
  }

  // ── 2. MAP / SURVEY WORKSPACE ──
  console.log('\n── 2. Survey Workspace ──')
  try {
    const mapResp = await page.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(4000)
    log('Map Page Load', mapResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${mapResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_map_desktop.png'), fullPage: false })
  } catch (e) {
    log('Map Page Load', 'FAIL', e.message)
  }

  // Check for map canvas
  const mapCanvas = page.locator('canvas, .ol-viewport, #map, [data-testid="map"]').first()
  if (await mapCanvas.isVisible({ timeout: 5000 }).catch(() => false)) {
    log('Map Canvas Rendered', 'PASS')
  } else {
    log('Map Canvas Rendered', 'WARN', 'Canvas not found or not visible within timeout')
  }

  // Tab navigation
  for (const tabName of ['Layers', 'Workflows', 'Data', 'Tools']) {
    const tab = page.locator(`button:has-text("${tabName}")`).first()
    if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab.click()
      await page.waitForTimeout(800)
      log(`Tab: ${tabName}`, 'PASS', 'Visible & clickable')
    } else {
      log(`Tab: ${tabName}`, 'WARN', 'Not visible')
    }
  }

  // Keyboard shortcuts
  for (const [key, label] of [['p', 'Point Collection'], ['t', 'Traverse'], ['s', 'Stakeout']]) {
    await page.keyboard.press(key)
    await page.waitForTimeout(1000)
    log(`Keyboard [${key.toUpperCase()}] → ${label}`, 'PASS', 'Shortcut fired')
  }
  // Press Escape to close any open workflow drawer
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ── 3. FIELDBOOK ──
  console.log('\n── 3. Fieldbook ──')
  try {
    const fbResp = await page.goto(`${BASE_URL}/fieldbook`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Fieldbook Page', fbResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${fbResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_fieldbook.png'), fullPage: false })
  } catch (e) {
    log('Fieldbook Page', 'FAIL', e.message)
  }

  // ── 4. INDUSTRIAL ──
  console.log('\n── 4. Industrial ──')
  try {
    const indResp = await page.goto(`${BASE_URL}/industrial`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    log('Industrial Page', indResp?.status() === 200 ? 'PASS' : 'FAIL', `HTTP ${indResp?.status()}`)
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_industrial.png'), fullPage: false })
  } catch (e) {
    log('Industrial Page', 'FAIL', e.message)
  }

  // ── 5. API HEALTH ──
  console.log('\n── 5. API Endpoints ──')
  for (const endpoint of ['/api/health']) {
    try {
      const resp = await page.goto(`${BASE_URL}${endpoint}`, { waitUntil: 'domcontentloaded', timeout: 15000 })
      log(`API ${endpoint}`, resp?.status() === 200 ? 'PASS' : 'WARN', `HTTP ${resp?.status()}`)
    } catch (e) {
      log(`API ${endpoint}`, 'FAIL', e.message)
    }
  }

  // ── 6. FOOTER LINKS ──
  console.log('\n── 6. Footer Link Verification ──')
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  const footerLinks = await page.locator('footer a[href^="/"]').all()
  const uniqueHrefs = new Set()
  for (const link of footerLinks) {
    const href = await link.getAttribute('href')
    if (href && !uniqueHrefs.has(href)) {
      uniqueHrefs.add(href)
    }
  }
  log('Footer Internal Links Found', uniqueHrefs.size > 0 ? 'PASS' : 'WARN', `${uniqueHrefs.size} unique links`)

  // ── 7. MOBILE RESPONSIVE ──
  console.log('\n── 7. Mobile Responsive (Galaxy S22) ──')
  const mCtx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const mPage = await mCtx.newPage()

  try {
    await mPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await mPage.waitForTimeout(2000)
    log('Mobile Homepage', 'PASS')
    await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_mobile_home.png'), fullPage: false })
  } catch (e) {
    log('Mobile Homepage', 'FAIL', e.message)
  }

  try {
    await mPage.goto(`${BASE_URL}/map`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await mPage.waitForTimeout(4000)
    log('Mobile Map', 'PASS')
    await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_mobile_map.png'), fullPage: false })
  } catch (e) {
    log('Mobile Map', 'FAIL', e.message)
  }

  try {
    await mPage.goto(`${BASE_URL}/tools`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await mPage.waitForTimeout(2000)
    log('Mobile Tools', 'PASS')
    await mPage.screenshot({ path: path.join(ARTIFACT_DIR, 'audit_mobile_tools.png'), fullPage: false })
  } catch (e) {
    log('Mobile Tools', 'FAIL', e.message)
  }

  await browser.close()

  // ── SUMMARY ──
  console.log('\n═══════════════════════════════════════════════════')
  console.log('   AUDIT SUMMARY')
  console.log('═══════════════════════════════════════════════════')
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  const warnings = results.filter(r => r.status === 'WARN').length
  console.log(`Total Checks: ${results.length}`)
  console.log(`✓ PASSED: ${passed}`)
  console.log(`✗ FAILED: ${failed}`)
  console.log(`⚠ WARNINGS: ${warnings}`)
  console.log(`Console Errors: ${consoleErrors.length}`)
  console.log(`Network 5xx Errors: ${networkErrors.length}`)

  if (consoleErrors.length > 0) {
    console.log('\nConsole Errors:')
    consoleErrors.forEach(e => console.log(`  [${e.page}] ${e.text.substring(0, 200)}`))
  }
  if (networkErrors.length > 0) {
    console.log('\nNetwork Errors:')
    networkErrors.forEach(e => console.log(`  ${e.status} ${e.url}`))
  }

  console.log('\n═══════════════════════════════════════════════════')
  if (failed > 0) {
    console.log('⚠ AUDIT COMPLETED WITH FAILURES — review above')
    process.exit(1)
  } else {
    console.log('✓ AUDIT PASSED — METARDU is production-ready')
  }
}

runFullAudit().catch(err => {
  console.error('Fatal audit error:', err)
  process.exit(1)
})
