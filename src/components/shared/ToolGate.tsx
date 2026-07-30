'use client';

/**
 * ToolGate — client-side plan-gate wrapper for tool pages.
 *
 * P0-2 (2026-07-24): Previously the 9 gated tools (civil-export,
 * gis-export, machine-control, topo-drawing, survey-plan-demo,
 * gnss-baseline, drone, slope-analysis, progress-monitor) only showed
 * lock badges on the catalog page. Direct-URL access bypassed the
 * gate entirely. Wrapping each gated tool's content in <ToolGate>
 * enforces the same check at the page level.
 *
 * Behaviour:
 *   - While subscription state is loading → show a skeleton
 *   - If user is admin → always allow (admin bypass)
 *   - If user has the required feature → render children
 *   - Otherwise → show an upgrade prompt with a link to /pricing
 *
 * This is a UX gate. Server-side enforcement happens on the gated
 * API routes via the `requirePlan()` decorator. A determined user
 * could still inspect the client JSX, but they can't get a real
 * export without the server-side plan check firing.
 */

import Link from 'next/link'
import { useSubscription } from '@/lib/subscription/subscriptionContext'
import { getToolGate, PLAN_RANK } from '@/lib/subscription/toolGates'
import { Lock, ArrowRight } from 'lucide-react'

interface ToolGateProps {
  /** The tool path, e.g. "/tools/civil-export". Must exist in TOOL_GATES. */
  toolPath: string
  children: React.ReactNode
}

export function ToolGate({ toolPath, children }: ToolGateProps) {
  const { plan, isAdmin, loading, hasFeature } = useSubscription()
  const gate = getToolGate(toolPath)

  // Unknown gate path — render children (defensive; shouldn't happen
  // because the catalog only marks known gated tools).
  if (!gate) {
    return <>{children}</>
  }

  // Loading state — show a minimal skeleton so the page doesn't flash
  // the upgrade prompt for paying users.
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
          <p className="text-sm text-[var(--text-muted)]">Checking your subscription…</p>
        </div>
      </div>
    )
  }

  // Admins bypass all gates.
  if (isAdmin) {
    return <>{children}</>
  }

  // Plan meets minimum AND has the feature → allow.
  const planOk = PLAN_RANK[plan] >= PLAN_RANK[gate.minPlan]
  const featureOk = hasFeature(gate.feature)
  if (planOk && featureOk) {
    return <>{children}</>
  }

  // Locked — show upgrade prompt.
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30">
          <Lock className="w-7 h-7 text-[var(--accent)]" aria-hidden />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            {gate.minPlan === 'team' ? 'Team plan required' : 'Pro plan required'}
          </h1>
          <p className="text-[var(--text-muted)] leading-relaxed">
            This tool requires the <strong className="text-[var(--text-secondary)]">{gate.label}</strong> feature,
            available on the <strong className="text-[var(--text-secondary)]">{gate.minPlan === 'team' ? 'Team' : 'Pro'}</strong> plan
            and above.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-opacity"
          >
            View plans
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] font-medium hover:border-[var(--accent)]/30 transition-colors"
          >
            Back to tools
          </Link>
        </div>

        <p className="text-xs text-[var(--text-muted)] pt-4 border-t border-[var(--border-color)]">
          From KES 500/month · Cancel anytime · Used by surveyors across East Africa
        </p>
      </div>
    </div>
  )
}

/**
 * Convenience hook for tool pages that need to check the gate without
 * wrapping (e.g. to conditionally render a sub-section). Returns the
 * gate info + whether access is allowed.
 */
export function useToolGate(toolPath: string) {
  const { plan, isAdmin, loading, hasFeature } = useSubscription()
  const gate = getToolGate(toolPath)

  if (!gate) {
    return { gate: null, allowed: true, loading: false }
  }

  if (loading) {
    return { gate, allowed: false, loading: true }
  }

  if (isAdmin) {
    return { gate, allowed: true, loading: false }
  }

  const planOk = PLAN_RANK[plan] >= PLAN_RANK[gate.minPlan]
  const featureOk = hasFeature(gate.feature)
  return { gate, allowed: planOk && featureOk, loading: false }
}
