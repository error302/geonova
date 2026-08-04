// Analyze a Lighthouse JSON report (performance + accessibility focus).
const d = require(process.argv[2])

console.log('=== categories ===')
for (const [k, v] of Object.entries(d.categories)) console.log('  ' + k + ':', Math.round((v.score || 0) * 100))

const mids = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive', 'server-response-time']
console.log('=== metrics ===')
for (const k of mids) { const a = d.audits[k]; if (a) console.log('  ' + k + ':', a.displayValue || a.numericValue) }

console.log('=== failed audits (score < 0.9) ===')
for (const [k, a] of Object.entries(d.audits)) {
  if (!a.scoreDisplayMode || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue
  if (a.score !== null && a.score < 0.9) console.log('  [' + Math.round(a.score * 100) + '] ' + k + ' :: ' + (a.displayValue || ''))
}

function dump(key, label, field, limit) {
  const a = d.audits[key]
  if (!a || !a.details || !a.details.items) return
  console.log('=== ' + label + ' ===')
  a.details.items.slice(0, limit).forEach(i => {
    const u = (i.url || '').replace('https://metardu.space', '')
    const v = i[field] != null ? i[field] : ''
    console.log('  ' + u + '  ' + v)
  })
}

dump('largest-contentful-paint-element', 'LCP element', 'node', 3)
dump('unused-javascript', 'unused-javascript (wastedBytes)', 'wastedBytes', 10)
dump('render-blocking-insight', 'render-blocking (wastedMs)', 'wastedMs', 10)
dump('render-blocking-resources', 'render-blocking-resources (wastedMs)', 'wastedMs', 10)
dump('bootup-time', 'bootup-time (scripting ms)', 'scripting', 8)
dump('total-byte-weight', 'total-byte-weight', 'transferSize', 10)
dump('unused-css-rules', 'unused-css-rules (wastedBytes)', 'wastedBytes', 6)
dump('font-display', 'font-display (networkRequests)', 'networkRequests', 6)
dump('color-contrast', 'color-contrast failures', 'node', 8)
dump('image-delivery-insight', 'image-delivery-insight', 'node', 6)
dump('cache-insight', 'cache-insight', 'node', 6)
dump('network-dependency-tree-insight', 'network-dependency-tree-insight', 'node', 8)
