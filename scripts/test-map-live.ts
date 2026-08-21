import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

async function runMapAudit() {
  console.log('--- Starting METARDU Live Map Page Comprehensive E2E Test ---')
  const resultsDir = path.join(__dirname, '../map-audit-results')
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true })
  }

  const browser = await chromium.launch({ headless: true, channel: 'chrome' }).catch(() => chromium.launch({ headless: true, channel: 'msedge' }))
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })

  const page = await context.newPage()
  const consoleLogs: string[] = []
  const pageErrors: string[] = []

  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', err => {
    pageErrors.push(err.message)
    console.error('Page error:', err.message)
  })

  // Try live URL first, fallback to localhost if needed
  let targetUrl = 'https://metardu.space/map'
  console.log(`Navigating to ${targetUrl}...`)

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
    console.log(`Response status: ${response?.status()}`)
  } catch (e: any) {
    console.warn(`Could not reach ${targetUrl} (${e.message}). Falling back to localhost...`)
    targetUrl = 'http://localhost:3000/map'
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 })
  }

  // Dismiss any onboarding modal if visible
  await page.keyboard.press('Escape').catch(() => {})
  await page.waitForTimeout(1000)

  // 1. Capture Base Map Initial View
  const initialScreenshot = path.join(resultsDir, '01_map_initial.png')
  await page.screenshot({ path: initialScreenshot })
  console.log(`Saved initial map screenshot to ${initialScreenshot}`)

  // 2. Check Map Elements
  const mapCanvas = page.locator('canvas, .ol-viewport, [class*="map-container"]')
  const hasMap = (await mapCanvas.count()) > 0
  console.log(`Map Canvas / Viewport detected: ${hasMap}`)

  // 2. Ensure dock is visible (press 1 to open Recon, 2 for Capture, 3 for Compute, etc.)
  console.log('Opening Recon panel via shortcut 1...')
  await page.keyboard.press('1')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '02_panel_recon_open.png') })

  console.log('Opening Capture panel via shortcut 2...')
  await page.keyboard.press('2')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '03_panel_capture_open.png') })

  console.log('Opening Compute (COGO) panel via shortcut 3...')
  await page.keyboard.press('3')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '04_panel_compute_open.png') })

  console.log('Opening Set Out panel via shortcut 4...')
  await page.keyboard.press('4')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '05_panel_setout_open.png') })

  console.log('Opening Layers panel via shortcut 5...')
  await page.keyboard.press('5')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '06_panel_layers_open.png') })

  console.log('Opening Export panel via shortcut 6...')
  await page.keyboard.press('6')
  await page.waitForTimeout(700)
  await page.screenshot({ path: path.join(resultsDir, '07_panel_export_open.png') })

  // 3. Test Zoom Controls
  const zoomIn = page.locator('button.ol-zoom-in, button[aria-label="Zoom in"], button[title="Zoom in"]').first()
  if (await zoomIn.count()) {
    console.log('Testing Zoom In interaction...')
    await zoomIn.click({ force: true })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(resultsDir, '08_zoomed_map.png') })
  }

  // 4. Test Coordinate search or Map interaction
  const searchInput = page.locator('input').first()
  if (await searchInput.count()) {
    console.log('Testing input focus/fill...')
    await searchInput.fill('250000, 9850000')
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(resultsDir, '09_input_tested.png') })
  }

  // Final summary screenshot
  await page.screenshot({ path: path.join(resultsDir, '10_final_map_overview.png'), fullPage: true })

  await browser.close()

  console.log('--- Map Audit Complete ---')
  console.log(`Page Errors: ${pageErrors.length}`)
  console.log(`Results saved in ${resultsDir}`)
}

runMapAudit().catch(console.error)
