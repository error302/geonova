#!/usr/bin/env node
// Static import audit for METARDU src/
// Checks: (1) broken relative/alias paths (2) named imports not exported

import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = '/home/z/my-project/repos/metardu';
const SRC = join(ROOT, 'src');

const allFiles = execSync(`find ${SRC} -type f \\( -name "*.ts" -o -name "*.tsx" \\)`, { encoding: 'utf8' })
  .split('\n').filter(Boolean);
console.error(`Found ${allFiles.length} TS files`);

const importRe = /import\s+(?:type\s+)?(?:([^'"{}\s,]+)\s*,?\s*)?(?:\{([^}]*?)\})?\s*(?:,?\s*(\*\s+as\s+\w+))?\s*from\s*['"]([^'"]+)['"]/g;

const broken = [];
const missingExports = [];

function resolveModule(spec, fromFile) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  let baseDir;
  if (spec.startsWith('@/')) {
    baseDir = join(SRC, spec.slice(2));
  } else {
    baseDir = resolve(dirname(fromFile), spec);
  }
  const candidates = [
    baseDir,
    baseDir + '.ts',
    baseDir + '.tsx',
    baseDir + '.js',
    baseDir + '.jsx',
    baseDir + '.d.ts',
    join(baseDir, 'index.ts'),
    join(baseDir, 'index.tsx'),
    join(baseDir, 'index.js'),
    join(baseDir, 'index.jsx'),
  ];
  for (const c of candidates) {
    try { if (existsSync(c) && statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

function getExports(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  let m;
  const re1 = /export\s+(?:type\s+)?\{([^}]*?)\}/g;
  while ((m = re1.exec(src)) !== null) {
    const items = m[1].split(',').map(s => s.trim()).filter(Boolean);
    for (const item of items) {
      const cleaned = item.replace(/^type\s+/, '');
      const parts = cleaned.split(/\s+as\s+/);
      const exportedName = parts.length > 1 ? parts[1].trim() : parts[0].trim();
      if (exportedName && exportedName !== 'default') names.add(exportedName);
      if (parts[0]?.trim()) names.add(parts[0].trim());
    }
  }
  const re2 = /export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
  while ((m = re2.exec(src)) !== null) {
    names.add(m[1]);
  }
  if (/export\s+default\s+/.test(src)) names.add('default');
  if (/export\s+\*\s+from\s+['"]/.test(src)) names.add('__star__');
  return names;
}

let checked = 0, brokenCount = 0;
for (const file of allFiles) {
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  importRe.lastIndex = 0;
  let m;
  while ((m = importRe.exec(src)) !== null) {
    const idx = m.index;
    let lineNo = 1;
    for (let i = 0; i < idx; i++) if (src[i] === '\n') lineNo++;
    const defaultImport = m[1];
    const namedBlock = m[2];
    const namespaceImport = m[3];
    const spec = m[4];
    checked++;
    if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
    const target = resolveModule(spec, file);
    if (!target) {
      broken.push({ file, line: lineNo, spec, reason: 'module not found' });
      brokenCount++;
      continue;
    }
    if (namedBlock && !target.endsWith('.d.ts')) {
      const exports = getExports(target);
      const hasStar = exports.has('__star__');
      const items = namedBlock.split(',').map(s => s.trim()).filter(Boolean);
      for (const item of items) {
        const cleaned = item.replace(/^type\s+/, '');
        const parts = cleaned.split(/\s+as\s+/);
        const localName = parts[0].trim();
        if (!localName) continue;
        if (hasStar) continue;
        if (!exports.has(localName) && localName !== 'default') {
          missingExports.push({ file, line: lineNo, target, symbol: localName });
        }
      }
    }
    if (defaultImport && defaultImport !== 'type' && !target.endsWith('.d.ts')) {
      const exports = getExports(target);
      if (!exports.has('default') && !exports.has('__star__')) {
        missingExports.push({ file, line: lineNo, target, symbol: 'default' });
      }
    }
  }
}

console.error(`Checked ${checked} imports, ${brokenCount} broken modules, ${missingExports.length} missing exports\n`);

console.log('=== BROKEN IMPORTS (module not found) ===');
for (const b of broken) {
  console.log(`${b.file}:${b.line}  import '${b.spec}' — ${b.reason}`);
}

console.log('\n=== MISSING EXPORTS (named/default not exported by target) ===');
for (const x of missingExports) {
  const rel = x.target.replace(ROOT + '/', '');
  console.log(`${x.file}:${x.line}  imports '${x.symbol}' from ${rel} — not exported`);
}
