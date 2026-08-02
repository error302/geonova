---
title: Navigation & Shell
tags: [navigation, navbar, sidebar, shell]
---

# Navigation & Shell

How METARDU navigation is structured.

## Two Navigation Systems
1. **Top NavBar** — `src/components/NavBar.tsx`, rendered by `src/components/layout/AppShell.tsx` on non-dashboard routes.
2. **Dashboard sidebar** — `(dashboard)/layout.tsx` + `src/components/layout/AppSidebar.tsx`, rendered on `/dashboard`, `/survey/*`, `/project/*`.

## Nav Items Source
`src/lib/navigation-shell.ts` — `PRIMARY_NAV_ITEMS`:
- Dashboard, Field Book, Map, Tools, Reports, Community

## Assistant Placement (decongest navbar)
- **Removed** from top nav (`PRIMARY_NAV_ITEMS`)
- **Added** to Community page (`src/app/community/page.tsx`) — quick-action button + standalone sidebar card
- **Added** to dashboard sidebar (`AppSidebar.tsx`) — "Assistant" item with Sparkles icon before "Help"
- **Kept** in Ctrl+K palette (`NavBar.tsx` searchablePages)

## Key Rule in AppShell
`AppShell.tsx:216` — `{!dashboard && <NavBar />}`. Dashboard routes hide the top NavBar to avoid double navigation; the sidebar takes over.

## Related
- [[Dashboard Onboarding]]
- [[Survey Assistant]]
