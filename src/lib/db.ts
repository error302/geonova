import { Pool, type PoolClient, type QueryResult } from 'pg'
import { env } from '@/lib/env'

let pool: Pool | null = null

function getPoolConfig() {
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  }

  if (env.DB_HOST && env.DB_NAME && env.DB_USER) {
    return {
      host: env.DB_HOST,
      port: env.DB_PORT ?? 5432,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }
  }

  throw new Error('Database connection is not configured. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER.')
}

function getPool() {
  if (!pool) {
    pool = new Pool(getPoolConfig())
  }

  return pool
}

export const db = {
  query: async (text: string, params?: unknown[]): Promise<QueryResult> => {
    const client = await getPool().connect()
    try {
      return await client.query(text, params)
    } finally {
      client.release()
    }
  },
  getClient: async (): Promise<PoolClient> => getPool().connect(),
}

export default db
