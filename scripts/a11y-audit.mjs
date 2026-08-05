#!/usr/bin/env node
/**
 * a11y-audit.mjs — thin wrapper over the combined lint-ratchets.mjs.
 *
 * The unified single-pass ratchet lives in scripts/lint-ratchets.mjs (it runs
 * ONE eslint pass and checks BOTH the warning and jsx-a11y baselines). This
 * file is kept as a compat shim for docs/CI references that call it directly;
 * it forwards the a11y-relevant flags and delegates.
 *
 * Usage (same flags as before):
 *   node scripts/a11y-audit.mjs              # verify a11y ratchet
 *   node scripts/a11y-audit.mjs --write-audit  # verify + regenerate .a11y-audit.json
 *   node scripts/a11y-audit.mjs --update     # snapshot a11y counts as baseline
 *   node scripts/a11y-audit.mjs --baseline path.json   # custom baseline file
 *   node scripts/a11y-audit.mjs --scope a,b  # lint only these paths
 *   node scripts/a11y-audit.mjs --report     # print per-rule table
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const combined = path.join(here, 'lint-ratchets.mjs')
const args = process.argv.slice(2)

// Map the legacy --baseline flag onto the combined script's --baseline-a11y.
const mapped = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--baseline') {
    mapped.push('--baseline-a11y', args[i + 1])
    i++
  } else {
    mapped.push(args[i])
  }
}

const res = spawnSync(process.execPath, [combined, ...mapped], { stdio: 'inherit' })
process.exit(res.status ?? 1)
