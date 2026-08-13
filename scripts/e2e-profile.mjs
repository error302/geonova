#!/usr/bin/env node
/**
 * e2e-profile.mjs — per-spec duration profile of the CI E2E shards.
 *
 * Fetches the latest COMPLETED ci.yml run's E2E shard logs via the `gh`
 * CLI, parses Playwright's `--reporter=list` output (the E2E job runs
 * `npx playwright test --reporter=list ...`), and prints:
 *   - per-shard wall time (job startedAt->completedAt, incl. setup — the
 *     number that decides the 20-min job timeout) and test time
 *   - per-spec duration/pass/fail table, sorted slowest first
 *   - retry accounting (this Playwright version assigns a new reporter
 *     index per attempt and the two projects share locations, so each
 *     test is keyed by project|spec:line:col and only the LAST attempt's
 *     outcome counts)
 *
 * With --compare, also profiles the previous COMPLETED ci.yml run and
 * appends a delta appendix — per-shard wall/test-time movement and the
 * per-spec duration changes (plus specs added/removed between runs) — so
 * drift shows up without cross-referencing the two tables manually.
 *
 * NOTE: the source is intentionally pure ASCII — the pass/fail marks and
 * the "›" separator are matched via \u escapes so the regex cannot be
 * corrupted by file-encoding round-trips.
 *
 * Usage:
 *   node scripts/e2e-profile.mjs                # latest completed ci.yml run
 *   node scripts/e2e-profile.mjs --compare      # + deltas vs previous run
 *   node scripts/e2e-profile.mjs --run <id>     # specific run
 *   node scripts/e2e-profile.mjs --in-progress  # allow a still-running run
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const runArgIdx = args.indexOf('--run')
const runArg = runArgIdx >= 0 && args[runArgIdx + 1] ? args[runArgIdx + 1] : null
const allowInProgress = args.includes('--in-progress')
const doCompare = args.includes('--compare')

function gh(argsArr, opts = {}) {
  try {
    return execFileSync('gh', argsArr, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
  } catch (err) {
    console.error(`[e2e-profile] gh ${argsArr.join(' ')} failed:\n  ${err.stderr ? String(err.stderr).trim().split('\n').slice(0, 4).join('\n  ') : err.message}`)
    process.exit(2)
  }
}

// ── 1. Resolve the run ─────────────────────────────────────────────────────
function resolveRun(target, allowInProgress) {
  let run
  if (target) {
    run = JSON.parse(gh(['run', 'view', target, '--json', 'databaseId,status,headSha,createdAt,conclusion,displayTitle']))
  } else {
    const runs = JSON.parse(gh(['run', 'list', '--workflow=ci.yml', '--limit', '10', '--json', 'databaseId,status,headSha,createdAt,conclusion']))
    const pick = allowInProgress ? runs[0] : runs.find((r) => r.status === 'completed')
    if (!pick) {
      console.error('[e2e-profile] no completed ci.yml run found in the last 10 (pass --run <id> or --in-progress).')
      process.exit(2)
    }
    run = pick
  }
  if (!allowInProgress && run.status !== 'completed') {
    console.error(`[e2e-profile] run ${run.databaseId} is still ${run.status} — pass --in-progress to profile it anyway.`)
    process.exit(2)
  }
  return run
}

/**
 * Previous COMPLETED ci.yml run strictly older than `run` (by databaseId,
 * which increments with run creation). Reuses the same GH list API the
 * resolver uses, widened to 25 so older --run targets can still find it.
 */
function resolvePreviousRun(run) {
  const currentId = Number(run.databaseId)
  const runs = JSON.parse(gh(['run', 'list', '--workflow=ci.yml', '--limit', '25', '--json', 'databaseId,status,headSha,createdAt,conclusion']))
  const prev = runs.find((r) => r.status === 'completed' && Number(r.databaseId) < currentId)
  return prev || null
}

