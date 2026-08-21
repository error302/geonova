import { chromium } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\9d8913ca-c26a-48ac-90f9-3675edaba81c'

async function runLiveBrowserInspection() {
  console.log('Launching headless browser (msedge/chrome) for live browser inspection...')
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

  // ── 1. Desktop 1440x900 Inspection ──
  console.log('1. Testing Desktop Survey Workspace (1440x900)...')
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await desktopContext.newPage()

  // Collect console logs and errors
  const consoleErrors = []
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => consoleErrors.push(err.message))

  await page.goto('http://127.0.0.1:3000/map', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)

  const desktopScreenshot = path.join(ARTIFACT_DIR, 'desktop_survey_workspace.png')
  await page.screenshot({ path: desktopScreenshot, fullPage: false })
  console.log(`✓ Saved: ${desktopScreenshot}`)

  // ── 2. Test Tab Navigation in Left Panel ──
  console.log('2. Testing Layers Tab...')
  const layersTab = page.locator('button:has-text("Layers")').first()
  if (await layersTab.isVisible()) {
    await layersTab.click()
    await page.waitForTimeout(1000)
    const layersScreenshot = path.join(ARTIFACT_DIR, 'workspace_layers_tab.png')
    await page.screenshot({ path: layersScreenshot, fullPage: false })
    console.log(`✓ Saved: ${layersScreenshot}`)
  }

  console.log('3. Testing Workflows Tab...')
  const workflowsTab = page.locator('button:has-text("Workflows")').first()
  if (await workflowsTab.isVisible()) {
    await workflowsTab.click()
    await page.waitForTimeout(1000)
    const workflowsScreenshot = path.join(ARTIFACT_DIR, 'workspace_workflows_tab.png')
    await page.screenshot({ path: workflowsScreenshot, fullPage: false })
    console.log(`✓ Saved: ${workflowsScreenshot}`)
  }

  // ── 3. Test Keyboard Shortcuts & Workflow Drawers ──
  console.log('4. Testing Keyboard Shortcut [P] -> Point Collection Workflow...')
  await page.keyboard.press('p')
  await page.waitForTimeout(1500)
  const pointColScreenshot = path.join(ARTIFACT_DIR, 'workflow_point_collection.png')
  await page.screenshot({ path: pointColScreenshot, fullPage: false })
  console.log(`✓ Saved: ${pointColScreenshot}`)

  console.log('5. Testing Keyboard Shortcut [T] -> Bowditch Traverse Workflow...')
  await page.keyboard.press('t')
  await page.waitForTimeout(1500)
  const traverseScreenshot = path.join(ARTIFACT_DIR, 'workflow_traverse.png')
  await page.screenshot({ path: traverseScreenshot, fullPage: false })
  console.log(`✓ Saved: ${traverseScreenshot}`)

  console.log('6. Testing Keyboard Shortcut [S] -> GNSS Stakeout HUD...')
  await page.keyboard.press('s')
  await page.waitForTimeout(1500)
  const stakeoutScreenshot = path.join(ARTIFACT_DIR, 'workflow_stakeout.png')
  await page.screenshot({ path: stakeoutScreenshot, fullPage: false })
  console.log(`✓ Saved: ${stakeoutScreenshot}`)

  // ── 4. Mobile Responsiveness (Samsung Galaxy S22) ──
  console.log('7. Testing Mobile Responsive Viewport (360x780)...')
  const mobileContext = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto('http://127.0.0.1:3000/map', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await mobilePage.waitForTimeout(3000)

  const mobileScreenshot = path.join(ARTIFACT_DIR, 'mobile_survey_workspace.png')
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: false })
  console.log(`✓ Saved: ${mobileScreenshot}`)

  await browser.close()

  console.log('──────────────────────────────────────────────')
  console.log('Live Browser Inspection Audit Completed!')
  console.log(`Console Errors encountered: ${consoleErrors.length}`)
  if (consoleErrors.length > 0) {
    console.log(consoleErrors)
  }
}

runLiveBrowserInspection().catch(err => {
  console.error('Error during browser inspection:', err)
  process.exit(1)
})
