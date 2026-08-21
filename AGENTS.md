# METARDU — Agent Instructions

METARDU is a Next.js 14 (App Router) land-surveying platform. Server components
by default; client components opt in with `'use client'`. Direct DB access runs
through the `/api/db` proxy (whitelisted tables only) or server-side
`createClient()`. Verify with `npx tsc --noEmit`; build/restart procedure is
`npm run build` (must not run while the standalone server is up — stop the
port-3000 process first) then launch `start-metardu-local.ps1` (local
standalone launcher, currently at
`C:\Users\user\AppData\Local\Temp\opencode\start-metardu-local.ps1`; the
repo-root `start-metardu.ps1` is the docker + cloudflared tunnel launcher,
not for local standalone testing).

## Footer "Apps" column

`src/components/Footer.tsx` renders the `FOOTER_LINKS.Apps` array. It is the
canonical list of METARDU product surfaces (a.k.a. the app "franchise"). Keep it
current when products launch, rename, or retire.

Maintenance rules for agents:

- Each entry is `{ label, href }`. `label` is the marketing name; `href` must
  point to a route that exists under `src/app/` — never link to a page that
  hasn't been built.
- Keep 4–5 entries. Order by breadth of audience: full platform first
  (`/tools`), then dedicated surfaces (`/industrial`, `/fieldbook`), then
  commercial (`/pricing`).
- When adding a product: build/verify its route first, then insert the entry in
  alphabetical-of-importance order (the existing order above).
- When renaming a product: update the `label` AND any pages/docs that reference
  the old name. When retiring one: remove the entry and the now-orphaned route
  or add a redirect from it.
- `href` is a relative app path (e.g. `/tools`). External/`mailto:` links do not
  belong in `Apps` — use the `Developers` column for support/mail links.
- This is a static `as const` array; no data source or CMS is involved. There is
  no "upload" mechanism — editing the array is the upload.

## Graphify & Obsidian Knowledge Architecture

The codebase knowledge graph is maintained at `graphify-out/graph.json` and mirrored in `graphify-out/obsidian-vault/`.

Rules for agents and developers:
- Before making significant architectural changes or investigating cross-module dependencies, consult the knowledge graph using `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"`.
- After modifying or adding code files, execute `graphify extract . --code-only` and `npx tsx scripts/sync-to-obsidian.ts` to keep the AST knowledge graph and Obsidian notes synchronized.
- Never make blind assumptions about math, projection transforms, or document generators; verify the call pathway to ensure zero mathematical regressions.

