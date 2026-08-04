/**
 * Audit label <-> input id integrity across changed .tsx files.
 *
 * Reports three defect classes:
 *  1. duplicate-id   — the same id="X" appears on 2+ form controls
 *  2. orphan-label   — <label htmlFor="X"> where no control has id="X"
 *  3. multi-target   — label htmlFor="X" where X exists on 2+ controls
 */
const { readFileSync, readdirSync } = require('fs')
const { execSync } = require('child_process')
const { join, relative } = require('path')

const root = process.cwd()
const SRC = join(root, 'src')

// Changed .tsx files from git
let changedRaw = ''
try {
  changedRaw = execSync('git diff --name-only HEAD -- "src/**/*.tsx"', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString()
} catch (e) {
  changedRaw = execSync('git diff --name-only -- "src/**/*.tsx"', { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString()
}
const changed = new Set(changedRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(p => join(root, p.replace(/\//g, '\\'))))

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

let filesChecked = 0
const findings = []

for (const file of walk(SRC)) {
  if (!changed.has(file)) continue
  const content = readFileSync(file, 'utf8')
  filesChecked++

  // Extract ids on form controls (input/select/textarea) — linear tag scan.
  const controlIds = [] // {id, line}
  const labelRefs = [] // {htmlFor, line}
  let i = 0
  const n = content.length
  while (i < n) {
    const lt = content.indexOf('<', i)
    if (lt === -1) break
    let j = lt + 1
    let quote = null
    let braceDepth = 0
    while (j < n) {
      const c = content[j]
      if (quote) { if (c === quote) quote = null }
      else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') braceDepth++
      else if (c === '}') { if (braceDepth > 0) braceDepth-- }
      else if (c === '>' && braceDepth === 0) break
      j++
    }
    if (j >= n) break
    const tag = content.slice(lt, j + 1)
    i = j + 1

    const tagName = (tag.match(/^<\s*([a-zA-Z][a-zA-Z0-9]*)/) || [])[1]
    if (!tagName) continue
    const isControl = ['input', 'select', 'textarea'].includes(tagName.toLowerCase())
    const line = content.slice(0, lt).split('\n').length

    const idMatch = tag.match(/\bid="([^"]+)"/)
    if (isControl && idMatch) controlIds.push({ id: idMatch[1], line })

    if (tagName.toLowerCase() === 'label') {
      const m = tag.match(/htmlFor="([^"]+)"/)
      if (m) labelRefs.push({ htmlFor: m[1], line })
    }
  }

  // Duplicate control ids
  const seen = new Map()
  for (const c of controlIds) {
    if (seen.has(c.id)) {
      findings.push(`DUPLICATE-ID  ${relative(root, file)}  id="${c.id}"  lines ${seen.get(c.id)} & ${c.line}`)
    } else seen.set(c.id, c.line)
  }

  // Orphan / multi-target labels
  for (const l of labelRefs) {
    const matches = controlIds.filter(c => c.id === l.htmlFor)
    if (matches.length === 0) {
      findings.push(`ORPHAN-LABEL  ${relative(root, file)}:${l.line}  htmlFor="${l.htmlFor}" -> no control has this id`)
    } else if (matches.length > 1) {
      findings.push(`MULTI-TARGET  ${relative(root, file)}:${l.line}  htmlFor="${l.htmlFor}" -> ${matches.length} controls (lines ${matches.map(m => m.line).join(',')})`)
    }
  }
}

console.log(`Audited ${filesChecked} changed .tsx files`)
console.log(`Findings: ${findings.length}`)
for (const f of findings) console.log('  ' + f)
process.exit(findings.length > 0 ? 1 : 0)
