/**
 * Legacy DB proxy client (browser-side).
 * Routes data queries through /api/db proxy → self-hosted PostgreSQL.
 * Mimics the shape of a Supabase-style client (.from().select().eq()) but does
 * NOT use Supabase — it posts the query to /api/db which talks to PostgreSQL.
 *
 * @deprecated Auth methods on this client are migration artifacts from Supabase.
 * Use `useSession()` from 'next-auth/react' for client components,
 * or `auth()` for server components instead.
 * DB methods (.from()) are actively used and safe.
 * Storage methods should use /api/storage endpoint instead.
 */
import { logger } from '@/lib/logger'

// ponytail: Phase 6 Batch 5 — auth/storage/rpc return types moved to `unknown`
// (deprecated stubs). FilterOp union, unknown params, typed catch applied.
// Generic default kept as `any` for backward compat with ~30 consumer files —
// consumer-side casts are the next wave.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueryResult<T = any> {
  data: T | null
  error: { message: string; code: string; details?: string } | null
  count?: number | null
}

// ponytail: minimal session shape returned by the deprecated auth.getSession() /
// auth.getUser() stubs. Exported so consumers can narrow the `unknown` return
// via `session as BrowserSession | null`. Real session access should go
// through `useSession()` (client) / `getServerSession()` (server).
/** Shape of the /api/auth/session JSON returned by the deprecated auth stubs. */
interface SessionPayload {
  user?: { id?: string; email?: string; name?: string } | null
}

export interface BrowserSession {
  user?: {
    id?: string
    email?: string
    name?: string
    user_metadata?: { full_name?: string }
  }
}

// ponytail: minimal channel surface returned by the deprecated channel() stub.
// Realtime is handled by @/lib/realtime; this exists only for legacy callers.
interface LegacyRealtimeChannel {
  on(...args: unknown[]): this
  subscribe(): this
  track(): Promise<void>
  untrack(): Promise<void>
  presenceState(): Record<string, unknown>
}

// ponytail: auth methods are deprecated migration artifacts; return types use
// `unknown` because consumers should not depend on their shape (use
// `useSession()` / `getServerSession()` instead).
export interface BrowserClient {
  from(table: string): ClientQueryBuilder
  auth: {
    getUser(): Promise<{ data: { user: { id: unknown; email: unknown; user_metadata: { full_name: unknown } } | null }; error: unknown }>
    getSession(): Promise<{ data: { session: BrowserSession | null }; error: unknown }>
    signUp(params: unknown): Promise<{ data: { user: unknown | null }; error: unknown }>
    signOut(): Promise<void>
    updateUser(params: unknown): Promise<{ data: { user: unknown | null }; error: unknown }>
    exchangeCodeForSession(code: string): Promise<{ data: { session: unknown | null }; error: unknown }>
    onAuthStateChange(callback: (event: string, session: unknown) => void): { data: { subscription: { unsubscribe(): void } } }
  }
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
  channel(name: string): LegacyRealtimeChannel
  removeChannel(channel: unknown): Promise<void>
}


// ponytail: explicit FilterOp union — was string + `as any` casts.
type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not' | 'contains'
type FilterEntry = { column: string; op: FilterOp; value: unknown }
type OrderEntry = { column: string; ascending: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ClientQueryBuilder<T = any> {
  private table: string
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private selectColumns: string = '*'
  private filters: FilterEntry[] = []
  private orFilterStr: string[] = []
  private orderClauses: OrderEntry[] = []
  private limitCount: number | null = null
  private offsetCount: number | null = null
  private singleRow: boolean = false
  private maybeSingleRow: boolean = false
  private countMode: boolean = false
  private headMode: boolean = false
  // ponytail: payload shapes are Record<string, unknown> (or array thereof for
  // bulk insert/upsert) — builder doesn't need to know column types
  private payload: Record<string, unknown> | Record<string, unknown>[] | null = null
  private onConflict: string | null = null

  constructor(table: string) {
    this.table = table
  }

  select(columns: string = '*', options?: { count?: string; head?: boolean }): this {
    this.operation = 'select'
    this.selectColumns = columns
    if (options?.count === 'exact') this.countMode = true
    if (options?.head) this.headMode = true
    return this
  }

  insert(data: Record<string, unknown> | Record<string, unknown>[]): this { this.operation = 'insert'; this.payload = data; return this }
  update(data: Record<string, unknown>): this { this.operation = 'update'; this.payload = data; return this }
  upsert(data: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): this {
    this.operation = 'upsert'
    this.payload = data
    // Forward the conflict target (e.g. 'project_id,row_index') to /api/db,
    // which validates each comma-separated column via validateIdentifier.
    if (options?.onConflict) this.onConflict = options.onConflict
    return this
  }
  delete(): this { this.operation = 'delete'; return this }

  eq(column: string, value: unknown): this { this.filters.push({ column, op: 'eq', value }); return this }
  neq(column: string, value: unknown): this { this.filters.push({ column, op: 'neq', value }); return this }
  gt(column: string, value: unknown): this { this.filters.push({ column, op: 'gt', value }); return this }
  gte(column: string, value: unknown): this { this.filters.push({ column, op: 'gte', value }); return this }
  lt(column: string, value: unknown): this { this.filters.push({ column, op: 'lt', value }); return this }
  lte(column: string, value: unknown): this { this.filters.push({ column, op: 'lte', value }); return this }
  like(column: string, pattern: string): this { this.filters.push({ column, op: 'like', value: pattern }); return this }
  ilike(column: string, pattern: string): this { this.filters.push({ column, op: 'ilike', value: pattern }); return this }
  in(column: string, values: unknown[]): this { this.filters.push({ column, op: 'in', value: values }); return this }
  is(column: string, value: unknown): this { this.filters.push({ column, op: 'is', value }); return this }
  not(column: string, op: string, value: unknown): this { this.filters.push({ column, op: `not_${op}` as FilterOp, value }); return this }
  or(filter: string): this { this.orFilterStr.push(filter); return this }
  contains(column: string, value: unknown): this { this.filters.push({ column, op: 'contains', value }); return this }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderClauses.push({ column, ascending: options?.ascending ?? true })
    return this
  }

  limit(count: number): this { this.limitCount = count; return this }

  range(from: number, to: number): this {
    this.offsetCount = from
    this.limitCount = to - from + 1
    return this
  }

  // ponytail: single()/maybeSingle() return `this` so chaining works, but also
  // need to be thenable. The `as unknown as` cast is the minimum needed —
  // the builder is thenable via the `then` method below.
  single(): PromiseLike<QueryResult<T>> & this {
    this.singleRow = true
    return this as unknown as PromiseLike<QueryResult<T>> & this
  }

  maybeSingle(): PromiseLike<QueryResult<T | null>> & this {
    this.maybeSingleRow = true
    return this as unknown as PromiseLike<QueryResult<T | null>> & this
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(resolve, reject)
  }

  private async execute(): Promise<QueryResult<T>> {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: this.table,
          operation: this.operation,
          columns: this.selectColumns,
          filters: this.filters,
          orFilters: this.orFilterStr,
          order: this.orderClauses,
          limit: this.limitCount,
          offset: this.offsetCount,
          single: this.singleRow,
          maybeSingle: this.maybeSingleRow,
          count: this.countMode,
          head: this.headMode,
          payload: this.payload,
          onConflict: this.onConflict ?? undefined,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
        return { data: null, error: { message: err.error || 'Query failed', code: String(res.status) } }
      }

      return await res.json() as QueryResult<T>
    } catch (err: unknown) {
      // ponytail: was `catch (err: unknown)` — now properly narrowed
      const fetchErr = err as { message?: string }
      return { data: null, error: { message: fetchErr.message || 'Network error', code: 'FETCH_ERROR' } }
    }
  }
}

