# METARDU — Session Handoff & Roadmap (2026-08-22)

## What shipped this session (all on main, CI-green, auto-deployed)

### Critical fixes
1. **React #301 crash on /project/[id]** — root cause: Next-15 code (`params: Promise<{id}>` + `use(params)`) in contours/settings pages running on Next 14. Fixed by plain destructuring (`0b1fae2d`).
2. **Missing DB columns** — `/project/[id]` selected `workflow_step`/`workflow_max_unlocked` which NO migration created → every "Open" click silently bounced to dashboard for weeks. Migration 050 fixed it.
3. **Navbar missing on dashboard/survey/project** — AppShell had `{!dashboard && <NavBar />}` from when those routes used the deleted sidebar layout. Now unconditional (`769ec597`, `73dd3aee`).
4. **1,025 dead Tailwind utilities** — `bg-[var(--x)]/10` compiles to NOTHING in Tailwind 3.x (opacity modifier needs resolvable color type). Codemodded all to `color-mix(in_srgb,var(--x)_N%,transparent)`; text colors kept full-opacity for axe contrast (`960d943e`, `02ba980f`). Gate added: `scripts/tailwind-var-opacity-gate.mjs`.
5. **Login card invisible** — same Tailwind bug made the glass card fully transparent over the light topo map. Hard-coded rgba fix.
6. **Map tools buried** — stakeout-radar button under Vertex Editing panel (same corner/z); field-mode tooltip's fullscreen invisible backdrop swallowed the first click anywhere on /map. Both fixed.
7. **Map scroll fluidity** — vector layers now `updateWhileAnimating: true` + `renderBuffer: 4`; coord-readout throttle 100→200ms (`6ebb60eb`).
8. **Cloudflare Workers build config deleted** — was misconfigured (no wrangler setup), permanently red, blocking nothing real.
9. **CI E2E breadcrumb test** — scoped assertion to `<main>` (navbar restoration changed DOM order).

### New tooling
- **Schema-drift gate** (`scripts/schema-drift-gate.mjs`) — fails CI when code selects columns migrations don't define. Baseline ratchet at 12 entries; `--update-baseline` prunes stale entries (fixed prune-on-success bug).
- **Migration 052** — reconciled ~26 columns + 5 tables (IF NOT EXISTS throughout). Baseline shrank 44→12.
- **Kenya precision audit suite** (`src/lib/reports/__tests__/kenyaPrecisionAudit.test.ts`, 8/8 passing) — RDM 1.1 Table 2.4 closure classes (√K scaling proof), Reg 89 plotting scales coverage.
- **Screenshot harness** (`scripts/capture-screens.mjs`) — Playwright captures the 4 showcase surfaces at 2× for landing imagery; doubles as render smoke-test.
- **MapRail component** (`src/app/map/components/MapRail.tsx`) — left icon dock, radio tool-switching, context sidebar. Vertex Editing already integrated through it.

## IMMEDIATE NEXT TASK: Field Book redesign (user-requested)
User finds /fieldbook confusing for field data collection. Plan:
1. Audit current flow: `/fieldbook` → TraverseBook/LevelBook components (`src/components/fieldbook/`)
2. Redesign principles:
   - **One-thumb operation**: big touch targets (min 44px), numeric keypad-friendly inputs
   - **Sequential wizard** not dense form: Station → backsight → foresight → [save] per screen step
   - **Large live readouts**: current station, HI, HD prominently (surveyor glances, not reads)
   - **Offline-first confirmation**: every save shows local-stored badge + sync state
   - **Quick-repeat**: "Next shot" pre-fills last station chain (A→B→C…)
   - Match dark theme tokens (--bg-secondary cards, --accent CTAs)
3. Verify against live site with test account `qa.surveyor.agent@gmail.com` / `Qa-Survey-2026!x`

## Known open items
| Item | Status |
|---|---|
| MapRail integration for remaining tools (layers/measure/stakeout-as-panel) | Component ready; wire more items |
| Final 12 schema-drift baseline entries | Need live `information_schema` pull to type correctly |
| Landing screenshots from real app | Harness ready; run vs seeded fixtures, swap into page.tsx |
| Emoji sweep (~20 remaining: chat strings, print templates, map dock comments) | Low priority |
| Auth pages theme mismatch (login=light map hero, register=dark) | Design decision needed |
| Traverse engine consolidation (4+ parallel engines in lib/engine, lib/survey, lib/computations) | Architecture cleanup |

## Environment notes for next session
- Test account exists on prod: qa.surveyor.agent@gmail.com / Qa-Survey-2026!x (project "QA Riverside Plot 2026", id `84f4f841-df4c-499f-a2dd-982972352458`)
- Local node_modules is stale (installed on wrong branch); run `npm ci --legacy-peer-deps --ignore-scripts` after checkout
- Local dev server: `npx next dev -p 3200` works WITHOUT DB (auth redirects); use `src/app/navtest`-style stub pages for UI debugging
- agent-browser CLI is authenticated and has prod cookies sometimes stale — re-login as needed
- graphify-out/graph.json (21MB knowledge graph) queryable via node one-liners; CLI not installed
- Production: https://metardu.space (Oracle VM via Docker, deploy.yml auto-ships main)
- Local working tree has UNCOMMITTED user changes: src/app/page.tsx landing redesign + public/landing/*.jpg images (Gemini-generated, verified good) — coordinate before touching landing
