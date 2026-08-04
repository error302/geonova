import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const ESLINT_JSON = '.eslint-now.json'

function getArgWarnings() {
  const data = JSON.parse(readFileSync(ESLINT_JSON, 'utf8'))
  const out = []
  for (const f of data) {
    for (const m of f.messages) {
      if (m.severity !== 1 || m.ruleId !== '@typescript-eslint/no-unused-vars') continue
      if (!/Allowed unused args must match/.test(m.message)) continue
      const nameMatch = m.message.match(/^'([^']+)'/)
      out.push({ file: f.filePath, line: m.line, column: m.column, name: nameMatch ? nameMatch[1] : null })
    }
  }
  return out
}

function applyRename(file, line, column, name) {
  const src = readFileSync(file, 'utf8')
  const lines = src.split('\n')
  const l = lines[line - 1]
  if (!l) return false
  // ESLint columns are 1-based; JS index is 0-based.
  const idx = column - 1
  // Verify the token at idx starts the identifier.
  const m = l.slice(idx).match(/^[A-Za-z_$][A-Za-z0-9_$]*/)
  if (!m || m[0] !== name) {
    console.error(`  SKIP (token mismatch) ${file}:${line}:${column} expected '${name}' got '${m?.[0]}'`)
    return false
  }
  // Look backward to the previous non-whitespace char.
  let prev = ' '
  for (let i = idx - 1; i >= 0; i--) {
    if (l[i] !== ' ' && l[i] !== '\t') { prev = l[i]; break }
  }
  let newLine
  if (prev === '{' || prev === '[') {
    // Destructuring shorthand { name } → { name: _name }
    newLine = l.slice(0, idx) + `${name}: _${name}` + l.slice(idx + name.length)
  } else {
    newLine = l.slice(0, idx) + `_${name}` + l.slice(idx + name.length)
  }
  lines[line - 1] = newLine
  writeFileSync(file, lines.join('\n'))
  return true
}

// Iterate: after renaming, re-lint ONLY touched files until stable.
const touched = new Set()
let iterations = 0
while (iterations < 6) {
  const warnings = getArgWarnings().filter((w) => !touched.has(w.file) || true)
  const candidates = warnings.filter((w) => !touched.has(w.file))
  if (!candidates.length) break
  let changed = 0
  const filesThisPass = new Set()
  for (const w of candidates) {
    if (applyRename(w.file, w.line, w.column, w.name)) {
      changed++
      touched.add(w.file)
      filesThisPass.add(w.file)
    }
  }
  console.log(`pass ${iterations}: ${candidates.length} candidate(s), ${changed} renamed`)
  if (!changed) break
  // Re-lint only files we changed this pass to get fresh warnings in them.
  if (filesThisPass.size) {
    const fileArgs = [...filesThisPass]
    execFileSync('npx', ['eslint', ...fileArgs, '--ext', '.ts,.tsx', '--format', 'json'], {
      stdio: ['ignore', 'pipe', 'inherit'],
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    }).toString()
  }
  iterations++
}
console.log('done. total files touched:', touched.size)
