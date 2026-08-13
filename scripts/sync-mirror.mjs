#!/usr/bin/env node
/**
 * scripts/sync-mirror.mjs
 *
 * Sync the .freebuff mirror working tree to the primary working tree so the
 * mirror never carries an old (untyped / syntax-broken / stale) copy of any
 * tracked file — while leaving the ACTIVE WIP set (files with uncommitted
 * changes in the primary) untouched in both trees.
 *
 * The mirror at .freebuff/worktrees/<uuid>/ is a plain directory copy (not a
 * registered git worktree — `git -C` from inside it resolves to the primary
 * repo), so the sync is a byte-level copy of tracked files from the primary.
 * Content is compared EOL-insensitively (CRLF vs LF stripped) so a
 * line-ending-only difference does not force a copy; when a copy happens the
 * primary's exact bytes are written to the mirror.
 *
 * Classification:
 *   - WIP set   = paths in `git status --porcelain -z` of the primary
 *                 (modified/deleted/renamed + untracked). These are skipped
 *                 unless --include-untracked is given.
 *   - in sync   = primary and mirror content identical (EOL-insensitive).
 *   - stale     = tracked path differs (or is missing in the mirror) and is
 *                 not WIP → copied primary → mirror.
 *   - stale del = file present in the mirror under a tracked top-level dir but
 *                 no longer in the primary's tracked set → removed from mirror.
 *
 * Usage (from the repo root):
 *   node scripts/sync-mirror.mjs                 # sync
 *   node scripts/sync-mirror.mjs --dry-run       # preview only, no writes
 *   node scripts/sync-mirror.mjs --include-untracked
 *   node scripts/sync-mirror.mjs --mirror <path>
 *   node scripts/sync-mirror.mjs --verbose
 *
 * Exit 0 on success (WIP skips are expected, not errors).
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// ── args ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const FLAGS = {
  dryRun: argv.includes('--dry-run'),
  verbose: argv.includes('--verbose'),
  includeUntracked: argv.includes('--include-untracked'),
}
const opt = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : null
}
const ROOT = opt('--root') || process.cwd()
const MIRROR =
  opt('--mirror') || discoverMirror(ROOT)

// ── helpers ─────────────────────────────────────────────────────────────
function run(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts })
}

function discoverMirror(root) {
  const wtDir = path.join(root, '.freebuff', 'worktrees')
  let entries = []
  try {
    entries = fs.readdirSync(wtDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(wtDir, e.name))
      .filter((d) => fs.existsSync(path.join(d, 'package.json')))
  } catch {
    return null
  }
  if (entries.length === 1) return entries[0]
  if (entries.length > 1) {
    console.error(
      `[sync-mirror] multiple candidate mirrors under ${wtDir}: ` +
      `${entries.map((d) => path.basename(d)).join(', ')}\n` +
      'pass --mirror <path> to pick one')
    process.exit(2)
  }
  return null
}

function gitStatusPaths() {
  // porcelain -z: "XY <path>\0" (renames: "XY <old>\0<new>\0")
  const out = run(['status', '--porcelain', '-z'])
  const set = new Set()
  const parts = out.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i]
    if (!rec) continue
    const code = rec.slice(0, 2)
    set.add(rec.slice(3))
    if ((code[0] === 'R' || code[0] === 'C') && parts[i + 1]) {
      set.add(parts[i + 1])
      i++
    }
  }
  return set
}

function sameContent(a, b) {
  // EOL-insensitive comparison: strip \r from both.
  const na = a.filter((byte) => byte !== 0x0d)
  const nb = b.filter((byte) => byte !== 0x0d)
  if (na.length !== nb.length) return false
  for (let i = 0; i < na.length; i++) if (na[i] !== nb[i]) return false
  return true
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// ── classify + sync ─────────────────────────────────────────────────────
if (!MIRROR) {
  console.error(
    '[sync-mirror] no mirror found under .freebuff/worktrees/ — pass --mirror <path>')
  process.exit(2)
}
if (!fs.existsSync(path.join(MIRROR, 'package.json'))) {
  console.error(`[sync-mirror] mirror missing package.json: ${MIRROR}`)
  process.exit(2)
}

const wip = gitStatusPaths()
const tracked = run(['ls-files', '-z'])
  .split('\0')
  .filter(Boolean)
const trackedSet = new Set(tracked)
const topDirs = new Set(tracked.map((p) => p.split('/')[0]))

let copied = 0
let deleted = 0
let skipped = 0
let inSync = 0
let missing = 0

const action = (msg) => {
  if (FLAGS.verbose) console.log('  ' + msg)
}

for (const rel of tracked) {
  const src = path.join(ROOT, rel)
  const dst = path.join(MIRROR, rel)
  let srcBuf
  try {
    srcBuf = fs.readFileSync(src)
  } catch {
    continue // tracked file absent in primary working tree — leave it
  }
  let dstBuf = null
  try {
    dstBuf = fs.readFileSync(dst)
  } catch {
    /* missing in mirror */
  }
  if (wip.has(rel)) {
    skipped++
    continue
  }
  if (dstBuf && sameContent(srcBuf, dstBuf)) {
    inSync++
    continue
  }
  if (dstBuf === null) missing++
  if (FLAGS.dryRun) {
    action(`would copy ${rel}`)
    copied++
    continue
  }
  mkdirp(path.dirname(dst))
  fs.writeFileSync(dst, srcBuf)
  copied++
}

// Deletions: mirror files under tracked top-level dirs that are no longer
// tracked and not WIP → remove (stale committed deletions).
if (!FLAGS.dryRun) {
  const walk = (dir) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.next' ||
            e.name === '.git' || e.name === '.freebuff' ||
            e.name === '.turbo' || e.name === 'coverage') continue
        walk(path.join(dir, e.name))
        continue
      }
      const rel = path.relative(MIRROR, path.join(dir, e.name)).replace(/\\/g, '/')
      if (trackedSet.has(rel) || wip.has(rel)) continue
      fs.unlinkSync(path.join(dir, e.name))
      deleted++
      action(`deleted stale ${rel}`)
    }
  }
  for (const top of topDirs) walk(path.join(MIRROR, top))
}

// ── report ──────────────────────────────────────────────────────────────
console.log(
  `[sync-mirror] primary=${ROOT}\n` +
  `[sync-mirror] mirror=${MIRROR}\n` +
  `[sync-mirror] ${FLAGS.dryRun ? 'DRY-RUN (no writes)' : 'synced'} — ` +
  `${copied} copied, ${deleted} deleted, ${skipped} skipped (WIP), ` +
  `${inSync} in sync, ${missing} missing-in-mirror, ` +
  `${wip.size} WIP files excluded`)
if (FLAGS.dryRun) {
  console.log('[sync-mirror] re-run without --dry-run to apply')
}
process.exit(0)
