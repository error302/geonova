/**
 * Fix mis-wired label <-> control id pairs (2026-08-04).
 *
 * Root cause of the 141 audit findings: a prior codemod assigned ids to
 * previously-id-less inputs using the OLDEST label htmlFor in a backward
 * scan window, so inputs got the *previous field's* id (duplicates) and
 * their own label's htmlFor went orphaned.
 *
 * Fix strategy (two passes per file):
 *  Pass 1 — pairing: for every <label htmlFor="X">, bind X to the FIRST
 *           control (input/select/textarea) that appears after the label
 *           and before the next labeled label (within a 10-line window).
 *           Overwrites a wrong/duplicate id on that control.
 *  Pass 2 — dedupe: any id still present on 2+ controls — keep the first
 *           (the label's target), remove the id attribute from the rest
 *           (unnamed grid cells; their aria-label provides the name).
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

/** Parse tags → [{type:'label'|'control', tag, start, end, line, id, htmlFor}] */
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
let pairFixed = 0, dedupeRemoved = 0

for (const file of walk(SRC)) {
  const content = readFileSync(file, 'utf8')
  const tags = parseTags(content)
  if (tags.length === 0) continue
  let mutated = false
  let next = content

  // ---- Pass 1: label -> next control pairing -----------------------------
  const labels = tags.filter(t => t.type === 'label')
  for (let li = 0; li < labels.length; li++) {
    const lab = labels[li]
    const nextLabel = labels.slice(li + 1).find(l => l.line <= lab.line + 10) || null
    const windowEndLine = nextLabel ? nextLabel.line : Infinity
    // Controls strictly after this label, before the next label, within 10 lines.
    const target = tags.find(t =>
      t.type === 'control' &&
      t.line > lab.line &&
      t.line <= lab.line + 10 &&
      t.line < windowEndLine
    )
    if (!target) continue
    if (target.id === lab.htmlFor) continue
    // Overwrite the control's id with the label's htmlFor.
    const re = new RegExp(`(\\bid=)("[^"]*")`)
    const slice = next.slice(target.start, target.end)
    const m = slice.match(re)
    if (m) {
      next = next.slice(0, target.start + m.index) +
        m[1] + '"' + lab.htmlFor + '"' +
        next.slice(target.start + m.index + m[0].length)
    } else {
      // No id on the control: insert id right after the tag name.
      const tagNameRe = /^<\s*[a-zA-Z][a-zA-Z0-9]*\s*/
      const tName = slice.match(tagNameRe)[0]
      next = next.slice(0, target.start) + slice.replace(tagNameRe, tName + ` id="${lab.htmlFor}" `) + next.slice(target.end)
    }
    target.id = lab.htmlFor
    pairFixed++
    mutated = true
  }

  // Re-parse after pass 1 for accurate dedupe.
  const tags2 = parseTags(next)
  const controls = tags2.filter(t => t.type === 'control' && t.id)
  const counts = new Map()
  for (const c of controls) counts.set(c.id, (counts.get(c.id) || 0) + 1)

  // ---- Pass 2: remove duplicated ids (keep first occurrence) -------------
  const seen = new Set()
  for (const c of controls) {
    if (counts.get(c.id) < 2) continue
    if (!seen.has(c.id)) { seen.add(c.id); continue }
    // Remove the id attribute from this duplicate.
    const slice = next.slice(c.start, c.end)
    const re = /\s+id="[^"]*"/
    const m = slice.match(re)
    if (m) {
      next = next.slice(0, c.start + m.index) + next.slice(c.start + m.index + m[0].length)
      dedupeRemoved++
      mutated = true
    }
  }

  if (mutated) filesToWrite.set(file, next)
}

let files = 0
for (const [file, content] of filesToWrite) {
  writeFileSync(file, content, 'utf8'); files++
  console.log('fixed', file.replace(/\\/g, '/'))
}
console.log(`\npairings fixed: ${pairFixed} | duplicate ids removed: ${dedupeRemoved} | files: ${files}`)
