---
title: Dashboard Onboarding
tags: [dashboard, onboarding, workflow, ux]
---

# Dashboard Onboarding

Redesigned empty-state + onboarding workflow for new users.

## Files
- `src/app/dashboard/page.tsx` — empty state (5-step workflow + checklist + AI CTA)
- `src/components/shared/OnboardingWrapper.tsx` — conditional render (localStorage `metardu_onboarding_dismissed`)
- `src/components/shared/OnboardingChecklist.tsx` — step list with progress

## 5-Step Workflow Card
1. Primary Investigation
2. Field Survey
3. Compute & Adjust
4. Prepare Plan
5. Submit

Plus:
- Getting Started checklist (steps: create project, add points, traverse adjustment, deed plan, field book, compliance)
- Prominent **Survey Assistant** CTA card (orange gradient)
- Bottom quick-links

## Navbar Visibility During Onboarding
The top `NavBar` is intentionally hidden on `/dashboard` routes — the dashboard uses **sidebar** navigation via `(dashboard)/layout.tsx` → `AppSidebar.tsx`. The sidebar stays rendered during onboarding, so navigation is accessible. See [[Navigation & Shell]].

## Related
- [[Survey Assistant]]
- [[Navigation & Shell]]
