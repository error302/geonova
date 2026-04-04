/**
 * Client-side Supabase-compatible client
 * Routes data queries through /api/db proxy → VM PostgreSQL.
 * Auth is handled by NextAuth (useSession / getSession).
 */

interface QueryResult<T = any> {
  data: T | null
  error: { message: string; code: string; details?: string } | null
  count?: number | null
}

// Explicit public interface — fixes TS2339 on .storage and .rpc callers
export interface BrowserClient {
  from(table: string): ClientQueryBuilder
  auth: {
    getUser(): Promise<{ data: { user: { id: any; email: any; user_metadata: { full_name: any } } | null }; error: any }>
    getSession(): Promise<{ data: { session: any | null }; error: any }>
    signUp(params: any): Promise<{ data: { user: any | null }; error: any }>
    signOut(): Promise<void>
    updateUser(params: any): Promise<{ data: { user: any | null }; error: any }>
    exchangeCodeForSession(code: string): Promise<{ data: { session: any | null }; error: any }>
    onAuthStateChange(callback: (event: string, session: any) => void): { data: { subscription: { unsubscribe(): void } } }
  }
  storage: {
    from(bucket: string): {
      upload(path: string, file: any, opts?: any): Promise<{ data: any; error: any }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
      createSignedUrl(path: string, expiresIn: number): Promise<{ data: { signedUrl: string } | null; error: any }>
      download(path: string): Promise<{ data: any; error: any }>
      remove(paths: string[]): Promise<{ data: any; error: any }>
    }
  }
  rpc(fn: string, args?: any): Promise<{ data: any; error: any }>
  channel(name: string): any
  removeChannel(channel: any): Promise<void>
}


type FilterEntry = { column: string; op: string; value: any }
type OrderEntry = { column: string; ascending: boolean }

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
  private payload: any = null

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

  insert(data: any): this { this.operation = 'insert'; this.payload = data; return this }
  update(data: any): this { this.operation = 'update'; this.payload = data; return this }
  upsert(data: any, _options?: any): this { this.operation = 'upsert'; this.payload = data; return this }
  delete(): this { this.operation = 'delete'; return this }

  eq(column: string, value: any): this { this.filters.push({ column, op: 'eq', value }); return this }
  neq(column: string, value: any): this { this.filters.push({ column, op: 'neq', value }); return this }
  gt(column: string, value: any): this { this.filters.push({ column, op: 'gt', value }); return this }
  gte(column: string, value: any): this { this.filters.push({ column, op: 'gte', value }); return this }
  lt(column: string, value: any): this { this.filters.push({ column, op: 'lt', value }); return this }
  lte(column: string, value: any): this { this.filters.push({ column, op: 'lte', value }); return this }
  like(column: string, pattern: string): this { this.filters.push({ column, op: 'like', value: pattern }); return this }
  ilike(column: string, pattern: string): this { this.filters.push({ column, op: 'ilike', value: pattern }); return this }
  in(column: string, values: any[]): this { this.filters.push({ column, op: 'in', value: values }); return this }
  is(column: string, value: any): this { this.filters.push({ column, op: 'is', value }); return this }
  not(column: string, op: string, value: any): this { this.filters.push({ column, op: `not_${op}`, value }); return this }
  or(filter: string): this { this.orFilterStr.push(filter); return this }
  contains(column: string, value: any): this { this.filters.push({ column, op: 'contains', value }); return this }

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

  single(): PromiseLike<QueryResult<T>> & this {
    this.singleRow = true
    return this as any
  }

  maybeSingle(): PromiseLike<QueryResult<T | null>> & this {
    this.maybeSingleRow = true
    return this as any
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    resolve?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
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
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        return { data: null, error: { message: err.error || 'Query failed', code: String(res.status) } }
      }

      return await res.json()
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Network error', code: 'FETCH_ERROR' } }
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
        // Fetch from NextAuth session endpoint instead
        try {
          const res = await fetch('/api/auth/session')
          const session = await res.json()
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
          const session = await res.json()
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
      async signUp(_params: any) {
        return { data: { user: null }, error: { message: 'Use /api/auth/register instead' } }
      },
      async signOut() {
        // NextAuth sign out
        try {
          await fetch('/api/auth/signout', { method: 'POST' })
        } catch {}
      },
      async updateUser(_params: any) {
        return { data: { user: null }, error: { message: 'Use custom API endpoint to update user.' } }
      },
      async exchangeCodeForSession(_code: string) {
        return { data: { session: null }, error: null }
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        // Poll session every 30s for changes
        let lastSession: string | null = null
        const interval = setInterval(async () => {
          try {
            const res = await fetch('/api/auth/session')
            const session = await res.json()
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
        on(..._args: any[]) { return this },
        subscribe() { return this },
        track() { return Promise.resolve() },
        untrack() { return Promise.resolve() },
        presenceState() { return {} },
      }
    },
    async removeChannel(_channel: any) {},
    storage: {
      from(bucket: string) {
        return {
          upload: async (path: string, file: any) => {
            try {
              const formData = new FormData()
              formData.append('file', file)
              formData.append('bucket', bucket)
              formData.append('path', path)
              
              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
              })
              
              if (!res.ok) throw new Error('Upload failed')
              const json = await res.json()
              return { data: { path: json.path }, error: null }
            } catch (err: any) {
              return { data: null, error: { message: err.message || 'Local upload failed' } }
            }
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `/uploads/${bucket}/${path}` } }),
          createSignedUrl: async (path: string, expiresIn: number) => ({ data: { signedUrl: `/uploads/${bucket}/${path}` }, error: null }),
          download: async () => ({ data: null, error: { message: 'Storage not fully migrated.' } }),
          remove: async () => ({ data: null, error: null }),
        }
      }
    },
    rpc: async (fn: string, args?: any) => {
      console.warn(`[supabase/client] rpc(${fn}) called but not implemented.`)
      return { data: null, error: { message: 'RPC not implemented on VM' } }
    }
  }
}

export async function testConnection() {
  try {
    const client = createClient()
    const { data, error } = await client.from('projects').select('id').limit(1)
    return { data, error }
  } catch (err: any) {
    return { data: null, error: err }
  }
}
