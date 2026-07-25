export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

/**
 * GET /api/project/[id]/cross-sections
 *
 * Fetch cross-section data for a project. Returns survey points grouped
 * by chainage station (parsed from point_name), suitable for direct
 * consumption by the earthworks calculator.
 *
 * Query params:
 *   ?interval=20     — group points into chainage bins of this width (m).
 *                      Default: 0 (no binning; return raw chainage values).
 *
 * Returns: { data: CrossSection[] }
 *   where CrossSection = {
 *     chainage: number,           // metres
 *     centerline_rl: number,      // metres (elevation of centreline point)
 *     points: Array<{
 *       point_name: string,
 *       easting: number,
 *       northing: number,
 *       elevation: number,
 *       offset: number,           // metres, +right of centreline
 *       code: string | null,
 *       description: string | null
 *     }>
 *   }
 *
 * Chainage parsing:
 *   The function attempts to parse a chainage value from each point's
 *   `point_name` using common survey formats:
 *     - "0+020"      → 20 m
 *     - "1+200.5"    → 1200.5 m
 *     - "STA 20"     → 20 m
 *     - "CH 1200"    → 1200 m
 *     - "20"         → 20 m
 *
 *   Points whose names cannot be parsed are returned in a separate
 *   "unmatched" array in the response, so the client can decide how
 *   to handle them.
 *
 * Note: full cross-section auto-population (with computed left/right
 * offsets) requires the baseline alignment geometry, which is a future
 * feature. For now, offset is 0 for all matched points; the surveyor
 * must enter offset shots manually or via CSV upload in the tool UI.
 */

interface SurveyPoint {
  id: string
  point_name: string
  easting: number
  northing: number
  elevation: number | null
  code: string | null
  description: string | null
  // CRS fields (migration 027) — nullable for backward compat
  datum?: string | null
  utm_zone?: number | null
  hemisphere?: string | null
  source?: string | null
  is_control?: boolean
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

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 60, windowMs: 60000 } },
  async (req, ctx) => {
    const { id } = ctx.params
    const url = new URL(req.url)
    const interval = parseFloat(url.searchParams.get('interval') || '0')

    // AUDIT FIX (C5, 2026-07-02): Include CRS columns so consumers know
    // the datum/zone of the returned coordinates.
    const { rows } = await db.query(
      `SELECT id, point_name, easting, northing, elevation, code, description,
              datum, utm_zone, hemisphere, source, is_control
       FROM survey_points
       WHERE project_id = $1
         AND easting IS NOT NULL
         AND northing IS NOT NULL
         AND elevation IS NOT NULL
       ORDER BY point_name ASC`,
      [id]
    )

    const points = rows as SurveyPoint[]

    // Group points by chainage
    const chainageMap = new Map<number, SurveyPoint[]>()
    const unmatched: SurveyPoint[] = []

    for (const p of points) {
      const ch = parseChainageFromName(p.point_name)
      if (ch === null) {
        unmatched.push(p)
        continue
      }
      // Apply binning if requested
      const binKey = interval > 0 ? Math.round(ch / interval) * interval : ch
      if (!chainageMap.has(binKey)) chainageMap.set(binKey, [])
      chainageMap.get(binKey)!.push(p)
    }

    // Build cross-section array sorted by chainage
    const crossSections = Array.from(chainageMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([chainage, pts]) => ({
        chainage,
        centerline_rl: pts[0].elevation as number,
        points: pts.map(p => ({
          point_name: p.point_name,
          easting: p.easting,
          northing: p.northing,
          elevation: p.elevation as number,
          offset: 0, // requires alignment geometry to compute
          code: p.code,
          description: p.description,
        })),
      }))

    return NextResponse.json({
      data: crossSections,
      meta: {
        project_id: id,
        total_points: points.length,
        matched_points: points.length - unmatched.length,
        unmatched_points: unmatched.length,
        chainage_count: crossSections.length,
        interval,
      },
      unmatched,
    })
  }
)
