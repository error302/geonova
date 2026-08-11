import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('loads homepage with correct title and meta', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/METARDU/)
  })

  test('renders hero section with key content', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Surveying software')
    await expect(page.locator('h1')).toContainText('East Africa')
  })

  test('shows East African focus in hero copy', async ({ page }) => {
    await page.goto('/')
    const heroCopy = page.locator('p').filter({ hasText: 'built for Kenyan surveyors' }).first()
    await expect(heroCopy).toBeVisible()
  })

  test('hero CTA links to register page', async ({ page }) => {
    await page.goto('/')
    // Hero CTA is unique by its label ('Start a project'); the first
    // a[href="/register"] in DOM order is the desktop nav's Get Started
    // link, which is CSS-hidden on mobile.
    const ctaLink = page.getByRole('link', { name: 'Start a project' })
    await expect(ctaLink).toBeVisible()
    await ctaLink.click()
    await expect(page).toHaveURL(/\/register/)
  })

  test('trust bar shows Kenyan institutions', async ({ page }) => {
    await page.goto('/')
    // Trust badges (ISK/EBK/SoK) plus the stats row
    await expect(page.locator('text=ISK').first()).toBeVisible()
    await expect(page.locator('text=EBK').first()).toBeVisible()
    await expect(page.locator('text=SoK').first()).toBeVisible()
    await expect(page.locator('text=Counties supported').first()).toBeVisible()
  })

  test('features bento grid renders 6 feature cards', async ({ page }) => {
    await page.goto('/')
    // Each heading should be unique (h3 elements)
    const headings = page.locator('h3')
    await expect(headings.filter({ hasText: 'Traverse Adjustment' })).toBeVisible()
    await expect(headings.filter({ hasText: 'Deed Plan Generation' })).toBeVisible()
    await expect(headings.filter({ hasText: 'Topographic Surveys' })).toBeVisible()
    await expect(headings.filter({ hasText: 'COGO Engine' })).toBeVisible()
    await expect(headings.filter({ hasText: 'GNSS Baseline Processing' })).toBeVisible()
    await expect(headings.filter({ hasText: 'Statutory Documents' })).toBeVisible()
  })

  test('how-it-works section shows 3 steps', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Set Up Project')).toBeVisible()
    await expect(page.locator('text=Collect & Compute')).toBeVisible()
    await expect(page.locator('text=Submit & Archive')).toBeVisible()
  })

  test('professional tools grid shows 8 tools', async ({ page }) => {
    await page.goto('/')
    const tools = [
      'Traverse',
      'COGO',
      'Contours',
      'Curves',
      'GNSS',
      'Deed Plans',
      'Reports',
      'Validation',
    ]
    for (const tool of tools) {
      // exact:true — substring matching collides with feature headings
      // (e.g. 'Traverse' vs 'Traverse Adjustment').
      await expect(page.getByRole('heading', { name: tool, exact: true })).toBeVisible()
    }
  })

  test('pricing section shows 3 tiers', async ({ page }) => {
    await page.goto('/')
    // Use h3 for unique heading matches
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible()
    await expect(page.locator('text=KSh 500')).toBeVisible()
    await expect(page.locator('text=KSh 2,000')).toBeVisible()
    await expect(page.locator('text=Most Popular')).toBeVisible()
  })

  test('final CTA links to register', async ({ page }) => {
    await page.goto('/')
    const finalCta = page.locator('a[href="/register"]').last()
    await expect(finalCta).toBeVisible()
  })

  test('footer has privacy, terms, and community links', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('footer a[href="/community"]')).toBeVisible()
    await expect(page.locator('footer a[href="/docs/privacy"]')).toBeVisible()
    await expect(page.locator('footer a[href="/docs/terms"]')).toBeVisible()
  })

  test('skip-to-content link exists for accessibility', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })
})
