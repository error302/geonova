/**
 * Server-side database client
 * Uses direct PostgreSQL via pg Pool.
 *
 * @deprecated Auth methods (.auth.getSession / .auth.getUser) are migration artifacts.
 * Use `auth()` or `requireAuth()` from `@/lib/auth/` instead.
 * DB methods (.from()) are actively used and safe.
 */

import { QueryBuilder } from '@/lib/db/queryBuilder'
import { getPool } from '@/lib/db'
import { auth } from '@/lib/auth-v5'
import { logger } from '@/lib/logger'

// ponytail: Phase 6 — auth/storage/rpc return types use `unknown` (deprecated stubs).
// from() returns QueryBuilder which defaults to Record<string, unknown> for type safety.
export interface DbClient {
  from(table: string): QueryBuilder
  auth: {
    getUser(): Promise<{ data: { user: { id?: unknown; email?: unknown; name?: unknown } | null }; error: { message: string } | null }>
    getSession(): Promise<{ data: { session: unknown | null }; error: { message: string } | null }>
    exchangeCodeForSession(code: string): Promise<{ data: { session: unknown | null }; error: null }>
  }
  channel(name: string): unknown
  removeChannel(channel: unknown): Promise<void>
  storage: {
    from(bucket: string): {
      upload(path: string, file: unknown, opts?: unknown): Promise<{ data: unknown; error: unknown }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: unknown }>
      download(path: string): Promise<{ data: unknown; error: unknown }>
      remove(paths: string[]): Promise<{ data: unknown; error: unknown }>
    }
  }
  rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>
}

export async function createClient(): Promise<DbClient> {
  const getCompatSession = async () => {
    const session = await auth()
    if (!session?.user?.email) return null
    return {
      ...session,
      user: {
        ...session.user,
        id: (session.user as { id?: string }).id ?? '',
        user_metadata: { full_name: session.user.name ?? '' },
      },
    }
  }

  return {
    from(table: string): QueryBuilder {
      return new QueryBuilder(getPool(), table)
    },
    auth: {
      async getUser() {
        const session = await getCompatSession()
        return { data: { user: session?.user ?? null }, error: null }
      },
      async getSession() {
        const session = await getCompatSession()
        return { data: { session }, error: null }
      },
      async exchangeCodeForSession(_code: string) {
        return { data: { session: null }, error: null }
      },
    },
    channel(_name: string) {
      return {
        on(..._args: unknown[]) { return this },
        subscribe() { return this },
        track() { return Promise.resolve() },
        untrack() { return Promise.resolve() },
        presenceState() { return {} },
      }
    },
    async removeChannel(_channel: unknown) {},
    storage: {
      from(_bucket: string) {
        return {
          upload: async () => ({ data: null, error: { message: 'Use /api/storage endpoint (GCS-backed) instead.' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' }, error: { message: 'Use /api/storage endpoint (GCS-backed) instead.' } }),
          createSignedUrl: async () => ({ data: null, error: { message: 'Use /api/storage endpoint (GCS-backed) instead.' } }),
          download: async () => ({ data: null, error: { message: 'Use /api/storage endpoint (GCS-backed) instead.' } }),
          remove: async () => ({ data: null, error: { message: 'Use /api/storage endpoint (GCS-backed) instead.' } }),
        }
      }
    },
    rpc: async (fn: string, _args?: Record<string, unknown>) => {
      logger.warn(`[db/server] rpc(${fn}) called but not implemented.`)
      return { data: null, error: { message: 'RPC not implemented' } }
    }
  }
}
