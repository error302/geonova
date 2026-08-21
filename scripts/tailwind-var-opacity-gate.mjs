#!/usr/bin/env node
/**
 * tailwind-var-opacity-gate.mjs — bans Tailwind arbitrary utilities that
 * combine a CSS variable with an opacity modifier, e.g.
 *
 *     bg-[var(--accent)]/10      border-[var(--border-color)]/30
 *     text-[var(--text-muted)]/50
 *
 * Tailwind 3.4 cannot resolve the color type of a bare var(), so the
 * opacity modifier makes the JIT emit NO rule at all — the class is
 * silently dead. 1,025 such utilities shipped invisible for weeks
 * (fixed 2026-08-21 by codemod to explicit color-mix() arbitrary values,
 * which Tailwind emits verbatim and every evergreen browser supports).
 *
 * This gate blocks that class of bug from returning:
 *   PREFIX-[var(--NAME)]/N   (any N)  →  use
 *   PREFIX-[color-mix(in_srgb,var(--NAME)_N%,transparent)]  instead
 *
 * Usage:
 *   node scripts/tailwind-var-opacity-gate.mjs
 *
 * Exit code: 0 = clean, 1 = violations found. Wired into ci.yml.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = process.env.TW_VAR_OPACITY_SRC || join(process.cwd(), 'src')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    // .tsx holds className strings; .ts can too (class helpers/constants)
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(p)
  }
  return out
}

// Matches bg-[var(--x)]/10, hover:border-[var(--y)]/30, md:text-[var(--z)]/50 …
// Variant prefixes are captured only to be reported; the dead part is
// PROP-[var(--NAME)]/N.
const DEAD_PATTERN =
  /((?:[a-z]+:)*)(bg|border|text|from|to|via|ring|divide|outline|shadow|decoration|accent|caret|fill|stroke)-\[var\(--[a-z0-9-]+\)\]\/\d+\b/g

function scanSource(content, file) {
  const violations = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    DEAD_PATTERN.lastIndex = 0
    let m
    while ((m = DEAD_PATTERN.exec(lines[i])) !== null) {
      violations.push({
        file: relative(process.cwd(), file),
        line: i + 1,
        match: m[0],
        hint: `${m[2]}-[color-mix(in_srgb,var(--NAME)_N%,transparent)]`,
      })
    }
  }
  return violations
}

function main() {
  const files = walk(SRC)
  const violations = []
  for (const file of files) {
    violations.push(...scanSource(readFileSync(file, 'utf8'), file))
  }

  if (violations.length === 0) {
    console.log(`tailwind-var-opacity-gate: OK — 0 dead var()+opacity utilities across ${files.length} files`)
    process.exit(0)
  }

  console.log(`tailwind-var-opacity-gate: ${violations.length} dead utility class(es) found`)
  console.log('  (Tailwind 3.x emits NO rule for var() + /opacity — the class silently does nothing)\n')
  const byFile = {}
  for (const v of violations) {
    byFile[v.file] = (byFile[v.file] ?? 0) + 1
    if ((byFile[v.file] <= 3)) {
      console.log(`  ${v.file}:${v.line}  ${v.match}`)
      console.log(`      → ${v.hint}`)
    }
  }
  console.log(`\n…across ${Object.keys(byFile).length} file(s).`)
  console.log('Replace with an explicit color-mix arbitrary value (see hint) or a plain rgba().')
  process.exit(1)
}

main()
