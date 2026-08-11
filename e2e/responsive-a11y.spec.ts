import { test, expect } from '@playwright/test'

test.describe('Responsive Design — Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } }) // iPhone X

  test('landing page hero text is readable on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Surveying software')
  })

  test('pricing cards visible on mobile', async ({ page }) => {
    await page.goto('/')
    // Scroll to pricing section first
    await page.locator('text=Start free, scale as you grow').scrollIntoViewIfNeeded()
    await expect(page.locator('text=KSh 500')).toBeVisible()
    await expect(page.locator('text=Most Popular')).toBeVisible()
  })

  test('login page shows mobile branding', async ({ page }) => {
    await page.goto('/login')
    const mobileBrand = page.locator('header a[href="/"]').first()
    await expect(mobileBrand).toBeVisible()
  })

  test('professional tools grid is single column on mobile', async ({ page }) => {
    await page.goto('/')
    // exact:true — 'Traverse' substring-matches the 'Traverse Adjustment'
    // feature heading too.
    await expect(page.getByRole('heading', { name: 'Traverse', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'COGO', exact: true })).toBeVisible()
  })
})

test.describe('Responsive Design — Tablet', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('landing page renders correctly on tablet', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Surveying software')
    await expect(page.locator('h3').filter({ hasText: 'Traverse Adjustment' })).toBeVisible()
  })

  test('login page shows split layout on tablet', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('text=Kenya Survey Compliant')).toBeVisible()
  })
})

test.describe('Responsive Design — Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('landing page full layout on desktop', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Surveying software')
    await expect(page.locator('h3').filter({ hasText: 'Traverse Adjustment' })).toBeVisible()
    await expect(page.locator('text=Most Popular')).toBeVisible()
  })
})

test.describe('Accessibility', () => {
  test('all images have alt text', async ({ page }) => {
    await page.goto('/')
    const images = await page.locator('img').all()
    for (const img of images) {
      const alt = await img.getAttribute('alt')
      expect(alt).not.toBeNull()
    }
  })

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/login')
    const emailLabel = page.locator('label').filter({ hasText: 'Email' })
    await expect(emailLabel).toBeVisible()
    const passwordLabel = page.locator('label').filter({ hasText: 'Password' })
    await expect(passwordLabel).toBeVisible()
  })

  test('page has lang attribute', async ({ page }) => {
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('en')
  })

  test('skip-to-content link exists for keyboard navigation', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })
})
