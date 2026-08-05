export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { log } from '@/lib/logger'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchType = 'projects' | 'submissions' | 'surveyors' | 'users' | 'all'

interface SearchHit {
  id: string
  type: string
  title: string
  subtitle?: string
  /** Human-readable snippet showing the matching context */
  snippet?: string
  /** Relevance score – higher is better. Normalised across tables for sorting. */
  score: number
  /** Extra columns that vary per entity type */
  meta?: Record<string, unknown>
}

interface ProjectSearchRow {
  id: string
  name: string | null
  description: string | null
  survey_type: string | null
  location: string | null
  created_at: string | Date
  score: string | number
}

interface SubmissionSearchRow {
  id: string
  title: string | null
  status: string | null
  survey_type: string | null
  created_at: string | Date
  score: string | number
}

interface SurveyorSearchRow {
  id: string
  user_id: string | null
  full_name: string | null
  isk_number: string | null
  firm_name: string | null
  specialization: string | null
  county: string | null
  score: string | number
}

interface UserSearchRow {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
  score: string | number
}

interface SearchResultGroup {
  type: string
  total: number
  hits: SearchHit[]
}

interface SearchResponse {
  query: string
  results: SearchResultGroup[]
  total: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitise a raw user query so it can safely feed into plainto_tsquery. */
function sanitiseQuery(raw: string): string {
  return raw
    .replace(/[^\w\s@.-]/g, ' ')   // keep alphanumerics, @, dot, hyphen
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)                  // cap length
}

/**
 * Build the two search vectors used for every table:
 *  1. `ts_query`  – PostgreSQL tsquery via plainto_tsquery (stemming, stop-words)
 *  2. `ilike_clause` + `ilike_param` – simple substring fallback
 *
 * Both are combined with OR so that results match either strategy.
 */
function buildSearchFragments(rawQuery: string) {
  const safe = sanitiseQuery(rawQuery)
  const ilikeParam = `%${safe}%`
  return { safe, ilikeParam }
}

// ---------------------------------------------------------------------------
// Per-table search queries
// ---------------------------------------------------------------------------

