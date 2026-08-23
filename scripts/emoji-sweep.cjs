#!/usr/bin/env node
/**
 * Emoji sweep (tech-debt item from SESSION-HANDOFF): removes color emoji
 * from user-facing strings and print templates. Check/cross/warning glyphs
 * (✓ ✗ ⚠) are deliberately kept — they are monochrome, print-safe.
 */
const fs = require('fs');

const edits = [
  // Chat / AI assistant
  ['src/components/ai/SurveyAssistant.tsx', [
    ['👋 Welcome to METARDU', 'Welcome to METARDU'],
    ['⚠️ Error:', 'Error:'],
  ]],
  // CAD editor panel heading
  ['src/components/cad-editor/CADEditor.tsx', [
    ['💻 AutoCAD Command Line', 'AutoCAD Command Line'],
  ]],
  // Compute panel tip
  ['src/components/compute/NetworkAdjustmentPanel.tsx', [
    ['💡 Blunders are down-weighted', 'Tip: Blunders are down-weighted'],
  ]],
  // Field hardware UI
  ['src/components/field/FieldConnectionBar.tsx', [
    ['🛰 ', 'SAT '],
  ]],
  ['src/components/field/FieldObservationList.tsx', [
    ['🛰 {', 'SAT {'],
    ['📝 {', ''],
  ]],
  ['src/components/field/FieldDataCollector.tsx', [
    ["☀️ Sunlight Mode ON", "Sunlight Mode ON"],
    ["🌤️ Outdoor Mode", "Outdoor Mode"],
    ["💡 Stakeout uses", "Tip: Stakeout uses"],
    ["💡 Measurements are saved", "Tip: Measurements are saved"],
  ]],
  // Submission category icons — rendered as text badges; keep them typographic
  ['src/lib/submission/pre-submit-check.ts', [
    ["icon: '📋'", "icon: 'CHK'"],
    ["icon: '📐'", "icon: 'GEO'"],
    ["icon: '🎯'", "icon: 'ACC'"],
    ["icon: '📄'", "icon: 'DOC'"],
    ["icon: '⚖️'", "icon: 'LGL'"],
  ]],
  // Comments only
  ['src/lib/engine/networkAdjustment.ts', [
    ['✅ CANONICAL', 'CANONICAL'],
  ]],
  ['src/app/map/components/MapToolDock.tsx', [
    ['🔭', '[scope]'],
    ['✛', '[+]'],
  ]],
];

let total = 0;
for (const [file, pairs] of edits) {
  let src = fs.readFileSync(file, 'utf8');
  for (const [from, to] of pairs) {
    if (!src.includes(from)) {
      console.log(`MISS  ${file}: "${from.slice(0, 40)}"`);
      continue;
    }
    src = src.split(from).join(to);
    total++;
  }
  fs.writeFileSync(file, src);
}
console.log(`Replacements applied: ${total}`);