// ── 2. Profile one run ─────────────────────────────────────────────────────
// Playwright list reporter lines (non-TTY appends one line per test end):
//   "  ✓   1 [chromium-desktop] › e2e/foo.spec.ts:3:1 › title (1.2s)"
//   "  ✘   2 [chromium-desktop] › e2e/foo.spec.ts:8:1 › title (retry #1) (5.3s)"   (attempt gets a NEW index)
//   "  -   3 [chromium-desktop] › e2e/skip.spec.ts:1:1 › skipped"  (no duration)
// GH log lines are "<job name>\t<step name>\t<timestamp> <message>".
const SPEC_LINE = new RegExp(
  `^[\u2713\u2718okx]\\s+\\d+\\s+\\[([^\\]]+)\\].*?(\\S+\\.spec\\.ts):(\\d+):(\\d+).*\\(([^)]+)\\)$`
)
const STRIP_ANSI = /\u001b\[[0-9;]*m/g

function parseDuration(str) {
  const s = String(str)
  const m = /(\d+)m\s+([\d.]+)s/.exec(s)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const sec = /^([\d.]+)s$/.exec(s)
  if (sec) return Number(sec[1])
  const ms = /^(\d+)ms$/.exec(s)
  if (ms) return Number(ms[1]) / 1000
  return null
}

function cleanLogLine(rawLine) {
  const parts = rawLine.split('\t')
  let line = parts.length >= 3 ? parts.slice(2).join('\t') : rawLine
  return line.replace(STRIP_ANSI, '').replace(/^\S+\s+/, '').trim()
}

function profileRun(run) {
  // ── 2a. Find the E2E shard jobs ──────────────────────────────────────
  const jobs = JSON.parse(gh(['run', 'view', String(run.databaseId), '--json', 'jobs', '--jq', '.jobs']))
  const shards = jobs
    .filter((j) => (j.name || '').startsWith('E2E Tests (shard'))
    .map((j) => {
      const m = /shard (\d+)\/(\d+)/.exec(j.name)
      return { num: Number(m?.[1] ?? 0), total: Number(m?.[2] ?? 0), name: j.name, id: j.databaseId, conclusion: j.conclusion, startedAt: j.startedAt, completedAt: j.completedAt }
    })
    .sort((a, b) => a.num - b.num)

  if (shards.length === 0) {
    console.error(`[e2e-profile] run ${run.databaseId} has no "E2E Tests (shard N/M)" jobs.`)
    process.exit(2)
  }

  // ── 2b. Parse each shard's list-reporter log ─────────────────────────
  // id (project|spec:line:col) -> { spec, tests: [{passed, dur, failedOnce}] }
  // Keyed by project + location, NOT the list-reporter index — this
  // Playwright version assigns a NEW index per attempt (a retried test
  // shows "✘ 21 …" then "✓ 22 … (retry #1)") and the two projects
  // (chromium-desktop / mobile-chrome) share locations. Loop-generated
  // tests share a location too, so the discriminator is the retry suffix:
  //   - a line WITHOUT "(retry #N)" starts a NEW test
  //   - a line WITH "(retry #N)" re-runs the most recent test at that id
  //     (updates its outcome in place — so a retried test counts ONCE)
  // Skipped lines ("- N …") have no duration and are excluded — those
  // tests never ran.
  const perShard = []
  for (const shard of shards) {
    const log = gh(['run', 'view', '--job', String(shard.id), '--log'])
    const tests = new Map()
    let parsed = 0
    const RETRY = /\(retry #\d+\)/
    for (const rawLine of log.split('\n')) {
      const line = cleanLogLine(rawLine)
      const spec = SPEC_LINE.exec(line)
      if (!spec) continue
      const passed = /^[\u2713ok]/.test(spec[0])
      const dur = parseDuration(spec[5])
      if (dur === null) continue // skipped/no-duration lines don't help timing
      const id = `${spec[1]}|${spec[2]}:${spec[3]}:${spec[4]}`
      let entry = tests.get(id)
      if (RETRY.test(line)) {
        // Re-attempt of the most recent test at this id — update it in place.
        if (!entry || entry.tests.length === 0) continue
        const t = entry.tests[entry.tests.length - 1]
        t.failedOnce = t.failedOnce || !t.passed
        t.passed = passed
        t.dur = dur
      } else {
        if (!entry) {
          entry = { spec: spec[2], tests: [] }
          tests.set(id, entry)
        }
        entry.tests.push({ passed, dur, failedOnce: false })
      }
      parsed++
    }

    if (parsed === 0) {
      console.error(`[e2e-profile] shard ${shard.num}/${shard.total}: parsed 0 list-reporter lines from the job log — format may have drifted. Raw "spec.ts" lines:`)
      const probe = log.split('\n').filter((l) => l.includes('.spec.ts')).slice(0, 8)
      for (const p of probe) console.error('  ' + cleanLogLine(p).slice(0, 200))
      process.exit(2)
    }

    // Aggregate per spec file.
    const perSpec = new Map()
    let failCount = 0
    for (const t of tests.values()) {
      const runList = t.tests
      const passN = runList.filter((x) => x.passed).length
      const failN = runList.length - passN
      const flakyN = runList.filter((x) => x.failedOnce && x.passed).length
      if (failN > 0) failCount += failN
      const agg = perSpec.get(t.spec) || { tests: 0, pass: 0, fail: 0, flaky: 0, seconds: 0 }
      agg.tests += runList.length
      agg.pass += passN
      agg.fail += failN
      agg.flaky += flakyN
      agg.seconds += runList[runList.length - 1].dur // final attempt's duration
      perSpec.set(t.spec, agg)
    }

    const wallMs = shard.startedAt && shard.completedAt ? Date.parse(shard.completedAt) - Date.parse(shard.startedAt) : null
    const testSeconds = [...perSpec.values()].reduce((s, a) => s + a.seconds, 0)
    perShard.push({
      num: shard.num,
      total: shard.total,
      conclusion: shard.conclusion,
      wallSec: wallMs === null ? null : wallMs / 1000,
      testSec: testSeconds,
      failCount,
      perSpec: [...perSpec.entries()].sort((a, b) => b[1].seconds - a[1].seconds),
    })
  }

  return {
    perShard,
    shardCount: shards.length,
    totalTests: perShard.reduce((s, p) => s + p.perSpec.reduce((a, x) => a + x[1].tests, 0), 0),
    totalFail: perShard.reduce((s, p) => s + p.failCount, 0),
    totalWall: perShard.reduce((s, p) => s + (p.wallSec ?? 0), 0),
    totalTest: perShard.reduce((s, p) => s + p.testSec, 0),
  }
}

// ── 3. Print ───────────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (sec === null || sec === undefined) return 'n/a'
  if (sec >= 60) return `${Math.floor(sec / 60)}m${String(Math.round(sec % 60)).padStart(2, '0')}s`
  return `${sec.toFixed(1)}s`
}

function fmtDelta(sec) {
  if (sec === null || sec === undefined) return '  n/a '
  const sign = sec >= 0 ? '+' : '-'
  return `${sign}${fmtTime(Math.abs(sec)).padStart(6)}`
}

function printProfile(run, profile) {
  const runConc = run.conclusion ? `, conclusion ${run.conclusion}` : ''
  const { perShard, totalTests, totalFail, totalWall, totalTest } = profile
  console.log(`run ${run.databaseId} (ci.yml, ${(run.createdAt || '').slice(0, 10)}, sha ${(run.headSha || '').slice(0, 7)}${runConc}) — ${perShard.length} shards, ${totalTests} tests (${totalTests - totalFail} passed${totalFail ? `, ${totalFail} failed` : ''}), test time ${fmtTime(totalTest)}, wall ${fmtTime(totalWall)}`)
  console.log()

  for (const p of perShard) {
    const wallStr = p.wallSec === null ? 'wall n/a' : `wall ${fmtTime(p.wallSec)}`
    const failStr = p.failCount ? `, ${p.failCount} FAILED` : ''
    console.log(`E2E Tests (shard ${p.num}/${p.total}) — ${wallStr} \u00b7 test ${fmtTime(p.testSec)} \u00b7 ${p.perSpec.reduce((s, x) => s + x[1].tests, 0)} tests${failStr} (${p.conclusion || 'running'})`)
    console.log('  ' + 'SPEC'.padEnd(52) + 'TESTS  PASS  FAIL FLAKY     TIME')
    for (const [spec, a] of p.perSpec) {
      const flaky = a.flaky ? String(a.flaky).padStart(5) : '    -'
      console.log(`  ${spec.padEnd(52)}${String(a.tests).padStart(5)}${String(a.pass).padStart(6)}${String(a.fail).padStart(6)}${flaky}  ${fmtTime(a.seconds).padStart(9)}`)
    }
    console.log()
  }

  // Balance bar: the ci.yml comment targets each shard <= ~8 min of wall time.
  const worst = perShard.reduce((a, b) => ((b.wallSec ?? 0) > (a.wallSec ?? 0) ? b : a), perShard[0])
  console.log(`worst shard: ${worst.num}/${worst.total} at ${fmtTime(worst.wallSec)} wall — ${(worst.wallSec ?? 0) > 480 ? 'EXCEEDS the 8-min balance bar (rebalance the matrix specs)' : 'within the 8-min balance bar'} (job timeout is 20 min)`)
}

// ── 4. Delta appendix (--compare) ──────────────────────────────────────────
// Specs whose duration moved by >= this much (or that appeared/disappeared)
// are flagged, so real drift surfaces without full-table cross-referencing.
const SPEC_DELTA_THRESHOLD = 0.5 // seconds

function printCompare(runCur, cur, runPrev, prev) {
  console.log()
  console.log(`=== DELTA vs previous completed run ${runPrev.databaseId} (sha ${(runPrev.headSha || '').slice(0, 7)}) ===`)
  console.log('Shard-level movement (current \u2014 previous):')
  console.log('  ' + 'SHARD'.padEnd(8) + 'WALL'.padEnd(22) + 'TEST'.padEnd(22) + 'TESTS')
  const prevByNum = new Map(prev.perShard.map((p) => [p.num, p]))
  for (const p of cur.perShard) {
    const old = prevByNum.get(p.num)
    if (!old) {
      console.log(`  ${`${p.num}/${p.total}`.padEnd(8)}${fmtTime(p.wallSec).padEnd(22)}${fmtTime(p.testSec).padEnd(22)}${p.perSpec.reduce((s, x) => s + x[1].tests, 0)}  (new shard)`)
      continue
    }
    const wallDelta = p.wallSec === null || old.wallSec === null ? '  n/a ' : fmtDelta(p.wallSec - old.wallSec)
    const testDelta = fmtDelta(p.testSec - old.testSec)
    const testsDelta = p.perSpec.reduce((s, x) => s + x[1].tests, 0) - old.perSpec.reduce((s, x) => s + x[1].tests, 0)
    console.log(`  ${`${p.num}/${p.total}`.padEnd(8)}${fmtTime(p.wallSec).padEnd(13)}${wallDelta.padEnd(8)}${fmtTime(p.testSec).padEnd(13)}${testDelta.padEnd(8)}${testsDelta >= 0 ? '+' : ''}${testsDelta}`)
  }

  console.log()
  console.log(`Per-spec duration drift (|delta| >= ${SPEC_DELTA_THRESHOLD}s, or added/removed):`)
  for (const p of cur.perShard) {
    const old = prevByNum.get(p.num)
    if (!old) {
      console.log(`  shard ${p.num}/${p.total}: new shard — ${p.perSpec.length} specs`)
      continue
    }
    const oldBySpec = new Map(old.perSpec)
    const rows = []
    for (const [spec, a] of p.perSpec) {
      const o = oldBySpec.get(spec)
      if (!o) rows.push({ spec, cur: a.seconds, delta: null, added: true })
      else if (Math.abs(a.seconds - o.seconds) >= SPEC_DELTA_THRESHOLD) rows.push({ spec, cur: a.seconds, delta: a.seconds - o.seconds, added: false })
    }
    for (const [spec, o] of oldBySpec) {
      if (!p.perSpec.some(([s]) => s === spec)) rows.push({ spec, cur: null, delta: null, removed: true })
    }
    if (rows.length === 0) {
      console.log(`  shard ${p.num}/${p.total}: no spec drifted >= ${SPEC_DELTA_THRESHOLD}s`)
      continue
    }
    rows.sort((a, b) => {
      const da = a.delta === null ? -1 : Math.abs(a.delta)
      const db = b.delta === null ? -1 : Math.abs(b.delta)
      return db - da
    })
    console.log(`  shard ${p.num}/${p.total}:`)
    for (const r of rows) {
      const tag = r.added ? 'ADDED   ' : r.removed ? 'REMOVED ' : fmtDelta(r.delta)
      console.log(`    ${tag} ${(r.cur === null ? 'n/a' : fmtTime(r.cur)).padStart(8)}  ${r.spec}`)
    }
  }
}

// ── 5. Run ─────────────────────────────────────────────────────────────────
const run = resolveRun(runArg, allowInProgress)
const profile = profileRun(run)
printProfile(run, profile)

if (doCompare) {
  const prevRun = resolvePreviousRun(run)
  if (!prevRun) {
    console.error(`\n[e2e-profile] no earlier completed ci.yml run found for --compare (limit 25) — nothing to diff against.`)
    process.exit(2)
  }
  const prevProfile = profileRun(prevRun)
  printCompare(run, profile, prevRun, prevProfile)
}
