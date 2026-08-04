#!/usr/bin/env node
/**
 * aria-label-gate.mjs — bans placeholder-like / junk aria-labels so accessible
 * names can't regress in tables and forms.
 *
 * Junk classes flagged (each is a real a11y defect — the accessible name
 * either repeats the placeholder, is a generic phrase, is punctuation, or is
 * crunched header text with no spaces):
 *
 *   1. empty        — aria-label="" (no accessible name at all)
 *   2. punctuation  — value has no letters or digits ('—', '…', '-', '…')
 *   3. generic      — blocklisted placeholder phrases ('field note',
 *                     'cell value', 'field value', 'text input', …)
 *   4. crunched     — a single token with a lowercase→uppercase camelCase
 *                     boundary ('surveyorName', 'pointId') or a known
 *                     run-on word ('Surveyorname'), minus brand allowlist
 *   5. placeholder-equals-name — aria-label value duplicates the element's
 *                     own placeholder attribute (e.g. aria-label="0.000"
 *                     placeholder="0.000"). The label must be a real
 *                     description, never the sample value.
 *
 * The classification logic lives in ONE place —
 * eslint-plugin-metardu/shared/junk-classification.cjs — shared with the
 * AST rule eslint-plugin-metardu/rules/no-placeholder-as-aria-label.js, so
 * the regex gate and the ESLint rule can never drift apart.
 *
 * Usage:
 *   node scripts/aria-label-gate.mjs            # whole src/ tree (CI hard gate)
 *   node scripts/aria-label-gate.mjs --json     # machine-readable report
 *
 * Exit code: 0 = clean, 1 = violations found. Wired into ci.yml + pr-checks.yml.
 *
 * scanSource() is exported so tests can unit-test the scanner without a
 * subprocess (tests/aria-label-gate.test.ts).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const { classify } = require('../eslint-plugin-metardu/shared/junk-classification.cjs')

// ARIA_GATE_SRC is a test seam: tests point the gate at a temp dir full of
// fixtures instead of the real src/ tree (see tests/aria-label-gate.test.ts).
const SRC = process.env.ARIA_GATE_SRC || join(process.cwd(), 'src')
const JSON_OUT = process.argv.includes('--json')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    // JSX (and therefore aria-label props) only exists in .tsx files.
    // Scanning only .tsx avoids false positives from string literals in
    // .ts modules (comments, tests, constants that quote 'aria-label="..."').
    if (entry.isDirectory()) walk(p, out)
    else if (entry.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/**
 * Extract aria-label + placeholder from a single JSX element tag.
 * Handles both aria-label="..." and aria-label={...} literal forms.
 */
function extractAttrs(tag) {
  const ariaMatch = tag.match(/aria-label=(?:"([^"]*)"|'([^']*)'|\{["'`]([^"'`]*)["'`]\})/)
  const phMatch = tag.match(/placeholder=(?:"([^"]*)"|'([^']*)'|\{["'`]([^"'`]*)["'`]\})/)
  return {
    aria: ariaMatch ? (ariaMatch[1] ?? ariaMatch[2] ?? ariaMatch[3] ?? '') : null,
    placeholder: phMatch ? (phMatch[1] ?? phMatch[2] ?? phMatch[3] ?? '') : null,
  }
}

