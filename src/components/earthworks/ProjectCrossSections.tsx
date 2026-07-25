'use client'

import { useState, useEffect, useRef } from 'react'
import CrossSectionInput from '@/components/earthworks/CrossSectionInput'

/**
 * ProjectCrossSections — wrapper that connects CrossSectionInput to a project.
 *
 * Fetches the project's survey points and attempts to match point names to
 * chainage stations (e.g. "0+020", "20", "STA 20" → chainage 20m).
 * Uses the elevation as the centreline reduced level (clRL).
 *
 * Limitation: full cross-section auto-population (with left/right offset shots)
 * requires the baseline alignment geometry, which is a future feature.
 * For now, this populates centreline levels only — the surveyor still enters
 * offset shots manually or via CSV.
 *
 * Usage:
 *   <ProjectCrossSections projectId="abc-123" />
 *   // or as a route: /tools/cross-sections?project=abc-123
 */

interface ProjectCrossSectionsProps {
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
}

/**
 * Attempt to extract a chainage value (in metres) from a point name.
 * Handles formats: "0+020", "0+020.5", "20", "STA 20", "CH 1200"
 */
function parseChainageFromName(name: string): number | null {
  if (!name) return null
  const upper = name.toUpperCase().trim()

  // Format: "0+020" or "1+200.5" (km+m)
  const kmMatch = upper.match(/(\d+)\+(\d+(?:\.\d+)?)/)
  if (kmMatch) {
    return parseInt(kmMatch[1]) * 1000 + parseFloat(kmMatch[2])
  }

  // Format: "STA 20" or "CH 1200" or just "20"
  const staMatch = upper.match(/(?:STA|CH|CHAINAGE)?\s*(\d+(?:\.\d+)?)/)
  if (staMatch) {
    return parseFloat(staMatch[1])
  }

  return null
}

export default function ProjectCrossSections({ projectId }: ProjectCrossSectionsProps) {
  const [loading, setLoading] = useState(true)
  const [matchedCount, setMatchedCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const inputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchPoints() {
      try {
        const res = await fetch(`/api/project/${projectId}/points`)
        if (!res.ok) return
        const json = await res.json()
        const points: SurveyPoint[] = json.data || []

        // Try to match points to chainage stations
        const matched: { chainage: number; rl: number; name: string }[] = []
        for (const p of points) {
          if (p.elevation == null) continue
          const ch = parseChainageFromName(p.point_name)
          if (ch !== null) {
            matched.push({ chainage: ch, rl: p.elevation, name: p.point_name })
          }
        }

        if (!cancelled && matched.length > 0) {
          // Sort by chainage
          matched.sort((a, b) => a.chainage - b.chainage)
          // Store in sessionStorage as CSV for the CrossSectionInput's CSV import
          // Format: chainage,centrelineRL,formationRL,leftOffsets,rightOffsets
          // We only have centreline RL — formation RL and offsets are blank
          const csvLines = matched.map(m => {
            const km = Math.floor(m.chainage / 1000)
            const m2 = m.chainage % 1000
            return `${km}+${m2.toFixed(3)},${m.rl.toFixed(3)},,,`
          })
          const csv = `chainage,centrelineRL,formationRL,left,right\n` + csvLines.join('\n')
          sessionStorage.setItem(`metardu:cross-sections:csv:${projectId}`, csv)
          setMatchedCount(matched.length)
        }
      } catch {
        // silent fail
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoaded(true)
        }
      }
    }

    if (projectId && projectId !== 'new') {
      fetchPoints()
    } else {
      setLoading(false)
      setLoaded(true)
    }

    return () => { cancelled = true }
  }, [projectId])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="font-mono text-xs text-[var(--text-muted)] tracking-[0.04em] uppercase">
          Loading project data...
        </div>
      </div>
    )
  }

  return (
    <div ref={inputRef}>
      {matchedCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3 rounded-md flex items-center gap-3">
            <svg className="w-4 h-4 text-[var(--accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="font-mono text-[var(--accent)]">{matchedCount} centreline levels</span>{' '}
              matched from project survey points (by chainage name). Use the CSV import
              below to load them. Offset shots and formation levels need manual entry.
            </p>
          </div>
        </div>
      )}
      {loaded && matchedCount === 0 && projectId !== 'new' && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="border border-[var(--border-color)] bg-[var(--bg-card)] p-3 rounded-md flex items-center gap-3">
            <svg className="w-4 h-4 text-[var(--text-muted)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <p className="text-xs text-[var(--text-muted)]">
              No chainage-matched points found in project. Name your survey points
              as &quot;0+020&quot; or &quot;20&quot; (chainage in metres) to auto-populate centreline levels.
            </p>
          </div>
        </div>
      )}
      <CrossSectionInput />
    </div>
  )
}
