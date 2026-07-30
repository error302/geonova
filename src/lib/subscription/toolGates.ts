/**
 * Tool plan-gate registry — single source of truth.
 * ================================================
 *
 * Maps each gated tool route to the minimum plan + feature key required.
 * Tools NOT in this map are available on ALL tiers (free+).
 *
 * P0-2 (2026-07-24): Previously this map lived only inside
 * `src/app/tools/page.tsx` as a local const, so the catalog page could
 * show lock badges — but the actual tool `page.tsx` files never
 * re-checked the gate. A free user could bypass the gate by typing the
 * URL directly (e.g. `/tools/civil-export`).
 *
 * Now this shared module is the single source of truth. The catalog
 * page imports it for badge display, and each gated tool page wraps
 * its content in `<ToolGate toolPath="/tools/...">` which reads from
 * this map via the `useSubscription()` context.
 *
 * Note: this is a CLIENT-SIDE gate for UX. The real enforcement for
 * any tool that calls a gated server-side API (e.g. /api/export/*)
 * happens server-side via the `requirePlan()` decorator on the API
 * route. This client gate just prevents the user from seeing the tool
 * UI when they can't use it.
 */

import type { PlanId } from '@/lib/subscription/catalog'
import type { FeatureKey } from '@/lib/subscription/featureGates'

export interface GateInfo {
  /** Minimum subscription plan required to use this tool. */
  minPlan: PlanId
  /** Feature key that unlocks this tool (used for hasFeature() check). */
  feature: FeatureKey
  /** Human-readable label shown on the lock badge + upgrade prompt. */
  label: string
}

export const TOOL_GATES: Record<string, GateInfo> = {
  '/tools/civil-export':     { minPlan: 'pro',  feature: 'dxf_export',       label: 'DXF Export' },
  '/tools/gis-export':       { minPlan: 'pro',  feature: 'landxml',         label: 'LandXML' },
  '/tools/machine-control':  { minPlan: 'pro',  feature: 'dxf_export',      label: 'DXF Export' },
  '/tools/topo-drawing':     { minPlan: 'pro',  feature: 'dxf_export',      label: 'DXF Export' },
  '/tools/survey-plan-demo': { minPlan: 'pro',  feature: 'full_pdf',        label: 'Full PDF' },
  '/tools/gnss-baseline':    { minPlan: 'pro',  feature: 'process_notes',   label: 'Process Notes' },
  '/tools/drone':            { minPlan: 'pro',  feature: 'process_notes',   label: 'Process Notes' },
  '/tools/slope-analysis':   { minPlan: 'pro',  feature: 'full_pdf',        label: 'Full PDF' },
  '/tools/progress-monitor': { minPlan: 'team', feature: 'realtime_collab', label: 'Collaboration' },
}

/** Plan rank for comparison (free < pro < team < firm < enterprise). */
export const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  pro: 1,
  team: 2,
  firm: 3,
  enterprise: 4,
}

/**
 * Look up the gate for a tool path. Returns `null` if the tool is free.
 */
export function getToolGate(toolPath: string): GateInfo | null {
  return TOOL_GATES[toolPath] ?? null
}
