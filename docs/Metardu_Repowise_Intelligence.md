---
title: Metardu Repowise Intelligence & Codebase Health Architecture
created: 2026-08-12
tags: [architecture, health-audit, repowise, devtools, metardu, geospatial, nextjs, lint-ratchets]
status: active
---

# Metardu — Repowise Codebase Intelligence & Code Health Architecture

> **Overview:** Application of [Repowise](https://github.com/repowise-dev/repowise) codebase intelligence principles to the **Metardu** surveying, engineering & geospatial platform. Tracks 5-layer repository intelligence, 10 MCP task tools, zero-suppression health ratchets, command distillation, change-risk scoring, and architectural decisions.
> **Related Notes:** [[Metardu]], [[Metardu Architecture]], [[Metardu Deployment]], [[Metardu Industrial]]

---

## 1. Executive Summary & Repowise Core Principles

Metardu leverages **Repowise** codebase intelligence principles to maintain low-token exploration costs, evidence-based architectural decisions, and zero-defect code health ratchets across 1,863+ source files.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REPOWISE INTELLIGENCE ENGINE                        │
├───────────────┬───────────────┬───────────────┬───────────────┬─────────────┤
│   ◈ GRAPH     │     ◈ GIT     │    ◈ DOCS     │  ◈ DECISIONS  │ ◈ CODEHEALTH│
│ Dependency &  │  Hotspots,    │  Module & File│ Mined Spans & │  49 Detectors│
│  Call Tree    │  Co-changes   │  Fresh Wiki   │  Agent Memory │ Refactor Plan│
└───────┬───────┴───────┬───────┴───────┬───────┴───────┬───────┴──────┬──────┘
        │               │               │               │              │
        ▼               ▼               ▼               ▼              ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │                   10 TASK-SHAPED MCP TOOLS & CLI GATEWAY                  │
 └───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 5 Intelligence Layers in Metardu

| Layer | Metardu Mapping | Value & Capabilities |
|---|---|---|
| **◈ Graph** | Call graphs between Next.js App Router (`src/app`), survey computation engines (`src/lib/survey`, `src/lib/engine`), and web workers (`src/workers`). | 3-tier symbol resolution, route->handler edges, preventing broken callers when updating core modules (e.g. `least-squares.ts`). |
| **◈ Git** | Historical defect analysis across `git log` and PR co-change patterns. | Identifies high-risk "bug-magnet" modules (e.g. `correction-pipeline.ts`, `RIMOverlay.tsx`, `statutoryWorkbook.ts`). |
| **◈ Docs** | Automated, incremental module documentation and dependency mapping. | Keeps domain documentation fresh for 80+ route pages and 78+ lib modules without rotting. |
| **◈ Decisions** | Architectural decision tracking extracted from commit logs, PRs, and AI agent sessions. | Captures rationale (e.g. *Why Supabase-style roles must exist in PostGIS test migrations*, *Why row-typing uses unknown-cast pattern*). |
| **◈ Code Health** | 49 deterministic detectors (McCabe complexity, cohesion, god classes, cross-file N+1, unhandled promises). | **Zero-suppression ratchets**: Enforces genuine type fixes over lazy `eslint-disable` comments. |

---

## 3. Codebase Quality & Health Gates (Current Status)

| Health Gate | Command / Tool | Live Metric | Status |
|---|---|---|---|
| **TypeScript Compilation** | `npx tsc --noEmit` | **0 errors** | ✅ Passed |
| **Unsafe Member Access** | `@typescript-eslint/no-unsafe-member-access` | **0 warnings** (Floor ratcheted) | ✅ Floor 0 |
| **Unsafe Assignment** | `@typescript-eslint/no-unsafe-assignment` | **0 warnings** (Floor ratcheted) | ✅ Floor 0 |
| **Unsafe Argument** | `@typescript-eslint/no-unsafe-argument` | **0 warnings** (Floor ratcheted) | ✅ Floor 0 |
| **Explicit Any** | `@typescript-eslint/no-explicit-any` | **0 warnings** (Floor ratcheted) | ✅ Floor 0 |
| **Untyped DB Queries** | `db.query<Row>` row-typing | **0 warnings** (Floor ratcheted) | ✅ Floor 0 |
| **A11y Audit** | `.a11y-audit.json` | **0 findings** | ✅ Passed |
| **Overall Lint Ratchet** | `node scripts/lint-ratchets.mjs --check` | **Passed cleanly** | ✅ Passed |

---

## 4. MCP Tools & Command Distillation Matrix

### A. The 10 MCP Task Tools

Repowise provides 10 task-shaped Model Context Protocol (MCP) tools that pack complete multi-file context into single calls:

1. `get_context`: Returns structured architectural, decision, and graph context for target files in **393 tokens instead of 14,000+**.
2. `query_graph`: Queries call trees, symbol callers, and route dependencies across Next.js and Web Worker boundaries.
3. `search_decisions`: Searches mined architectural decisions matching specific keywords or modules.
4. `check_health`: Evaluates defect risk, maintainability scores, and refactoring targets for target paths.
5. `get_wiki`: Fetches module-level prose documentation and dependency explanations.
6. `distill`: Compresses noisy CLI outputs before agent ingestion.
7. `get_hotspots`: Ranks files by decayed churn, bug fix frequency, and activity floors.
8. `get_cochanges`: Discovers hidden file coupling (files that change together in git history).
9. `get_decisions`: Retrieves active architectural constraints enforced on the repo.
10. `get_refactoring_targets`: Generates concrete refactoring plans (Extract Class, Extract Method, Break Cycle, Split File).

### B. Command Distillation (`repowise distill`)

Reduces token consumption during test runs and builds by compressing output while preserving exit codes and error lines:

```bash
# Compress pytest / jest / next build outputs
repowise distill npm test               # Keeps failure stacks, drops 70%+ passing noise
repowise distill git log -n 50          # Compresses git log history by 85%
repowise saved                          # Displays token & dollar savings summary
```

---

## 5. Architectural Decisions Tracked (Metardu Context)

1. **Strict Type Safety over Comment Suppression**
   - **Decision:** Codebase health must be achieved by genuine TypeScript typing (e.g. `unknown` cast recipe, explicit interfaces) rather than mass `eslint-disable-next-line` comments.
   - **Rationale:** Prevents artificial warning floor drops that mask real runtime risks.

2. **PostGIS E2E Migration Schema Isolation**
   - **Decision:** E2E test runner must instantiate Supabase-compatible database roles (`authenticated`, `anon`, `service_role`) before executing migration SQL chains.
   - **Rationale:** Prevents PostgreSQL migration failures on `GRANT ... TO authenticated` statements during headless testing.

3. **Web Worker Async Calculation Boundary**
   - **Decision:** Heavy surveying computations (TIN surface extraction, contour generation, 3D network adjustment) execute inside dedicated Web Workers via `WorkerBridge.ts`.
   - **Rationale:** Ensures Next.js main UI thread remains responsive at 60 FPS during intensive matrix operations.

---

## 6. Quick Action Commands for Metardu

```powershell
# 1. Typecheck the entire repository
npx tsc --noEmit

# 2. Check all lint & family floors
node scripts/lint-ratchets.mjs --check

# 3. Scan warning breakdown
node scripts/warn-scan.mjs --top 20

# 4. Re-baseline ratchets after clean refactoring
node scripts/lint-ratchets.mjs --update
```

---

## 7. Related Obsidian MOCs

- [[Metardu]] — Main Map of Content (MOC)
- [[Metardu Architecture]] — Full web application technical architecture
- [[Metardu Deployment]] — Docker, PostGIS, Cloudflare Tunnel topology
- [[Metardu Industrial]] — Desktop app MOC (Tauri + Rust + OpenLayers)

---

## 8. First Live Repowise Run (2026-08-13)

**Setup:** repowise **0.41.0** (AGPL-3.0 — external dev tool only, never link into the commercial app) installed via `pip` in a throwaway venv; `repowise health --refactoring-targets` and `repowise dead-code --safe-only` run fully in-process (no API key, no network, no `.repowise` index left behind).

### Health / refactoring targets (20 found)

| Score | File | Biomarker |
|---|---|---|
| 6.8 | `src/app/api/geo/transform/route.ts` | co-changes with **45 files** — shotgun surgery |
| 6.5 | `src/lib/geo/cassini.ts` | top 4% change entropy (critical) |
| 6.5 | `src/lib/security/csp.ts` | 6 defect fixes in ~6 months |
| 6.5 | `src/components/MetarduLogo.tsx` | 5 defect fixes in ~6 months |
| 5.9–6.3 | MapCoordSearch / MapStatusBar / OfflineDownloadButton | co-change scatter clusters (15–19 files) |
| 3.6 | `src/lib/rim/overlapDetection.ts` | 90-day churn rewrote 2.5× the file |
| 3.5 | `scripts/argument-scan.mjs` / `assignment-scan.mjs` | `if` with 14 boolean operators |
| 7.0 | `public/workbox-f1770938.js` | CCN 32 — **generated file, ignore** |

### Dead-code sweep

- **996 `unused_export` findings in `src/`, 447 at ≥0.9 confidence flagged safe-to-delete.**
- **Caveat:** validation showed real false positives — barrel re-exports fool the graph (`CrossSection`, `generateDXF`, `MobileMeasurementCapture` are imported). Treat as a candidate queue with per-symbol grep verification, not a delete list.
- **Two genuinely dead exports removed this session** (invisible to the eslint-based grind, which only sees non-exported unused):
  - `unregisterServiceWorkerUpdateDetector` in `AppUpdateBanner.tsx` — plus its now-write-only `swDetectorCleanup` listener machinery (17 lines)
  - `niceNow` in `app/fieldbook/helpers.ts` — the fieldbook page defines its own local copy

### Recurring value

- `repowise distill npm test` / `next build` / `git log` — compresses noisy CLI output while preserving exit codes and failure lines (the `saved` subcommand reports token savings).
- `repowise mcp` — the 10 task-shaped MCP tools (get_context, query_graph, check_health, get_hotspots, get_cochanges, get_refactoring_targets, distill…) for Claude Code / Codex / Cursor, complementary to the hand-rolled `lint-ratchets`/`warn-scan` family.
- `repowise risk` — defect-risk scoring of a change before merge; natural pair with the CI lint gate.
