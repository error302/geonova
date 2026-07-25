'use client'

import { useState, useEffect } from 'react'
import DeedPlanGenerator from '@/components/deedplan/DeedPlanGenerator'
import type { BoundaryPoint } from '@/types/deedPlan'
import type { BeaconType, BeaconStatus } from '@/types/deedPlan'

/**
 * ProjectDeedPlan — wrapper that connects DeedPlanGenerator to a real project.
 *
 * Fetches the project's survey points from /api/project/[id]/points and
 * converts them to BoundaryPoint[] format for DeedPlanGenerator's initialPoints.
 *
 * This is the "missing wire" — previously the deed plan page used
 * projectId="new" with no project data. Now a surveyor can:
 * 1. Run traverse adjustment in their project
 * 2. Go to the deed plan step
 * 3. See their adjusted coordinates auto-populated
 *
 * Usage:
 *   <ProjectDeedPlan projectId="abc-123" />
 *   // or as a route: /deed-plan?project=abc-123
 */

interface ProjectDeedPlanProps {
  projectId: string
}

interface SurveyPoint {
  id: string
  point_name: string
  easting: number
  northing: number
  elevation: number | null
  code: string | null
  description: string | null
  is_control: boolean
}

// Default beacon type/status when converting survey points to boundary points
const DEFAULT_MARK_TYPE: BeaconType = 'CONCRETE_BEACON'
const DEFAULT_MARK_STATUS: BeaconStatus = 'SET'

function surveyPointToBoundaryPoint(p: SurveyPoint): BoundaryPoint {
  return {
    id: p.point_name || p.id,
    easting: p.easting,
    northing: p.northing,
    elevation: p.elevation ?? undefined,
    markType: DEFAULT_MARK_TYPE,
    markStatus: DEFAULT_MARK_STATUS,
    description: p.description || p.code || undefined,
  }
}

export default function ProjectDeedPlan({ projectId }: ProjectDeedPlanProps) {
  const [points, setPoints] = useState<BoundaryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchPoints() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/project/${projectId}/points`)
        if (!res.ok) {
          throw new Error(`Failed to load project points (${res.status})`)
        }
        const json = await res.json()
        const surveyPoints: SurveyPoint[] = json.data || []
        const boundaryPoints = surveyPoints.map(surveyPointToBoundaryPoint)
        if (!cancelled) {
          setPoints(boundaryPoints)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load project points')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    if (projectId && projectId !== 'new') {
      fetchPoints()
    } else {
      setLoading(false)
    }

    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="font-mono text-xs text-[var(--text-muted)] tracking-[0.04em] uppercase">
          Loading project coordinates...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="border border-[var(--error)]/30 bg-[var(--error)]/5 p-4 rounded-md">
          <p className="font-mono text-xs text-[var(--error)] tracking-[0.04em] uppercase mb-2">
            Could not load project points
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
          <p className="text-xs text-[var(--text-muted)]">
            You can still create a deed plan manually — your project coordinates
            will not be auto-populated.
          </p>
        </div>
        <div className="mt-6">
          <DeedPlanGenerator projectId={projectId} initialPoints={[]} />
        </div>
      </div>
    )
  }

  return (
    <div>
      {points.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 rounded-md flex items-center gap-3">
            <svg className="w-4 h-4 text-[var(--accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--accent)]">{points.length} points</span>{' '}
              auto-populated from project survey data. Adjust beacon types and statuses
              below before generating the plan.
            </p>
          </div>
        </div>
      )}
      <DeedPlanGenerator projectId={projectId} initialPoints={points} />
    </div>
  )
}
