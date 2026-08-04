// Print full context for each remaining aria-label-gate violation
const fs = require('fs');
const path = require('path');

const gatePath = path.join(__dirname, 'aria-label-gate.mjs');
const src = fs.readFileSync(gatePath, 'utf8');

// Extract the JSON output by spawning the gate with --json
const { execSync } = require('child_process');
let raw;
try {
  raw = execSync(`node "${gatePath}" --json`, { maxBuffer: 64 * 1024 * 1024 }).toString();
} catch (e) {
  raw = e.stdout ? e.stdout.toString() : '';
}
let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('Failed to parse gate JSON output:', e.message);
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
for (const v of data.violations) {
  const file = v.file.replace(/\\/g, path.sep);
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const start = Math.max(0, v.line - 6);
  const end = Math.min(lines.length, v.line + 4);
  console.log(`\n===== ${file}:${v.line}:${v.column} [${v.kind}] value=${JSON.stringify(v.value)} =====`);
  for (let i = start; i < end; i++) {
    const marker = i + 1 === v.line ? '>>' : '  ';
    console.log(`${marker} ${i + 1}: ${lines[i]}`);
  }
}
