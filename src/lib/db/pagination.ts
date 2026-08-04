/**
 * Pagination utility for API routes.
 * Standardizes limit/offset pagination across all list endpoints.
 *
 * Usage in an apiHandler route:
 *   const { limit, offset, page } = parsePagination(req.url)
 *   const { rows } = await db.query('SELECT * FROM parcels LIMIT $1 OFFSET $2', [limit, offset])
 *   const { rows: countRows } = await db.query('SELECT COUNT(*) FROM parcels')
 *   return NextResponse.json(paginateResponse(rows, countRows[0].count, limit, offset))
 */

export interface PaginationParams {
  limit: number
  offset: number
  page: number
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    offset: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 500

/**
 * Parse pagination parameters from a URL's search params.
 * Supports: ?limit=20&page=2 or ?limit=20&offset=40
 */
export function parsePagination(url: string): PaginationParams {
  const { searchParams } = new URL(url)

  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT)), 1),
    MAX_LIMIT
  )

  const pageParam = parseInt(searchParams.get('page') || '0')
  const offsetParam = parseInt(searchParams.get('offset') || '0')

  let offset: number
  let page: number

  if (pageParam > 0) {
    // Page-based: page=2 with limit=20 → offset=20
    page = pageParam
    offset = (page - 1) * limit
  } else {
    // Offset-based: offset=40 with limit=20
    offset = Math.max(offsetParam, 0)
    page = Math.floor(offset / limit) + 1
  }

  return { limit, offset, page }
}

/**
 * Build a standardized paginated response
 */
export function paginateResponse<T>(
  data: T[],
  total: number | string,
  limit: number,
  offset: number
): PaginatedResponse<T> {
  const totalNum = typeof total === 'string' ? parseInt(total) : total
  const totalPages = Math.ceil(totalNum / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return {
    data,
    pagination: {
      total: totalNum,
      page: currentPage,
      limit,
      offset,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  }
}

/**
 * SQL LIMIT/OFFSET clause values for parameterized queries
 */
export function paginationSql(limit: number, offset: number): [number, number] {
  return [limit, offset]
}
