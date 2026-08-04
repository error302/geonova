/**
 * eslint-plugin-metardu — METARDU local ESLint rules.
 *
 * These are repo-specific guards that the stock eslint-plugin-jsx-a11y
 * doesn't cover. Registered in .eslintrc.json under the `metardu` plugin
 * id (plugin name `eslint-plugin-metardu`, installed as a file: dependency).
 */
'use strict'

module.exports = {
  rules: {
    'no-placeholder-as-aria-label': require('./rules/no-placeholder-as-aria-label'),
  },
}
