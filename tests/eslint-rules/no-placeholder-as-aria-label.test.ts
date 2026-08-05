/**
 * RuleTester coverage for eslint-plugin-metardu/rules/no-placeholder-as-aria-label.
 *
 * Run: npx jest tests/eslint-rules --coverage=false
 */
import * as path from 'node:path'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RuleTester } = require('eslint')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const rule = require(path.join(__dirname, '..', '..', 'eslint-plugin-metardu', 'rules', 'no-placeholder-as-aria-label'))

const tester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
})

const ruleId = 'metardu/no-placeholder-as-aria-label'

tester.run(ruleId, rule, {
  valid: [
    // Real descriptive label + placeholder are fine.
    { code: '<input aria-label="Easting (m)" placeholder="0.000" />' },
    { code: '<input aria-label="Point name" placeholder="Enter point name" />' },
    // No aria-label at all — other rules / the gate handle those.
    { code: '<input placeholder="0.000" />' },
    { code: '<input placeholder="Search..." />' },
    // Dynamic values (i18n, state) — must never be false-flagged.
    { code: '<input aria-label={t("name")} placeholder="Enter name" />' },
    { code: '<input aria-label={label} placeholder={placeholder} />' },
    { code: '<input aria-label={`Measure point ${id}`} placeholder="1" />' },
    // Non-empty placeholders that differ from the label.
    { code: '<input aria-label="Height of instrument" placeholder="1.450" />' },
    // Units / multi-token labels with camelCase inside a phrase are fine.
    { code: '<input aria-label="Design Pressure (kPa)" placeholder="0.0" />' },
    // Allowed single tokens.
    { code: '<input aria-label="SurveyorName" placeholder="J. Doe" />' },
    // Spread attrs / non-JSX.
    { code: '<input {...props} />' },
    { code: 'const x = 1;' },
  ],
  invalid: [
    // 1. empty
    { code: '<input aria-label="" placeholder="0.000" />', errors: [{ messageId: 'junk' }] },
    // 2. punctuation
    { code: '<input aria-label="—" placeholder="0.000" />', errors: [{ messageId: 'junk' }] },
    // 3. generic placeholder phrase
    { code: '<input aria-label="value" placeholder="0.000" />', errors: [{ messageId: 'junk' }] },
    { code: '<input aria-label="field note" placeholder="note" />', errors: [{ messageId: 'junk' }] },
    // 4. crunched header text
    { code: '<input aria-label="pointId" placeholder="1" />', errors: [{ messageId: 'junk' }] },
    { code: '<input aria-label="surveyorname" placeholder="J. Doe" />', errors: [{ messageId: 'junk' }] },
    // 5. placeholder-equals-name (the headline class) — string literal,
    //    single-quoted literal, and expression-container literal forms.
    { code: '<input aria-label="0.000" placeholder="0.000" />', errors: [{ messageId: 'junk' }] },
    { code: "<input aria-label='Search' placeholder='Search' />", errors: [{ messageId: 'junk' }] },
    { code: '<input aria-label={"Height"} placeholder={"Height"} />', errors: [{ messageId: 'junk' }] },
    { code: '<input aria-label={`0.000`} placeholder={`0.000`} />', errors: [{ messageId: 'junk' }] },
  ],
})
