import type { DeedPlanInput, DeedPlanOutput } from '@/types/deedPlan'

export interface DeedPlanRenderOptions {
  outputType?: 'internal' | 'cadastral' | 'deed' | 'client'
  includeGrid?: boolean
  includePanel?: boolean
  watermarkPlan?: 'free' | 'pro' | 'team' | 'firm' | 'enterprise'
}

export async function generateDeedPlan(
  input: DeedPlanInput,
  options?: DeedPlanRenderOptions,
): Promise<DeedPlanOutput> {
  const res = await fetch('/api/deed-plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, ...options })
  })

  if (!res.ok) {
    const error = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(error.error || 'Failed to generate deed plan')
  }

  return (await res.json()) as DeedPlanOutput
}