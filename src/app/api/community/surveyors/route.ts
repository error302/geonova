/**
 * /api/community/surveyors
 *
 * GET — List verified surveyors with public profiles.
 *
 * Returns surveyors who have:
 *   - A verified ISK number (verified_isk = true), OR
 *   - A non-empty firm_name / full_name in their profile
 *
 * Includes a count of projects per surveyor (LEFT JOIN on projects table).
 *
 * Query params:
 *   limit  — max results (default 12, max 50)
 *   county — filter by county (optional)
 *   q      — search by name, firm, or ISK number (optional)
 *
 * Public endpoint (no auth required) — only shows public profile fields.
 */

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'

export const GET = apiHandler(
  { auth: false, rateLimit: { max: 30, windowMs: 60_000 } },
  async (req: NextRequest) => {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '12', 10), 50)
    const county = searchParams.get('county')?.trim() || undefined
    const q = searchParams.get('q')?.trim() || undefined

    const conditions: string[] = [
      // Only show users who have something displayable
      '(u.full_name IS NOT NULL OR p.firm_name IS NOT NULL)',
      // Exclude suspended users
      "u.role != 'suspended'",
    ]
    const params: unknown[] = []
    let idx = 1

    if (county) {
      conditions.push(`p.address ILIKE $${idx++}`)
      params.push(`%${county}%`)
    }

    if (q) {
      conditions.push(`(
        u.full_name ILIKE $${idx} OR
        p.firm_name ILIKE $${idx} OR
        u.isk_number ILIKE $${idx}
      )`)
      params.push(`%${q}%`)
      idx++
    }

    const where = 'WHERE ' + conditions.join(' AND ')
    params.push(limit)

    const { rows } = await db.query(
      `SELECT
         u.id,
         u.full_name,
         u.isk_number,
         u.verified_isk,
         u.oauth_avatar_url AS avatar_url,
         p.firm_name,
         p.bio,
         p.address,
         COUNT(proj.id) AS projects_count
       FROM users u
       LEFT JOIN profiles p ON p.id = u.id
       LEFT JOIN projects proj ON proj.user_id = u.id
       ${where}
       GROUP BY u.id, p.firm_name, p.bio, p.address
       ORDER BY
         u.verified_isk DESC,
         COUNT(proj.id) DESC,
         u.created_at DESC
       LIMIT $${idx}`,
      params,
    )

    // Map to the shape the community page expects
    const surveyors = rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      fullName: (r.full_name as string) || (r.firm_name as string) || 'Anonymous Surveyor',
      iskNumber: (r.isk_number as string) || undefined,
      verifiedIsk: Boolean(r.verified_isk),
      firmName: (r.firm_name as string) || undefined,
      county: extractCountyFromAddress(r.address as string | null),
      specialty: inferSpecialty(r.bio as string | null),
      avatarUrl: (r.avatar_url as string) || undefined,
      projectsCount: parseInt(String(r.projects_count || '0'), 10),
    }))

    return NextResponse.json({ data: surveyors })
  },
)

/** Extract a county name from a free-text address field (best effort). */
function extractCountyFromAddress(address: string | null): string | undefined {
  if (!address) return undefined
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  return parts[parts.length - 1] || undefined
}

/**
 * Infer a specialty from the bio text (best effort).
 * Looks for keywords like 'cadastral', 'GNSS', 'engineering', etc.
 */
function inferSpecialty(bio: string | null): string | undefined {
  if (!bio) return undefined
  const lower = bio.toLowerCase()
  if (lower.includes('cadastral') || lower.includes('mutation') || lower.includes('deed')) {
    return 'Cadastral'
  }
  if (lower.includes('gnss') || lower.includes('gps') || lower.includes('control')) {
    return 'GNSS & Control'
  }
  if (lower.includes('engineering') || lower.includes('road') || lower.includes('construction')) {
    return 'Engineering'
  }
  if (lower.includes('topographic') || lower.includes('topo')) {
    return 'Topographic'
  }
  if (lower.includes('hydro') || lower.includes('bathymetric')) {
    return 'Hydrographic'
  }
  if (lower.includes('drone') || lower.includes('uav') || lower.includes('photogrammetry')) {
    return 'Drone / UAV'
  }
  return undefined
}
