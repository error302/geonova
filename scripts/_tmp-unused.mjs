import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('.eslint-now.json', 'utf8'))
const byKind = { import: 0, var: 0, arg: 0, other: 0 }
const byFile = {}
const samples = { import: [], var: [], arg: [], other: [] }
for (const f of data) {
  let fileCount = 0
  for (const m of f.messages) {
    if (m.severity !== 1 || m.ruleId !== '@typescript-eslint/no-unused-vars') continue
    const msg = m.message
    let kind = 'other'
    if (msg.includes('is defined but never used')) kind = 'var'   // vars & imports both say "defined but never used"
    if (msg.includes('is assigned a value but never used')) kind = 'var'
    if (msg.includes('is declared but its value is never read')) kind = 'var'
    if (msg.includes('All destructured elements are unused')) kind = 'var'
    if (msg.includes('args must match') || /is defined but never used.*args/.test(msg)) kind = 'arg'
    // Distinguish imports: "is defined but never used. Allowed unused vars" with the line being an import
    byKind[kind]++
    fileCount++
    byFile[f.filePath] = (byFile[f.filePath] || 0) + 1
    if (samples[kind].length < 6) samples[kind].push(`${f.filePath.split(/[\\/]/).slice(-2).join('/')}:${m.line} | ${msg.slice(0, 80)}`)
  }
  if (fileCount) byFile[f.filePath] = fileCount
}
console.log('kinds:', JSON.stringify(byKind))
console.log('files with unused-vars:', Object.keys(byFile).length)
const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)
console.log('top files:')
for (const [p, c] of top) console.log(' ', c, p.split(/[\\/]/).slice(-3).join('/'))
console.log('\n--- import samples ---')
for (const s of samples.import) console.log(' ', s)
console.log('\n--- var samples ---')
for (const s of samples.var) console.log(' ', s)
console.log('\n--- arg samples ---')
for (const s of samples.arg) console.log(' ', s)
