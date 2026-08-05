// Parse a PageSpeed Insights API JSON file and summarize scores + failures.
const fs = require('fs')
const file = process.argv[2]
const d = JSON.parse(fs.readFileSync(file, 'utf8'))
if (!d.lighthouseResult) {
  console.log('ERROR:', JSON.stringify(d.error || d).slice(0, 400))
  process.exit(0)
}
const lr = d.lighthouseResult
console.log('URL:', lr.finalUrl)
console.log('=== Categories ===')
for (const [k, v] of Object.entries(lr.categories)) console.log('  ' + k + ':', Math.round(v.score * 100))

console.log('=== Core metrics ===')
const metricIds = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive']
for (const k of metricIds) {
  const a = lr.audits[k]
  if (a) console.log('  ' + k + ':', a.displayValue || a.numericValue)
}

console.log('=== Failed/imperfect audits ===')
const seen = new Set()
for (const [k, a] of Object.entries(lr.audits)) {
  if (!a.scoreDisplayMode || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue
  const passed = a.score === null ? null : a.score >= 0.9
  if (passed === false && !seen.has(k) && a.details) {
    seen.add(k)
    const n = a.details.items ? a.details.items.length : ''
    console.log('  [' + (a.score * 100).toFixed(0) + '] ' + k + (n !== '' ? ' (' + n + ' items)' : ''))
  }
}
