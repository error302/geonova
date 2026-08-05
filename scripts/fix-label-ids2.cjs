/**
 * Label/control id integrity repair — pass 2 (2026-08-04).
 *
 * Fixes the two remaining defect classes the audit reports:
 *
 *  A. ORPHAN-LABEL: <label htmlFor="X"> where no control has id="X". The
 *     intended control is the one immediately following the label (SAME line
 *     allowed — previous pass required strictly-greater line, so same-line
 *     pairs were missed). Set/insert id="X" on that control.
 *  B. DUPLICATE-ID / MULTI-TARGET: id="X" on 2+ controls. The true target is
 *     the control that follows the <label htmlFor="X">; remove the id from
 *     every other control carrying X.
 *
 * All edits are applied in REVERSE offset order so removals never invalidate
 * a later edit position.
 */
const { readFileSync, writeFileSync, readdirSync } = require('fs')
const { join } = require('path')

const SRC = join(process.cwd(), 'src')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

function parseTags(content) {
  const tags = []
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
    const name = (tag.match(/^<\s*([a-zA-Z][a-zA-Z0-9]*)/) || [])[1]
    if (!name) continue
    const lname = name.toLowerCase()
    const line = content.slice(0, lt).split('\n').length
    const idM = tag.match(/\bid="([^"]+)"/)
    const hfM = tag.match(/htmlFor="([^"]+)"/)
    if (lname === 'label') {
      if (hfM) tags.push({ type: 'label', tag, start: lt, end: j + 1, line, id: null, htmlFor: hfM[1] })
    } else if (['input', 'select', 'textarea'].includes(lname)) {
      tags.push({ type: 'control', tag, start: lt, end: j + 1, line, id: idM ? idM[1] : null, htmlFor: null })
    }
  }
  return tags
}

const filesToWrite = new Map()
let orphanFixed = 0, dedupeFixed = 0

for (const file of walk(SRC)) {
  const content = readFileSync(file, 'utf8')
  const tags = parseTags(content)
  const labels = tags.filter(t => t.type === 'label')
  const controls = tags.filter(t => t.type === 'control')
  const edits = [] // {offset, length, replacement} — applied reverse-order

  // ---- Pass A: orphan labels ---------------------------------------------
  const controlIds = new Set(controls.filter(c => c.id).map(c => c.id))
  for (let li = 0; li < labels.length; li++) {
    const lab = labels[li]
    if (controlIds.has(lab.htmlFor)) continue
    // Find the control that follows this label (same line allowed), before
    // the next labeled label or a </label> boundary 10 lines down.
    const nextLabel = labels.slice(li + 1).find(l => l.line <= lab.line + 10) || null
    const windowEnd = nextLabel ? nextLabel.line : Infinity
    const target = controls.find(c =>
      c.line >= lab.line && c.line <= lab.line + 10 && c.line < windowEnd
    )
    if (!target) continue
    if (target.id === lab.htmlFor) continue
    const slice = content.slice(target.start, target.end)
    if (target.id) {
      // Replace existing (wrong) id.
      const re = /\bid="([^"]*)"/.exec(slice)
      if (re) {
        edits.push({ offset: target.start + re.index, length: re[0].length, replacement: `id="${lab.htmlFor}"` })
      }
    } else {
      // Insert id after the tag name.
      const m = /^<\s*[a-zA-Z][a-zA-Z0-9]*\s*/.exec(slice)
      if (m) {
        edits.push({ offset: target.start + m.index, length: m[0].length, replacement: m[0].trimEnd() + ` id="${lab.htmlFor}" ` })
      }
    }
    controlIds.add(lab.htmlFor)
    orphanFixed++
  }

  // ---- Pass B: duplicate ids (true target = control after its label) -----
  const counts = new Map()
  for (const c of controls) if (c.id) counts.set(c.id, (counts.get(c.id) || 0) + 1)
  for (const [id, n] of counts) {
    if (n < 2) continue
    const lab = labels.find(l => l.htmlFor === id)
    const holders = controls.filter(c => c.id === id)
    let keep = null
    if (lab) {
      keep = holders.find(c => c.line >= lab.line && c.line <= lab.line + 10) || holders[0]
    }
    if (!keep) keep = holders[0]
    for (const h of holders) {
      if (h === keep) continue
      const slice = content.slice(h.start, h.end)
      const re = /\s+id="[^"]*"/.exec(slice)
      if (re) {
        edits.push({ offset: h.start + re.index, length: re[0].length, replacement: '' })
        dedupeFixed++
      }
    }
  }

  if (edits.length === 0) continue
  edits.sort((a, b) => b.offset - a.offset)
  let next = content
  for (const e of edits) {
    next = next.slice(0, e.offset) + e.replacement + next.slice(e.offset + e.length)
  }
  filesToWrite.set(file, next)
}

let files = 0
for (const [file, content] of filesToWrite) {
  writeFileSync(file, content, 'utf8'); files++
  console.log('fixed', file.replace(/\\/g, '/'))
}
console.log(`\norphan labels fixed: ${orphanFixed} | duplicate ids removed: ${dedupeFixed} | files: ${files}`)
