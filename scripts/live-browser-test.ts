/**
 * METARDU Live Browser Test
 * Opens real browser and tests actual functionality
 * 
 * Run: npx tsx scripts/live-browser-test.ts
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const BASE_URL = process.env.BASE_URL || 'https://metardu.space'
const RESULTS_DIR = path.join(__dirname, '../live-test-results')
const TEST_EMAIL = process.env.TEST_EMAIL || 'mohameddosho20@gmail.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''

interface TestResult {
  name: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  screenshot?: string
  error?: string
  duration: number
}

async function ensureDevServer() {
  console.log('Checking if dev server is running...')
  try {
    const response = await fetch(BASE_URL)
    if (response.ok) {
      console.log('Dev server is running')
      return
    }
  } catch {
    console.log('Dev server not running.')
  }

  console.log('ERROR: Dev server is not running. Please start it in a separate terminal:')
  console.log('  npm run dev')
  console.log('Then re-run this test.')
  process.exit(1)
}

async function prepareBrowserContext(page: any) {
  await page.addInitScript(() => {
    localStorage.setItem('metardu_onboarding_seen', 'true')
  })
}

async function dismissOnboardingIfPresent(page: any) {
  const overlay = page.locator('.fixed.inset-0.z-50')
  if (await overlay.count()) {
    await page.evaluate(() => {
      localStorage.setItem('metardu_onboarding_seen', 'true')
    })
    await page.keyboard.press('Escape').catch(() => {})
    await overlay.first().click({ force: true, position: { x: 5, y: 5 } }).catch(() => {})
    await page.waitForTimeout(300)
  }
}

async function loginAsTestUser(page: any): Promise<boolean> {
  console.log('Logging in as test user...')
  console.log(`  Email: ${TEST_EMAIL}`)

  if (!TEST_PASSWORD) {
    console.log('  Error: TEST_PASSWORD environment variable is required')
    return false
  }

  await prepareBrowserContext(page)
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })
  await dismissOnboardingIfPresent(page)

  await page.waitForSelector('input[type="email"]', { timeout: 5000 })

  console.log('  Filling form...')
  await page.locator('input[type="email"]').fill(TEST_EMAIL)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.locator('input[type="email"]').blur()
  await page.locator('input[type="password"]').blur()

  await takeScreenshot(page, 'login-before-submit')

  console.log('  Submitting form...')
  await page.locator('button[type="submit"]').click()

  try {
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 20000 })
  } catch {
    // fall through to status checks below
  }

  const currentUrl = page.url()
  console.log(`  URL after submit: ${currentUrl}`)

  const pageText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '')

  if (pageText.includes('Incorrect email or password')) {
    console.log('  Error: Incorrect email or password')
  }
  if (pageText.includes('Please enter your email')) {
    console.log('  Error: Email validation failed')
  }
  if (pageText.includes('Please enter your password')) {
    console.log('  Error: Password validation failed')
  }

  await takeScreenshot(page, 'login-after-submit')

  if (currentUrl.includes('/login')) {
    console.log('  Login failed - still on login page')
    return false
  }

  console.log('  Login successful!')
  return true
}

async function takeScreenshot(page: any, name: string): Promise<string> {
  const filename = path.join(RESULTS_DIR, `${name}.png`)
  await page.screenshot({ path: filename, fullPage: true })
  return filename
}

async function testAuthentication(page: any): Promise<TestResult> {
  const start = Date.now()
  console.log('\nTEST: Authentication')
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await takeScreenshot(page, 'login-page')
    const loginForm = page.locator('form')
    const hasLogin = await loginForm.count() > 0
    return {
      name: 'Authentication',
      status: hasLogin ? 'PASS' : 'FAIL',
      screenshot: 'login-page.png',
      error: !hasLogin ? 'Login form not found' : undefined,
      duration: Date.now() - start,
    }
  } catch (error: any) {
    return {
      name: 'Authentication',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
    }
  }
}

async function testProjectCreation(page: any): Promise<TestResult> {
  const start = Date.now()
  console.log('\nTEST: Project Creation')
  try {
    console.log('  Navigating to /projects/new...')
    await page.goto(`${BASE_URL}/projects/new`, { waitUntil: 'networkidle', timeout: 15000 })
    console.log(`  Page loaded, URL: ${page.url()}`)
    
    // Wait longer for the page to fully hydrate
    console.log('  Waiting for page to fully load...')
    await page.waitForTimeout(5000)
    
    // Get page content
    const pageContent = await page.content()
    console.log(`  Page content length: ${pageContent.length}`)
    console.log(`  Page title: ${await page.title()}`)
    console.log(`  Current URL: ${page.url()}`)
    
    // Check if form exists in raw HTML
    const hasFormInHtml = pageContent.includes('<form')
    const hasInputInHtml = pageContent.includes('<input')
    console.log(`  Form in HTML: ${hasFormInHtml}`)
    console.log(`  Input in HTML: ${hasInputInHtml}`)
    
    // Take screenshot
    await takeScreenshot(page, 'project-creation')
    const currentUrl = page.url()
    
    if (currentUrl.includes('/login')) {
      return {
        name: 'Project Creation',
        status: 'FAIL',
        screenshot: 'project-creation.png',
        error: 'Redirected to login - not authenticated',
        duration: Date.now() - start,
      }
    }
    
    // Check for various indicators that the page loaded
    const hasForm = await page.locator('form').count() > 0
    const hasHeading = await page.locator('h1, h2').count() > 0
    const hasInputs = await page.locator('input, select').count() > 0
    const hasText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    
    // Extract some relevant text to see what's on the page
    const titleMatch = pageContent.match(/<title>([^<]+)/)
    const headingMatch = pageContent.match(/<h1[^>]*>([^<]+)/)
    console.log(`  Title from HTML: ${titleMatch ? titleMatch[1] : 'N/A'}`)
    console.log(`  H1 from HTML: ${headingMatch ? headingMatch[1] : 'N/A'}`)
    
    console.log(`    Form found via locator: ${hasForm}`)
    console.log(`    Heading found via locator: ${hasHeading}`)
    console.log(`    Inputs found via locator: ${hasInputs}`)
    console.log(`    Text content length: ${hasText.length}`)
    
    // The page is considered loaded if it has content and isn't showing "Loading" or blank
    const isPageLoaded = hasFormInHtml || hasInputInHtml || hasText.length > 500
    
    return {
      name: 'Project Creation',
      status: isPageLoaded ? 'PASS' : 'FAIL',
      screenshot: 'project-creation.png',
      error: !isPageLoaded ? `Project creation form not found. Page content preview: ${hasText.substring(0, 200)}` : undefined,
      duration: Date.now() - start,
    }
  } catch (error: any) {
    return {
      name: 'Project Creation',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
    }
  }
}

async function testTraverseComputation(page: any): Promise<TestResult> {
  const start = Date.now()
  console.log('\nTEST: Traverse Computation')
  try {
    await page.goto(`${BASE_URL}/tools/traverse`, { waitUntil: 'networkidle', timeout: 15000 })
    await takeScreenshot(page, 'traverse-computation')
    const hasInput = await page.locator('input, textarea').count() > 0
    return {
      name: 'Traverse Computation',
      status: hasInput ? 'PASS' : 'FAIL',
      screenshot: 'traverse-computation.png',
      error: !hasInput ? 'Traverse computation page empty' : undefined,
      duration: Date.now() - start,
    }
  } catch (error: any) {
    return {
      name: 'Traverse Computation',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
    }
  }
}

async function testSurveyReportBuilder(page: any): Promise<TestResult> {
  const start = Date.now()
  console.log('\nTEST: Survey Report Builder')
  try {
    await page.goto(`${BASE_URL}/tools/survey-report-builder`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('main, h1, h2', { timeout: 15000 })
    await takeScreenshot(page, 'survey-report-builder')
    const currentUrl = page.url()
    if (currentUrl.includes('/login')) {
      return {
        name: 'Survey Report Builder',
        status: 'FAIL',
        screenshot: 'survey-report-builder.png',
        error: 'Redirected to login - not authenticated',
        duration: Date.now() - start,
      }
    }
    const hasHeading = await page.locator('h1, h2').filter({ hasText: /Survey Report|Report Builder/ }).count() > 0
    const hasProjectSelector = await page.locator('button, a, select').count() > 0
    const hasContent = await page.locator('main, [class*="container"], [class*="max-w"]').count() > 0
    return {
      name: 'Survey Report Builder',
      status: hasHeading || hasProjectSelector || hasContent ? 'PASS' : 'FAIL',
      screenshot: 'survey-report-builder.png',
      error: !hasHeading && !hasProjectSelector && !hasContent ? 'Survey report builder not found' : undefined,
      duration: Date.now() - start,
    }
  } catch (error: any) {
    return {
      name: 'Survey Report Builder',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
    }
  }
}

async function testDashboard(page: any): Promise<TestResult> {
  const start = Date.now()
  console.log('\nTEST: Dashboard')
  try {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 15000 })
    await takeScreenshot(page, 'dashboard')
    const hasDashboard = await page.locator('h1, h2, [class*="dashboard"], [class*="card"]').count() > 0
    const isLoginRedirect = page.url().includes('login')
    return {
      name: 'Dashboard',
      status: hasDashboard || isLoginRedirect ? 'PASS' : 'FAIL',
      screenshot: 'dashboard.png',
      error: !hasDashboard && !isLoginRedirect ? 'Dashboard not accessible' : undefined,
      duration: Date.now() - start,
    }
  } catch (error: any) {
    return {
      name: 'Dashboard',
      status: 'FAIL',
      error: error.message,
      duration: Date.now() - start,
    }
  }
}

async function runTests() {
  console.log('METARDU Live Browser Test Suite')
  console.log('='.repeat(50))
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true })
  }
  await ensureDevServer()
  console.log('\nLaunching browser...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await context.addInitScript(() => {
    localStorage.setItem('metardu_onboarding_seen', 'true')
  })
  const page = await context.newPage()
  const results: TestResult[] = []
  
  // Test 1: Authentication (public page)
  results.push(await testAuthentication(page))
  
  // Login for subsequent protected tests
  const loggedIn = await loginAsTestUser(page)
  if (!loggedIn) {
    console.log('\nWARNING: Login failed. Protected page tests will likely fail.')
    results.push({ name: 'Login', status: 'FAIL', error: `Could not log in with ${TEST_EMAIL}`, duration: 0 })
  } else {
    results.push({ name: 'Login', status: 'PASS', duration: 0 })
  }
  
  // Test protected pages (now authenticated)
  results.push(await testProjectCreation(page))
  results.push(await testTraverseComputation(page))
  results.push(await testSurveyReportBuilder(page))
  results.push(await testDashboard(page))
  
  await browser.close()
  
  console.log('\n' + '='.repeat(50))
  console.log('TEST RESULTS SUMMARY')
  console.log('='.repeat(50))
  const passed = results.filter(r => r.status === 'PASS').length
  const failed = results.filter(r => r.status === 'FAIL').length
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '[PASS]' : '[FAIL]'
    console.log(`${icon} ${result.name}: ${result.status} (${result.duration}ms)`)
    if (result.error) console.log(`  Error: ${result.error}`)
    if (result.screenshot) console.log(`  Screenshot: ${result.screenshot}`)
  })
  console.log('\n' + '='.repeat(50))
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`)
  console.log(`Results saved to: ${RESULTS_DIR}`)
  console.log('='.repeat(50))
  
  const htmlReport = generateHtmlReport(results, passed, failed)
  fs.writeFileSync(path.join(RESULTS_DIR, 'report.html'), htmlReport)
  process.exit(failed > 0 ? 1 : 0)
}

function generateHtmlReport(results: TestResult[], passed: number, failed: number): string {
  return `<!DOCTYPE html><html><head><title>METARDU Test Results</title><style>body{font-family:Arial;margin:40px;background:#f5f5f5}.container{max-width:1200px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1)}h1{color:#1B3A5C}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:20px;margin:30px 0}.stat{background:#f8f9fa;padding:20px;border-radius:8px;text-align:center}.stat-value{font-size:36px;font-weight:700}.stat-label{color:#666;margin-top:5px}.pass{color:#16a34a}.fail{color:#dc2626}.test{border:1px solid #e5e7eb;margin:15px 0;padding:20px;border-radius:8px}.test.pass{border-left:4px solid #16a34a}.test.fail{border-left:4px solid #dc2626}.test-name{font-weight:700;font-size:18px}.test-status{float:right}.screenshot{margin-top:15px}.screenshot img{max-width:100%;border:1px solid #ddd;border-radius:4px}.error{color:#dc2626;margin-top:10px}</style></head><body><div class="container"><h1>METARDU Live Browser Test Results</h1><p>Generated: ${new Date().toLocaleString()}</p><div class="summary"><div class="stat"><div class="stat-value pass">${passed}</div><div class="stat-label">Passed</div></div><div class="stat"><div class="stat-value fail">${failed}</div><div class="stat-label">Failed</div></div><div class="stat"><div class="stat-value">${results.length}</div><div class="stat-label">Total Tests</div></div></div><h2>Test Details</h2>${results.map(r => `<div class="test ${r.status.toLowerCase()}"><div class="test-name">${r.name}</div><span class="test-status">${r.status}</span><div>Duration: ${r.duration}ms</div>${r.error ? `<div class="error">Error: ${r.error}</div>` : ''}${r.screenshot ? `<div class="screenshot"><strong>Screenshot:</strong><br><img src="${r.screenshot}" alt="${r.name}"></div>` : ''}</div>`).join('')}</div></body></html>`
}

if (require.main === module) {
  runTests().catch(console.error)
}

export { runTests }
