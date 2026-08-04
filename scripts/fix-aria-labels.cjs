/**
 * One-off codemod (2026-08-04): placeholder-equals-name sweep, pass 2.
 *
 * For every flagged `aria-label="X" placeholder="X"` input that ALSO has a
 * matching `<label htmlFor="...">` association, remove the redundant
 * aria-label entirely — the label already provides the accessible name.
 *
 * Robust tag reconstruction: scans BACKWARD from the flagged line to find the
 * `<input`, then forward to the matching `>` while tracking quotes + JSX
 * braces, so multi-line tags (id on one line, aria-label on another) are
 * handled correctly.
 */
const d = JSON.parse(require('fs').readFileSync(process.argv[2] || 'aria-violations.json', 'utf8'))
const { readFileSync, writeFileSync } = require('fs')

let lastFile = null
let lines = null
const filesToWrite = new Map()
let removedCount = 0

for (const v of d.violations) {
  const file = v.file
  if (file !== lastFile) { lastFile = file; lines = readFileSync(file, 'utf8').split(/\r?\n/) }

  // Find '<input' by scanning backward up to 8 lines from the flagged line.
  let tagStartIdx = -1
  for (let i = v.line - 1; i >= Math.max(0, v.line - 9); i--) {
    if (lines[i].includes('<input')) { tagStartIdx = i; break }
  }
  if (tagStartIdx === -1) continue

  // Scan forward to the tag's closing '>' tracking quotes + braces.
  let tagEndIdx = -1
  let quote = null
  let braceDepth = 0
  for (let i = tagStartIdx; i < lines.length && i < tagStartIdx + 10; i++) {
    const line = lines[i]
    for (const c of line) {
      if (quote) { if (c === quote) quote = null }
      else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') braceDepth++
      else if (c === '}') { if (braceDepth > 0) braceDepth-- }
      else if (c === '>' && braceDepth === 0) { tagEndIdx = i; break }
    }
    if (tagEndIdx !== -1) break
  }
  if (tagEndIdx === -1) continue

  const tag = lines.slice(tagStartIdx, tagEndIdx + 1).join(' ')
  const idMatch = tag.match(/\bid="([^"]+)"/)
  if (!idMatch) continue

  // Prove a <label htmlFor="id"> exists above (within 30 lines).
  const id = idMatch[1]
  let hasLabel = false
  for (let i = Math.max(0, v.line - 31); i < v.line - 1; i++) {
    if (lines[i].includes('htmlFor="' + id + '"')) { hasLabel = true; break }
  }
  if (!hasLabel) continue

  // Remove `aria-label="..."` (quoted literal) wherever it sits in the tag.
  const attrRe = /\s+aria-label="[^"]*"/
  let removed = false
  for (let i = tagStartIdx; i <= tagEndIdx; i++) {
    if (attrRe.test(lines[i])) {
      lines[i] = lines[i].replace(attrRe, '')
      removed = true
      removedCount++
      break
    }
  }
  if (removed) filesToWrite.set(file, lines.join('\r\n'))
}

let count = 0
for (const [file, content] of filesToWrite) {
  writeFileSync(file, content, 'utf8')
  count++
  console.log('fixed', file.replace(/\\/g, '/'))
}
console.log('\naria-labels removed:', removedCount, '| files rewritten:', count)
