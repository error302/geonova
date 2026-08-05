// Summarize remaining aria-label-gate violations per file.
const fs = require('fs')
const d = JSON.parse(fs.readFileSync(process.argv[2] || 'aria-violations.json', 'utf8'))
console.log('TOTAL:', d.total, '| files:', new Set(d.violations.map(v => v.file)).size)
for (const v of d.violations) {
  console.log(`${v.file.replace(/\\/g, '/')}:${v.line}  [${v.kind}]  ${JSON.stringify(v.value)}`)
}
