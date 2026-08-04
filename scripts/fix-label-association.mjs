#!/usr/bin/env node
/**
 * Codemod: fix jsx-a11y/label-has-associated-control violations.
 *
 * Pattern handled (the dominant one codebase-wide):
 *   <label className="...">Text</label>
 *   <input|select|textarea ... />
 *
 * For each standalone <label> (no htmlFor, does NOT wrap a control, no JSX
 * expression in its text) that is immediately followed by a control, add
 * htmlFor to the label and a matching unique id to the control.
 *
 * Skips (left for manual handling):
 *  - labels that already have htmlFor/for
 *  - labels that wrap a control
 *  - labels whose text contains a JSX expression
 *  - labels followed by a div/group of controls (composite)
 *  - controls that already have an id
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walk(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (ent.name.endsWith('.tsx') || ent.name.endsWith('.ts')) out.push(p)
  }
  return out
}

function slugify(text) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&deg;/gi, 'deg')
    .replace(/&amp;/gi, 'and')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, 'lt')
    .replace(/&gt;/gi, 'gt')
    .replace(/&#39;|&quot;/gi, ' ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

let totalFixed = 0
const changed = []

for (const file of walk(SRC)) {
  const orig = readFileSync(file, 'utf8')
  const labelRe = /<label\b([^>]*)>([\s\S]*?)<\/label>/g

  // Build output pieces + owed control replacement for the between-region.
  const pieces = []
  let cursor = 0
  let owed = null // { controlStartOffsetInBetween, replacement }
  let fixed = 0
  const used = new Map() // slug -> count

  let m
  while ((m = labelRe.exec(orig)) !== null) {
    const [full, attrs, inner] = m
    const start = m.index
    const end = labelRe.lastIndex

    // Between-region (from cursor to this label) — apply owed control replace.
    let between = orig.slice(cursor, start)
    if (owed) {
      between = between.replace(
        /^(\s*)(<(?:input|select|textarea)\b)/,
        (_, ws, tag) => ws + tag.replace(/^(<(?:input|select|textarea))\b/, `$1 id="${owed.id}"`)
      )
      owed = null
    }
    pieces.push(between)
    cursor = end

    // Decide this label
    const skip =
      /\bhtmlFor\s*=/.test(attrs) ||
      /\bfor\s*=/.test(attrs) ||
      /<(input|select|textarea)\b/i.test(inner) ||
      /\{[^}]/.test(inner)

    if (skip) {
      pieces.push(full)
      continue
    }

    const after = orig.slice(end)
    const nxt = after.match(/^\s*<(input|select|textarea)\b([^>]*)(\/?>)/)
    if (!nxt) {
      pieces.push(full)
      continue
    }
    if (/\bid\s*=/.test(nxt[2])) {
      pieces.push(full)
      continue
    }

    // Build a unique id from the visible text.
    const text = inner.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    let slug = slugify(text)
    if (!slug) slug = 'field'
    const count = used.get(slug) || 0
    const id = count === 0 ? slug : `${slug}-${count + 1}`
    used.set(slug, count + 1)

    // Rewrite label open tag: inject htmlFor before final '>'.
    const labelOpen = `<label${attrs}`
    const newLabel = `${labelOpen} htmlFor="${id}">`

    pieces.push(newLabel + inner + '</label>')

    // Owe the control replacement in the next between-region.
    owed = { id }

    fixed++
  }

  pieces.push(orig.slice(cursor))

  const out = pieces.join('')
  if (out !== orig) {
    writeFileSync(file, out, 'utf8')
    totalFixed += fixed
    changed.push(`${String(fixed).padStart(3)}  ${file.replace(ROOT + '\\', '')}`)
  }
}

console.log(`=== FIXED ${totalFixed} labels across ${changed.length} files ===`)
for (const line of changed) console.log(line)
