/**
 * Regression + parity tests for the junk aria-label enforcement stack:
 *
 *  - scripts/aria-label-gate.mjs  (whole-repo CI regex gate)
 *  - eslint-plugin-metardu/rules/no-placeholder-as-aria-label.js (AST rule)
 *
 * FIND #2 regression (2026-08-04): the gate's linear scanner treated the '<'
 * of a plain-JS less-than comparison (`d < 0`) as a JSX tag start, then its
 * quote/brace state machine walked the ENTIRE rest of the file without ever
 * hitting '>' at depth 0, silently dropping every later real tag — so 39
 * placeholder-equals-name regressions evaded CI. These tests pin that fix by
 * running the REAL gate CLI (subprocess) against fixture files, via the
 * ARIA_GATE_SRC test seam (the gate normally scans the repo src/ tree).
 */
import * as path from 'node:path'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { classify } = require(path.join(__dirname, '..', 'eslint-plugin-metardu', 'shared', 'junk-classification.cjs'))

const GATE = path.join(__dirname, '..', 'scripts', 'aria-label-gate.mjs')
const ROOT = path.join(__dirname, '..')

/** Write fixtures into a temp dir and run the real gate CLI against them. */
function runGateOn(files: Record<string, string>): { code: number; output: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'aria-gate-'))
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(dir, name), content, 'utf8')
    }
    try {
      const output = execFileSync('node', [GATE, '--json'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ARIA_GATE_SRC: dir },
      })
      return { code: 0, output }
    } catch (err: any) {
      // Non-zero exit carries the JSON report on stdout.
      return { code: err.status ?? 1, output: String(err.stdout ?? '') }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('aria-label-gate scanner (FIND #2 regression)', () => {
  test('still finds a junk aria-label AFTER a plain-JS less-than comparison', () => {
    // The pre-fix scanner died at `d < 0` and silently skipped the <input> tag.
    const src = [
      'export function Overdue(days: number) {',
      '  if (d < 0) return `${Math.abs(d)}d overdue`',
      '  return null',
      '}',
      'export function Bad() {',
      '  return <input aria-label="0.000" placeholder="0.000" />',
      '}',
    ].join('\n')
    const { code, output } = runGateOn({ 'case.tsx': src })
    expect(code).toBe(1)
    expect(output).toContain('placeholder-equals-name')
  })

  test('still finds a junk aria-label AFTER a TS generic/arrow region', () => {
    const src = [
      'export function map<T>(xs: T[], f: (x: T) => T): T[] {',
      '  return xs.map((x) => f(x))',
      '}',
      'export function Bad() {',
      '  return <textarea aria-label="field note" placeholder="note" />',
      '}',
    ].join('\n')
    const { code, output } = runGateOn({ 'case.tsx': src })
    expect(code).toBe(1)
    expect(output).toContain('generic')
  })

  test('clean file stays clean (no false positives from plain JS)', () => {
    const src = [
      'export function Overdue(days: number) {',
      '  if (d < 0) return `${Math.abs(d)}d overdue`',
      '  const ok = a < b && c > d',
      '  return null',
      '}',
      'export function Good() {',
      '  return <input aria-label="Easting (m)" placeholder="0.000" />',
      '}',
    ].join('\n')
    const { code } = runGateOn({ 'case.tsx': src })
    expect(code).toBe(0)
  })
})

describe('rule/gate classification parity (single shared module)', () => {
  // Both consumers import the SAME module (eslint-plugin-metardu/shared/
  // junk-classification.cjs), so parity is structural — these tests guard the
  // contract that the shared module keeps working for both consumers.
  test('placeholder-equals-name fires', () => {
    expect(classify('0.000', '0.000')).toBe('placeholder-equals-name')
  })

  test('allowlisted token wins over run-on word list', () => {
    expect(classify('SurveyorName', 'J. Doe')).toBeNull()
    expect(classify('surveyorname', 'J. Doe')).toBe('crunched')
  })

  test('real descriptive label with a different placeholder passes', () => {
    expect(classify('Easting (m)', '0.000')).toBeNull()
    expect(classify('Design Pressure (kPa)', '0.0')).toBeNull()
  })

  test('whitespace-padded placeholder variant is caught (trimmed compare)', () => {
    expect(classify('0.000', ' 0.000 ')).toBe('placeholder-equals-name')
  })

  test('dynamic labels never false-flag', () => {
    expect(classify('Measure point ${pointId}', '1')).toBeNull()
    expect(classify('', null)).toBe('empty')
    expect(classify('—', null)).toBe('punctuation')
    expect(classify('field note', 'note')).toBe('generic')
  })
})
