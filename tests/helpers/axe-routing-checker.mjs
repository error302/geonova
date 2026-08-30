#!/usr/bin/env node
/**
 * ESM bridge for tests/axe-sweep-routing.test.ts.
 *
 * Jest (ts-jest, CommonJS) cannot dynamically import an ESM module that uses
 * `import` declarations, but the axe scanner is plain ESM (.mjs) by design
 * (CI runs it with bare `node`). This helper runs INSIDE a plain node
 * subprocess: it chdirs into a fixture app tree, imports the REAL scanner
 * module (so its module-level walkPages('src/app/tools') resolves against
 * the fixture), executes a table of checks against the exported pure
 * functions, and prints one JSON line of verdicts to stdout for the jest
 * side to assert on. Notes/logs from the scanner go to stderr only.
 */
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCAN = path.join(ROOT, 'scripts', 'axe-gnss-scan.mjs')

const fixtureRoot = process.argv[2]
if (!fixtureRoot) {
  console.error('usage: node axe-routing-checker.mjs <fixture-root>')
  process.exit(2)
}
process.chdir(fixtureRoot)
const mod = await import(SCAN)

const checks = []
const check = (name, fn) => {
  try {
    const detail = fn()
    checks.push({ name, pass: true, detail: detail === undefined ? null : detail })
  } catch (err) {
    checks.push({ name, pass: false, detail: String(err.message) })
  }
}
const eq = (actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`expected ${e}, got ${a}`)
}
const truthy = (v) => { if (!v) throw new Error(`expected truthy, got ${JSON.stringify(v)}`) }
const falsy = (v) => { if (v) throw new Error(`expected falsy, got ${JSON.stringify(v)}`) }
const includes = (arr, x) => { if (!arr.includes(x)) throw new Error(`${JSON.stringify(x)} not in [${arr.join(', ')}]`) }
const excludes = (arr, x) => { if (arr.includes(x)) throw new Error(`${JSON.stringify(x)} should not be in [${arr.join(', ')}]`) }

// ── walkPages ───────────────────────────────────────────────────────────────
check('walkPages: finds nested routes', () => {
  const routes = mod.walkPages('src/app/tools')
  includes(routes, '/tools/gnss')
  includes(routes, '/tools/gnss-rinex')
  includes(routes, '/tools/mixed')
  includes(routes, '/tools/deep/orphan')
  return routes
})
check('walkPages: skips [param] dirs', () => {
  excludes(mod.walkPages('src/app/tools'), '/tools/[id]')
})
check('walkPages: skips redirect-only stub pages', () => {
  excludes(mod.walkPages('src/app/tools'), '/tools/redirect-stub')
})
check('walkPages: keeps pages that redirect AND render JSX', () => {
  includes(mod.walkPages('src/app/tools'), '/tools/mixed')
})

// ── routeFromAppFile ────────────────────────────────────────────────────────
check('routeFromAppFile: page file → route', () => {
  eq(mod.routeFromAppFile('src/app/tools/gnss/page.tsx'), '/tools/gnss')
})
check('routeFromAppFile: sibling file → route dir', () => {
  eq(mod.routeFromAppFile('src/app/tools/gnss/components/Panel.tsx'), '/tools/gnss/components')
})
check('routeFromAppFile: root page → /', () => {
  eq(mod.routeFromAppFile('src/app/page.tsx'), '/')
})
check('routeFromAppFile: non-app file → null', () => {
  eq(mod.routeFromAppFile('src/components/Foo.tsx'), null)
  eq(mod.routeFromAppFile('lib/x.ts'), null)
})

// ── isGlobal ────────────────────────────────────────────────────────────────
check('isGlobal: middleware/globals/layout are global', () => {
  truthy(mod.isGlobal('middleware.ts'))
  truthy(mod.isGlobal('src/app/globals.css'))
  truthy(mod.isGlobal('src/app/tools/layout.tsx'))
  truthy(mod.isGlobal('src/components/layout/NavBar.tsx'))
})
check('isGlobal: pages and libs are not global', () => {
  falsy(mod.isGlobal('src/app/tools/gnss/page.tsx'))
  falsy(mod.isGlobal('src/lib/geo/transform.ts'))
})

// ── changedRoutes ───────────────────────────────────────────────────────────
check('changedRoutes: page file → its route', () => {
  eq([...mod.changedRoutes('origin/main', ['src/app/tools/gnss/page.tsx'])], ['/tools/gnss'])
})
check('changedRoutes: nested component → nearest scanned ancestor', () => {
  eq([...mod.changedRoutes('origin/main', ['src/app/tools/gnss/components/Panel.tsx'])], ['/tools/gnss'])
})
check('changedRoutes: shared component → importing routes (basename match)', () => {
  eq([...mod.changedRoutes('origin/main', ['src/components/gnss/ScaleBadge.tsx'])], ['/tools/gnss'])
})
check('changedRoutes: global files → null (full sweep)', () => {
  eq(mod.changedRoutes('origin/main', ['src/app/layout.tsx']), null)
  eq(mod.changedRoutes('origin/main', ['middleware.ts']), null)
  eq(mod.changedRoutes('origin/main', ['src/app/globals.css']), null)
})
check('changedRoutes: app file with no scanned ancestor → null', () => {
  eq(mod.changedRoutes('origin/main', ['src/app/tools/deep/inline.tsx']), null)
})
check('changedRoutes: shared component with no importer → null', () => {
  eq(mod.changedRoutes('origin/main', ['src/components/gnss/Unimported.tsx']), null)
})

// ── DEV_ERROR_VIEWPORT_RE ───────────────────────────────────────────────────
check('DEV_ERROR_VIEWPORT_RE: matches dev-error-page metas', () => {
  truthy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1, maximum-scale=1.0, user-scalable=no'))
  truthy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1, maximum-scale=1.0'))
  truthy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1, maximum-scale=1'))
  truthy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, user-scalable=no'))
})
check('DEV_ERROR_VIEWPORT_RE: does not match the app viewport (maximum-scale=5)', () => {
  falsy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1, maximum-scale=5, user-scalable=1'))
  falsy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1, maximum-scale=5'))
  falsy(mod.DEV_ERROR_VIEWPORT_RE.test('width=device-width, initial-scale=1'))
})

process.stdout.write(JSON.stringify(checks) + '\n')
