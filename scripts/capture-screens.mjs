#!/usr/bin/env node
/**
 * capture-screens.mjs — Playwright harness that captures production-quality
 * screenshots of key app surfaces for the landing page.
 *
 * Usage:
 *   node scripts/capture-screens.mjs [--base http://localhost:3000] [--out public/landing/captures]
 *
 * Routes captured map 1:1 to landing showcase slots (src/app/page.tsx).
 * Re-run after UI changes to refresh landing imagery AND smoke-test that
 * every showcased surface still renders.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3000'
const out = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(process.cwd(), 'public', 'landing', 'captures')
// Optional: explicit browser binary when the local playwright registry is out of sync
const execIdx = process.argv.indexOf('--exec')
const executablePath = execIdx > -1 ? process.argv[execIdx + 1] : undefined

const SHOTS = [
  { name: 'cadastral-workspace', path: '/survey/demo', clip: null },
  { name: 'traverse-workflow', path: '/tools/traverse', clip: null },
  { name: 'map-inspector', path: '/map', clip: null },
  { name: 'deed-plan', path: '/deed-plan', clip: null },
]

const browser = await chromium.launch(executablePath ? { executablePath } : {})
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 })
mkdirSync(out, { recursive: true })

for (const shot of SHOTS) {
  try {
    await page.goto(base + shot.path, { waitUntil: 'networkidle', timeout: 45000 })
    await page.waitForTimeout(1200) // let animations/charts settle
    const file = join(out, `${shot.name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    console.log(`✓ ${shot.name} <- ${shot.path}`)
  } catch (e) {
    console.error(`✗ ${shot.name} (${shot.path}): ${e.message.split('\n')[0]}`)
  }
}

await browser.close()
console.log(`Done — images in ${out}. Review, crop, then copy chosen ones over public/landing/.`)
