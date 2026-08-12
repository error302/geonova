import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiError } from './fetcher'

// ── Types inferred from API responses ──────────────────────────────────

export interface AuditEvent {
  id: string
  table_name: string
  row_id: string
  user_id: string
  user_email?: string | null
  action: string
  summary?: string | null
  prev_hash: string
  hash: string
  created_at: string
  payload?: Record<string, unknown> | null
}

interface AuditEventsResponse {
  events: AuditEvent[]
  count: number
}

export interface VerifyPayload {
  row_id: string
  table_name: 'project_fieldbook_entries' | 'survey_points'
}

interface VerifyValidResponse {
  valid: true
  events: number
  last_hash: string
  last_action: string
}

interface VerifyInvalidResponse {
  valid: false
  broken_at: string
  broken_at_action: string
  expected_prev: string
  actual_prev: string
  events: number
}

interface VerifyEmptyResponse {
  valid: true
  events: 0
  message: string
}

export type VerifyResponse =
  | VerifyValidResponse
  | VerifyInvalidResponse
  | VerifyEmptyResponse

// ── Cache keys ─────────────────────────────────────────────────────────

export const auditKeys = {
  all: ['audit'] as const,
  byProject: (projectId: string) => [...auditKeys.all, projectId] as const,
  events: (projectId: string, limit?: number) =>
    [...auditKeys.byProject(projectId), 'events', limit] as const,
  verify: () => [...auditKeys.all, 'verify'] as const,
}

// ── Default stale time for audit queries ───────────────────────────────

const AUDIT_STALE_TIME = 2 * 60 * 1000 // 2 minutes

// ── Hooks ──────────────────────────────────────────────────────────────

/**
 * Fetch audit events for a given project.
 * Uses refetchOnWindowFocus: false — audit data is append-only
 * and does not change retroactively.
 */
export function useAuditEvents(
  projectId: string | undefined,
  options?: { limit?: number; enabled?: boolean }
) {
  const limit = options?.limit ?? 100
  const enabled = options?.enabled !== false && !!projectId

  const query = useQuery<AuditEventsResponse, ApiError>({
    queryKey: auditKeys.events(projectId ?? '', limit),
    queryFn: () => {
      const params = new URLSearchParams({ project_id: projectId ?? '', limit: String(limit) })
      return apiFetch<AuditEventsResponse>(`/api/fieldbook/audit?${params.toString()}`)
    },
    enabled,
    staleTime: AUDIT_STALE_TIME,
    refetchOnWindowFocus: false,
  })

  return {
    events: query.data?.events ?? [],
    count: query.data?.count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
  }
}

/**
 * Verify the integrity of the audit hash chain for a specific row.
 */
export function useVerifyAuditChain() {
  const queryClient = useQueryClient()

  return useMutation<VerifyResponse, ApiError, VerifyPayload>({
    mutationFn: (payload) =>
      apiFetch<VerifyResponse>('/api/fieldbook/audit/verify', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    onSuccess: () => {
      // Invalidate audit caches so the UI reflects any updated state
      queryClient.invalidateQueries({ queryKey: auditKeys.all })
    },
  })
}
