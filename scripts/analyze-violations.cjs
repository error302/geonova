// Analyze each flagged violation: does the input have id= matching a preceding <label htmlFor>?
const d = JSON.parse(require('fs').readFileSync(process.argv[2] || 'aria-violations.json', 'utf8'))
const { readFileSync } = require('fs')
let lastFile = null
let lines = null
let withLabel = 0
let withoutLabel = []
for (const v of d.violations) {
  const file = v.file
  if (file !== lastFile) { lastFile = file; lines = readFileSync(file, 'utf8').split(/\r?\n/) }
  // collect the full tag starting at v.line (may span multiple lines)
  let tagLines = []
  let depth = 0
  for (let i = v.line - 1; i < lines.length && i < v.line + 6; i++) {
    tagLines.push(lines[i])
    depth += (lines[i].match(/</g) || []).length - (lines[i].match(/>/g) || []).length
    if (depth <= 0) break
  }
  const tag = tagLines.join(' ')
  const idMatch = tag.match(/\bid="([^"]+)"/)
  let hasLabel = false
  if (idMatch) {
    const id = idMatch[1]
    // scan up 25 lines for <label ... htmlFor="id"
    for (let i = Math.max(0, v.line - 26); i < v.line - 1; i++) {
      if (lines[i].includes('htmlFor="' + id + '"')) { hasLabel = true; break }
    }
  }
  if (hasLabel) withLabel++
  else withoutLabel.push(v.file.replace(/\\/g, '/') + ':' + v.line + ' [' + v.value + ']')
}
console.log('WITH matching label htmlFor (remove aria-label):', withLabel)
console.log('WITHOUT label (need header-derived name):', withoutLabel.length)
for (const s of withoutLabel) console.log('  ' + s)