export function createClient(): BrowserClient {
  return {
    from(table: string): ClientQueryBuilder {
      return new ClientQueryBuilder(table)
    },
    auth: {
      async getUser() {
        try {
          const res = await fetch('/api/auth/session')
          const session = (await res.json()) as SessionPayload | null
          if (session?.user) {
            return {
              data: {
                user: {
                  id: session.user.id,
                  email: session.user.email,
                  user_metadata: { full_name: session.user.name },
                },
              },
              error: null,
            }
          }
          return { data: { user: null }, error: null }
        } catch {
          return { data: { user: null }, error: { message: 'Session fetch failed' } }
        }
      },
      async getSession() {
        try {
          const res = await fetch('/api/auth/session')
          const session = (await res.json()) as SessionPayload | null
          if (session?.user) {
            return {
              data: {
                session: {
                  user: {
                    id: session.user.id,
                    email: session.user.email,
                    user_metadata: { full_name: session.user.name },
                  },
                },
              },
              error: null,
            }
          }
          return { data: { session: null }, error: null }
        } catch {
          return { data: { session: null }, error: { message: 'Session fetch failed' } }
        }
      },
      async signUp(_params: unknown) {
        return { data: { user: null }, error: { message: 'Use /api/auth/register instead' } }
      },
      async signOut() {
        try {
          await fetch('/api/auth/signout', { method: 'POST' })
        } catch {}
      },
      async updateUser(_params: unknown) {
        const params = _params as { password?: string } | undefined
        if (!params?.password) {
          return { data: { user: null }, error: { message: 'Only password updates are supported.' } }
        }
        try {
          const res = await fetch('/api/auth/update-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: params.password }),
          })
          const json = (await res.json().catch(() => ({}))) as { error?: string; user?: unknown | null }
          if (!res.ok) {
            return { data: { user: null }, error: { message: json.error || 'Password update failed' } }
          }
          return { data: { user: json.user ?? null }, error: null }
        } catch {
          return { data: { user: null }, error: { message: 'Password update failed' } }
        }
      },
      async exchangeCodeForSession(_code: string) {
        return { data: { session: null }, error: null }
      },
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        let lastSession: string | null = null
        const interval = setInterval(async () => {
          try {
            const res = await fetch('/api/auth/session')
            const session = (await res.json()) as SessionPayload | null
            const key = session?.user?.id || null
            if (key !== lastSession) {
              lastSession = key
              callback(key ? 'SIGNED_IN' : 'SIGNED_OUT', session?.user ? { user: session.user } : null)
            }
          } catch {}
        }, 30000)

        return {
          data: {
            subscription: {
              unsubscribe: () => clearInterval(interval),
            },
          },
        }
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
    // Storage stubs — use /api/storage endpoint (GCS-backed) instead
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
      logger.warn(`[db/client] rpc(${fn}) called but not implemented.`)
      return { data: null, error: { message: 'RPC not implemented' } }
    }
  }
}

export async function testConnection(): Promise<{ data: unknown; error: unknown }> {
  try {
    const client = createClient()
    const res = await client.from('projects').select('id').limit(1)
    return { data: res.data, error: res.error }
  } catch (err: unknown) {
    return { data: null, error: err }
  }
}
