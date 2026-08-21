import { chromium } from 'playwright'
import * as path from 'path'

const ARTIFACT_DIR = 'C:\\Users\\user\\.gemini\\antigravity\\brain\\9d8913ca-c26a-48ac-90f9-3675edaba81c'

async function inspectLoginPage() {
  console.log('Launching headless browser to inspect /login page...')
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

  // 1. Desktop 1440x900
  console.log('1. Capturing Desktop Login Page (1440x900)...')
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await desktopCtx.newPage()
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)

  const desktopScreenshot = path.join(ARTIFACT_DIR, 'login_desktop_fixed.png')
  await page.screenshot({ path: desktopScreenshot, fullPage: false })
  console.log(`✓ Saved: ${desktopScreenshot}`)

  // 2. Mobile 360x780 (Galaxy S22)
  console.log('2. Capturing Mobile Login Page (360x780)...')
  const mobileCtx = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const mobilePage = await mobileCtx.newPage()
  await mobilePage.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await mobilePage.waitForTimeout(2500)

  const mobileScreenshot = path.join(ARTIFACT_DIR, 'login_mobile_fixed.png')
  await mobilePage.screenshot({ path: mobileScreenshot, fullPage: false })
  console.log(`✓ Saved: ${mobileScreenshot}`)

  await browser.close()
  console.log('Login visual inspection finished successfully!')
}

inspectLoginPage().catch(err => {
  console.error('Error during login inspection:', err)
  process.exit(1)
})
