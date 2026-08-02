---
title: Survey Assistant
tags: [ai, assistant, cap299, webgpu]
---

# Survey Assistant

AI chat assistant grounded in Kenya's Survey Act Cap 299, Survey Regulations LN 168/1994, and the Cadastral Survey Standards Guidelines Manual.

## Routes / Entry Points
- **Page**: `/assistant`
- **Component**: `src/components/ai/SurveyAssistant.tsx`
- **Chat service**: `src/lib/ai/smartAiService.ts` (hybrid Cloud/NIM + Local WebGPU)
- **Offline LLM**: `src/lib/ai/localLlmService.ts` (WebLLM Phi-3-mini-4k-instruct-q4f16_1-MLC)
- **Worker**: `src/lib/ai/llm.worker.ts`
- **Knowledge base**: `src/lib/ai/knowledge/cap299.ts`

## UI Features
- Live model status indicator (idle / loading / ready / error)
- Progress bar for model download
- Online/offline badge
- Streaming tokens via `onToken`
- 6 suggestion chips
- Friendly error fallback

## Knowledge (Cap 299)
Enriched to a comprehensive reference covering:
- Legal framework (Survey Act Cap 299, LN 168/1994, Registration of Titles Act)
- 5-stage survey workflow (Primary → Field → Compute → Plan → Submit)
- Coordinate systems (Arc 1960, UTM 36S/37S, Cassini)
- Traverse tolerances
- Beacon standards
- RIM / mutation forms
- Field notes, plans, deed plans
- Fees, reporting units
- Surveyor responsibility & AI limitations

## Entry Points in Nav
- **Community page** (quick action + sidebar card) — `src/app/community/page.tsx`
- **Dashboard sidebar** — `src/components/layout/AppSidebar.tsx` (Assistant item)
- **Ctrl+K palette** — `src/components/NavBar.tsx`
- Removed from **top nav** (decongests navbar) — see [[Navigation & Shell]]

## Related
- [[Dashboard Onboarding]]
- [[Navigation & Shell]]
