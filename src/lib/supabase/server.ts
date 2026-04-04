/**
 * Server-side Supabase-compatible client
 * Uses direct PostgreSQL via pg Pool instead of Supabase cloud.
 * 
 * Drop-in replacement: `import { createClient } from '@/lib/supabase/server'`
 * still works, but queries go to VM PostgreSQL instead of Supabase.
 */

import { Pool } from 'pg'
import { QueryBuilder } from '@/lib/db/queryBuilder'
import { env } from '@/lib/env'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    const connectionString = env.DATABASE_URL
    if (!connectionString) {
      // Fallback to individual params
      if (env.DB_HOST && env.DB_NAME && env.DB_USER) {
        pool = new Pool({
          host: env.DB_HOST,
          port: env.DB_PORT ?? 5432,
          database: env.DB_NAME,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        })
      } else {
        throw new Error('Database not configured. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER in env.')
      }
    } else {
      pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      })
    }
  }
  return pool
}

export interface CompatClient {
  from(table: string): QueryBuilder
  auth: {
    getUser(): Promise<{ data: { user: any | null }; error: { message: string } | null }>
    getSession(): Promise<{ data: { session: any | null }; error: { message: string } | null }>
    updateUser(_params: any): Promise<{ data: { user: any | null }; error: { message: string } | null }>
    exchangeCodeForSession(_code: string): Promise<{ data: { session: any | null }; error: { message: string } | null }>
  }
  channel(name: string): any
  removeChannel(channel: any): Promise<void>
  storage: {
    from(bucket: string): {
      upload(path: string, file: any, opts?: any): Promise<{ data: any; error: any }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
      download(path: string): Promise<{ data: any; error: any }>
      remove(paths: string[]): Promise<{ data: any; error: any }>
    }
  }
  rpc(fn: string, args?: any): Promise<{ data: any; error: any }>
}

export async function createClient(): Promise<CompatClient> {
  const p = getPool()

  const getCompatSession = async () => {
    const session = await getServerSession(authOptions)
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
      return new QueryBuilder(p, table)
    },
    // Auth stubs — all auth goes through NextAuth now
    auth: {
      async getUser() {
        const session = await getCompatSession()
        return { data: { user: session?.user ?? null }, error: null }
      },
      async getSession() {
        const session = await getCompatSession()
        return { data: { session }, error: null }
      },
      async updateUser(_params: any) {
        return { data: { user: null }, error: { message: 'Use custom API endpoint to update user.' } }
      },
      async exchangeCodeForSession(_code: string) {
        return { data: { session: null }, error: null }
      },
    },
    // Realtime stubs
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
          upload: async () => ({ data: null, error: { message: 'Storage not migrated to VM yet.' } }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `/uploads/${bucket}/${path}` } }),
          download: async () => ({ data: null, error: { message: 'Storage not migrated.' } }),
          remove: async () => ({ data: null, error: null }),
        }
      }
    },
    rpc: async (fn: string, args?: any) => {
      console.warn(`[supabase/server] rpc(${fn}) called but not implemented.`)
      return { data: null, error: { message: 'RPC not implemented on VM' } }
    }
  }
}
