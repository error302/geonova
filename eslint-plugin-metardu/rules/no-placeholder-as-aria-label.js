/**
 * @fileoverview Bans placeholder-like / junk `aria-label` values so accessible
 * names can't regress in tables and forms.
 *
 * This is the AST version of scripts/aria-label-gate.mjs (the CI regex gate).
 * Both share ONE classification implementation via
 * ../shared/junk-classification.cjs, so violations fire in the editor +
 * `next lint` + the changed-files lint ratchet, AND the whole-repo CI gate —
 * and the two can never drift apart.
 *
 * Junk classes flagged (same taxonomy as the shared module):
 *
 *   1. empty                  — aria-label="" (no accessible name at all)
 *   2. punctuation            — value has no letters or digits ('—', '…', '-')
 *   3. generic                — blocklisted placeholder phrases
 *                               ('field note', 'cell value', 'input', …)
 *   4. crunched               — a single token with a lowercase→uppercase
 *                               camelCase boundary ('surveyorName',
 *                               'pointId') or a known run-on word
 *   5. placeholder-equals-name — aria-label value duplicates the element's own
 *                               placeholder attribute (e.g. aria-label="0.000"
 *                               placeholder="0.000"). The label must be a real
 *                               description, never the sample value.
 *
 * Only statically-known string values are checked (string literals and
 * expression-container literals/template literals with no interpolation), so
 * dynamic labels like aria-label={t('name')} are never false-flagged.
 */
'use strict'

const { classify } = require('../shared/junk-classification.cjs')

/**
 * Extract the static string value of a JSX attribute, or null when the value
 * isn't statically known (dynamic expression, JSXSpreadAttribute, etc.).
 */
function staticStringValue(attr) {
  if (!attr || attr.type !== 'JSXAttribute' || !attr.value) return null
  const v = attr.value
  if (v.type === 'Literal' && typeof v.value === 'string') return v.value
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression
    if (e.type === 'Literal' && typeof e.value === 'string') return e.value
    if (e.type === 'TemplateLiteral' && e.expressions.length === 0 && e.quasis.length === 1) {
      return e.quasis[0].value.cooked ?? e.quasis[0].value.raw
    }
  }
  return null
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow placeholder-like or junk aria-label values (empty, punctuation, generic phrases, crunched header text, or duplicating its own placeholder)',
      category: 'Accessibility',
      recommended: false,
    },
    messages: {
      junk: 'aria-label must be a real accessible name, not "{{value}}" ({{kind}}). Derive it from the visible label or column header — never the placeholder/sample value.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        const attrs = node.attributes.filter((a) => a.type === 'JSXAttribute')
        const aria = attrs.find((a) => a.name && a.name.name === 'aria-label')
        if (!aria) return
        const label = staticStringValue(aria)
        if (label === null) return
        const placeholderAttr = attrs.find((a) => a.name && a.name.name === 'placeholder')
        const placeholder = placeholderAttr ? staticStringValue(placeholderAttr) : null
        const kind = classify(label, placeholder)
        if (!kind) return
        context.report({
          node: aria,
          messageId: 'junk',
          data: { value: label, kind },
        })
      },
    }
  },
}
