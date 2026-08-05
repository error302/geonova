/**
 * junk-classification.cjs — SINGLE source of truth for junk aria-label
 * classification, shared by:
 *
 *   - eslint-plugin-metardu/rules/no-placeholder-as-aria-label.js (AST rule)
 *   - scripts/aria-label-gate.mjs (whole-repo CI regex gate)
 *
 * Keeping both consumers on this one module guarantees they can never drift
 * apart (the pre-2026-08-04 state had the blocklists + logic duplicated, and
 * the two copies silently diverged).
 *
 * Junk classes flagged (same taxonomy in both consumers):
 *
 *   1. empty                   — aria-label="" (no accessible name at all)
 *   2. punctuation             — value has no letters or digits ('—', '…', '-')
 *   3. generic                 — blocklisted placeholder phrases
 *                                ('field note', 'cell value', 'input', …)
 *   4. crunched                — a single token with a lowercase→uppercase
 *                                camelCase boundary ('surveyorName',
 *                                'pointId') or a known run-on word
 *   5. placeholder-equals-name — aria-label value duplicates the element's own
 *                                placeholder attribute (e.g. aria-label="0.000"
 *                                placeholder="0.000"). The label must be a real
 *                                description, never the sample value.
 */
'use strict'

/** Generic placeholder phrases that must never be an accessible name. */
const BANNED_PHRASES = new Set([
  'field note',
  'cell value',
  'field value',
  'text input',
  'input',
  'value',
  'text',
  'enter value',
  'type here',
  'placeholder',
  'click to edit',
  'edit value',
  'enter text',
  'data',
  'field',
  'row',
  'cell',
])

/** Run-on / crunched words seen in the codebase (header text with spaces removed). */
const BANNED_CRUNCHED = new Set([
  'surveyorname',
  'surveyorregistration',
  'surveyorfirm',
  'surveyorregno',
  'pointid',
  'starttime',
  'deltae',
  'fieldnote',
  'eastingnorthing',
  'instrumentheight',
  'targetheight',
  'verticalangle',
  'slopedistance',
  'drawingtitle',
  'calibrationdate',
  'lastcalibrationdate',
  'purchasedate',
  'labelrowsas',
  'labelcolumnsas',
])

/** Legit single-token labels that would otherwise trip the crunched check. */
const ALLOWED_TOKENS = new Set(['GitHub', 'METARDU', 'SurveyorName'])

/**
 * Classify a junk aria-label value (or null when it's a real accessible name).
 *
 * @param {string|null} value       raw aria-label attribute value
 * @param {string|null} placeholder raw placeholder attribute value (nullable)
 * @returns {'empty'|'punctuation'|'generic'|'crunched'|'placeholder-equals-name'|null}
 */
function classify(value, placeholder) {
  const v = (value ?? '').trim()
  if (v === '') return 'empty'
  // punctuation / symbol-only (no letters, no digits, not whitespace)
  if (!/[\p{L}\p{N}]/u.test(v)) return 'punctuation'
  // generic placeholder phrases
  if (BANNED_PHRASES.has(v.toLowerCase())) return 'generic'
  // crunched single tokens: camelCase boundary OR known run-on word.
  // Only single tokens (no whitespace, no digits, no template interpolation)
  // are checked so dynamic labels ('Measure point ${pointId}') and units
  // ('Design Pressure (kPa)') are not false-flagged. The explicit allowlist
  // must win over the run-on word list (e.g. 'SurveyorName' is legit even
  // though 'surveyorname' is a known crunched form).
  if (ALLOWED_TOKENS.has(v)) {
    // fall through to placeholder check below
  } else if (BANNED_CRUNCHED.has(v.toLowerCase())) {
    return 'crunched'
  } else if (
    !/\s/.test(v) &&
    !/\$\{/.test(v) &&
    !/\d/.test(v) &&
    /[a-z][A-Z]/.test(v)
  ) {
    return 'crunched'
  }
  // aria-label duplicating its own placeholder (trimmed comparison so
  // whitespace variants like aria-label="0.000 " placeholder="0.000" can't
  // slip through the net).
  if (placeholder !== null && placeholder.trim() !== '' && placeholder.trim() === v) {
    return 'placeholder-equals-name'
  }
  return null
}

module.exports = { BANNED_PHRASES, BANNED_CRUNCHED, ALLOWED_TOKENS, classify }