async function searchProjects(
  query: string,
  ilikeParam: string,
  limit: number
): Promise<SearchHit[]> {
  const { rows } = await db.query<ProjectSearchRow>(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.survey_type,
       p.location,
       p.created_at,
       GREATEST(
         ts_rank(
           setweight(to_tsvector('english', coalesce(p.name, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(p.description, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(p.survey_type, '')), 'C') ||
           setweight(to_tsvector('english', coalesce(p.location, '')), 'C'),
           plainto_tsquery('english', $1)
         ),
         CASE WHEN p.name ILIKE $2 THEN 0.6 ELSE 0 END,
         CASE WHEN p.description ILIKE $2 THEN 0.3 ELSE 0 END,
         CASE WHEN p.location ILIKE $2 THEN 0.2 ELSE 0 END
       ) AS score
     FROM projects p
     WHERE
       plainto_tsquery('english', $1) @@
         (setweight(to_tsvector('english', coalesce(p.name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(p.description, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(p.survey_type, '')), 'C') ||
          setweight(to_tsvector('english', coalesce(p.location, '')), 'C'))
       OR p.name ILIKE $2
       OR p.description ILIKE $2
       OR p.survey_type ILIKE $2
       OR p.location ILIKE $2
     ORDER BY score DESC, p.created_at DESC
     LIMIT $3`,
    [query, ilikeParam, limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    type: 'projects',
    title: r.name ?? 'Untitled Project',
    subtitle: r.survey_type ?? undefined,
    snippet: r.description
      ? r.description.slice(0, 200)
      : undefined,
    score: Number(r.score),
    meta: {
      location: r.location ?? undefined,
      created_at: r.created_at,
    },
  }))
}

async function searchSubmissions(
  query: string,
  ilikeParam: string,
  limit: number
): Promise<SearchHit[]> {
  const { rows } = await db.query<SubmissionSearchRow>(
    `SELECT
       s.id,
       s.title,
       s.status,
       s.survey_type,
       s.created_at,
       GREATEST(
         ts_rank(
           setweight(to_tsvector('english', coalesce(s.title, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(s.survey_type, '')), 'B'),
           plainto_tsquery('english', $1)
         ),
         CASE WHEN s.title ILIKE $2 THEN 0.6 ELSE 0 END,
         CASE WHEN s.survey_type ILIKE $2 THEN 0.3 ELSE 0 END
       ) AS score
     FROM submissions s
     WHERE
       plainto_tsquery('english', $1) @@
         (setweight(to_tsvector('english', coalesce(s.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(s.survey_type, '')), 'B'))
       OR s.title ILIKE $2
       OR s.survey_type ILIKE $2
     ORDER BY score DESC, s.created_at DESC
     LIMIT $3`,
    [query, ilikeParam, limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    type: 'submissions',
    title: r.title ?? 'Untitled Submission',
    subtitle: r.status ?? undefined,
    snippet: r.survey_type ?? undefined,
    score: Number(r.score),
    meta: {
      survey_type: r.survey_type ?? undefined,
      status: r.status ?? undefined,
      created_at: r.created_at,
    },
  }))
}

async function searchSurveyors(
  query: string,
  ilikeParam: string,
  limit: number
): Promise<SearchHit[]> {
  const { rows } = await db.query<SurveyorSearchRow>(
    `SELECT
       sp.id,
       sp.user_id,
       sp.full_name,
       sp.isk_number,
       sp.firm_name,
       sp.specialization,
       sp.county,
       GREATEST(
         ts_rank(
           setweight(to_tsvector('english', coalesce(sp.full_name, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(sp.firm_name, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(sp.specialization, '')), 'B') ||
           setweight(to_tsvector('english', coalesce(sp.county, '')), 'C'),
           plainto_tsquery('english', $1)
         ),
         CASE WHEN sp.full_name ILIKE $2 THEN 0.6 ELSE 0 END,
         CASE WHEN sp.isk_number ILIKE $2 THEN 0.5 ELSE 0 END,
         CASE WHEN sp.firm_name ILIKE $2 THEN 0.4 ELSE 0 END,
         CASE WHEN sp.specialization ILIKE $2 THEN 0.3 ELSE 0 END,
         CASE WHEN sp.county ILIKE $2 THEN 0.2 ELSE 0 END
       ) AS score
     FROM surveyor_profiles sp
     WHERE
       plainto_tsquery('english', $1) @@
         (setweight(to_tsvector('english', coalesce(sp.full_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(sp.firm_name, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(sp.specialization, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(sp.county, '')), 'C'))
       OR sp.full_name ILIKE $2
       OR sp.isk_number ILIKE $2
       OR sp.firm_name ILIKE $2
       OR sp.specialization ILIKE $2
       OR sp.county ILIKE $2
     ORDER BY score DESC
     LIMIT $3`,
    [query, ilikeParam, limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    type: 'surveyors',
    title: r.full_name ?? 'Unknown Surveyor',
    subtitle: r.isk_number ?? undefined,
    snippet: [r.firm_name, r.specialization].filter(Boolean).join(' — ') || undefined,
    score: Number(r.score),
    meta: {
      user_id: r.user_id ?? undefined,
      firm_name: r.firm_name ?? undefined,
      specialization: r.specialization ?? undefined,
      county: r.county ?? undefined,
    },
  }))
}

async function searchUsers(
  query: string,
  ilikeParam: string,
  limit: number
): Promise<SearchHit[]> {
  // Users table — limited fields for privacy (only id, email, full_name, role)
  const { rows } = await db.query<UserSearchRow>(
    `SELECT
       u.id,
       u.email,
       u.full_name,
       u.role,
       GREATEST(
         ts_rank(
           setweight(to_tsvector('english', coalesce(u.full_name, '')), 'A') ||
           setweight(to_tsvector('english', coalesce(u.email, '')), 'B'),
           plainto_tsquery('english', $1)
         ),
         CASE WHEN u.full_name ILIKE $2 THEN 0.6 ELSE 0 END,
         CASE WHEN u.email ILIKE $2 THEN 0.3 ELSE 0 END
       ) AS score
     FROM users u
     WHERE
       plainto_tsquery('english', $1) @@
         (setweight(to_tsvector('english', coalesce(u.full_name, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(u.email, '')), 'B'))
       OR u.full_name ILIKE $2
       OR u.email ILIKE $2
     ORDER BY score DESC
     LIMIT $3`,
    [query, ilikeParam, limit]
  )

  return rows.map((r) => ({
    id: String(r.id),
    type: 'users',
    title: r.full_name ?? r.email ?? 'Unknown User',
    subtitle: r.role ?? undefined,
    snippet: r.email ?? undefined,
    score: Number(r.score),
    meta: {
      role: r.role ?? undefined,
    },
  }))
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export const GET = apiHandler(
  { auth: true, rateLimit: { max: 30, windowMs: 60000 } },
  async (req, _ctx) => {
    const url = new URL(req.url)
    const rawQuery = (url.searchParams.get('q') ?? '').trim()
    const rawType = url.searchParams.get('type') ?? 'all'
    const rawLimit = url.searchParams.get('limit')

    // ---- Validate inputs ----
    if (!rawQuery) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required', code: 'MISSING_QUERY' },
        { status: 400 }
      )
    }

    const validTypes: SearchType[] = ['projects', 'submissions', 'surveyors', 'users', 'all']
    const searchType: SearchType = validTypes.includes(rawType as SearchType)
      ? (rawType as SearchType)
      : 'all'

    const limit = Math.min(Math.max(Number(rawLimit) || 20, 1), 100)

    const { safe, ilikeParam } = buildSearchFragments(rawQuery)

    // Nothing left after sanitisation
    if (!safe) {
      return NextResponse.json(
        { error: 'Query contains no searchable terms', code: 'EMPTY_QUERY' },
        { status: 400 }
      )
    }

    // ---- Execute searches in parallel ----
    const searchPromises: Promise<SearchHit[]>[] = []

    if (searchType === 'all' || searchType === 'projects') {
      searchPromises.push(searchProjects(safe, ilikeParam, limit))
    }
    if (searchType === 'all' || searchType === 'submissions') {
      searchPromises.push(searchSubmissions(safe, ilikeParam, limit))
    }
    if (searchType === 'all' || searchType === 'surveyors') {
      searchPromises.push(searchSurveyors(safe, ilikeParam, limit))
    }
    if (searchType === 'all' || searchType === 'users') {
      searchPromises.push(searchUsers(safe, ilikeParam, limit))
    }

    const settled = await Promise.allSettled(searchPromises)

    // Map settled results back to their type labels
    const typeLabels: string[] = []
    if (searchType === 'all' || searchType === 'projects')   typeLabels.push('projects')
    if (searchType === 'all' || searchType === 'submissions') typeLabels.push('submissions')
    if (searchType === 'all' || searchType === 'surveyors')   typeLabels.push('surveyors')
    if (searchType === 'all' || searchType === 'users')       typeLabels.push('users')

    const results: SearchResultGroup[] = []
    let grandTotal = 0

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i]
      const label = typeLabels[i]

      if (outcome.status === 'fulfilled') {
        const hits = outcome.value
        results.push({ type: label, total: hits.length, hits })
        grandTotal += hits.length
      } else {
        // Graceful degradation – include empty group rather than failing the whole request
        log({ level: 'error', message: `[search] ${label} search failed`, metadata: { reason: String(outcome.reason) } })
        results.push({ type: label, total: 0, hits: [] })
      }
    }

    // Sort groups by total hits descending
    results.sort((a, b) => b.total - a.total)

    const response: SearchResponse = {
      query: rawQuery,
      results,
      total: grandTotal,
    }

    return NextResponse.json(response)
  }
)