/**
 * Scan one file's source for junk aria-labels.
 *
 * Linear, quote-aware tag scanner (O(n) — no regex backtracking on large
 * files). Walks the buffer, and for every '<' finds the matching '>' while
 * tracking quote + JSX-brace state, so:
 *   - a literal '>' inside a quoted attribute value (e.g.
 *     placeholder="a > b") does not truncate the tag;
 *   - a '>' inside a JSX attribute expression (e.g. onChange={e => ...})
 *     does not truncate the tag — brace depth must return to 0 first.
 *     Without this, every tag carrying an arrow-function handler was
 *     silently skipped, so placeholder-equals-name and other junk labels
 *     in those tags evaded the gate entirely (found 2026-08-04).
 * Template-literal backticks are tracked as quotes too, so braces inside
 * `` `${a > b}` `` are not mistaken for JSX braces.
 *
 * FIND #2 (2026-08-04): Only treat '<' as a tag start when the next char
 * plausibly begins a JSX tag — a letter, '/' (closing tag), '>' (fragment)
 * or '!'. A bare '<' from a less-than comparison in plain JS (e.g.
 * `d < 0`) previously started a bogus "tag" whose quote/brace state machine
 * walked the ENTIRE rest of the file without ever hitting '>' at depth 0,
 * then `if (j >= n) break` silently dropped every later real tag — so
 * placeholder-equals-name and other junk labels in those files evaded the
 * gate entirely (found when the AST rule flagged 39 regressions the gate
 * reported clean). The EOF case now advances one char and keeps scanning
 * instead of bailing out.
 *
 * @param {string} content file source
 * @param {string} file    path used for reporting (relative to cwd)
 * @returns {Array<{file: string, line: number, column: number, kind: string, value: string, snippet: string}>}
 */
export function scanSource(content, file) {
  const violations = []
  let i = 0
  const n = content.length
  while (i < n) {
    const lt = content.indexOf('<', i)
    if (lt === -1) break
    // Skip '<' not followed by a JSX-tag-start character.
    const after = lt + 1 < n ? content[lt + 1] : ''
    if (!/[a-zA-Z/>!]/.test(after)) {
      i = lt + 1
      continue
    }
    let j = lt + 1
    let quote = null
    let braceDepth = 0
    while (j < n) {
      const c = content[j]
      if (quote) {
        if (c === quote) quote = null
      } else if (c === '"' || c === "'" || c === '`') {
        quote = c
      } else if (c === '{') {
        braceDepth++
      } else if (c === '}') {
        if (braceDepth > 0) braceDepth--
      } else if (c === '>' && braceDepth === 0) {
        break
      }
      j++
    }
    // Never terminate at EOF: advance one char and keep scanning so a stray
    // unparseable '<' can't silently disable the gate for the rest of the
    // file (the pre-FIND #2 failure mode).
    if (j >= n) {
      i = lt + 1
      continue
    }
    const tag = content.slice(lt, j + 1)
    i = j + 1
    if (tag.indexOf('aria-label') === -1) continue
    const { aria, placeholder } = extractAttrs(tag)
    if (aria === null) continue
    const kind = classify(aria, placeholder)
    if (!kind) continue

    // Locate line/column
    const upTo = content.slice(0, lt)
    const line = upTo.split('\n').length
    const col = lt - upTo.lastIndexOf('\n')
    violations.push({
      file: relative(process.cwd(), file),
      line,
      column: col + 1,
      kind,
      value: aria,
      snippet: tag.slice(0, 120),
    })
  }
  return violations
}

function main() {
  const files = walk(SRC)
  const violations = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    violations.push(...scanSource(content, file))
  }

  const byKind = {}
  for (const v of violations) byKind[v.kind] = (byKind[v.kind] ?? 0) + 1

  if (JSON_OUT) {
    console.log(JSON.stringify({ violations, summary: byKind, total: violations.length }, null, 2))
  } else {
    if (violations.length === 0) {
      console.log(`aria-label-gate: OK — 0 junk aria-labels across ${files.length} files`)
      process.exit(0)
    }
    console.log(`aria-label-gate: ${violations.length} junk aria-label(s) found\n`)
    for (const v of violations) {
      console.log(`  ${v.file}:${v.line}:${v.column}  [${v.kind}]  "${v.value}"`)
      console.log(`      ${v.snippet}…`)
    }
    console.log('\nSummary by class:')
    for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${n}`)
    console.log('\nFix the accessible names (derive from the visible label or column header) —\nnever duplicate the placeholder value.')
  }
  // Exit non-zero whenever violations exist, regardless of output mode, so
  // machine-readable consumers (CI wrappers passing --json) still block.
  process.exit(violations.length > 0 ? 1 : 0)
}

// Run as a CLI only when invoked directly (not when imported by tests).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) main()
