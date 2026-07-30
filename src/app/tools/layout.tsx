import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Survey Tools — METARDU',
  description: '60+ surveying calculation tools: COGO, traverse, leveling, coordinate transformation, curves, earthworks, GNSS, and more.',
  // P1-4 (2026-07-24): Canonical is /tools (the catalog page with
  // TOOL_DEFS — 54 tools, 12 sections, plan-gating, search/filter).
  // /tools/all renders the ProcessingToolbox component (40 tools,
  // 8 categories) and is kept as an alternative view but is NOT the
  // canonical URL.
  alternates: { canonical: '/tools' },
}

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children
}
