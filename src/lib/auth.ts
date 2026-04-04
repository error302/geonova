import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { env } from '@/lib/env'

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    if (env.DATABASE_URL) {
      pool = new Pool({ connectionString: env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 })
    } else if (env.DB_HOST && env.DB_NAME && env.DB_USER) {
      pool = new Pool({ host: env.DB_HOST, port: env.DB_PORT ?? 5432, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD, max: 5 })
    } else {
      throw new Error('Database not configured for auth')
    }
  }
  return pool
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          const p = getPool()
          const { rows } = await p.query(
            'SELECT id, email, password_hash, full_name FROM users WHERE email = $1 LIMIT 1',
            [credentials.email.toLowerCase().trim()]
          )

          if (rows.length === 0) return null

          const user = rows[0]
          const valid = await bcrypt.compare(credentials.password, user.password_hash)
          if (!valid) return null

          return {
            id: user.id,
            email: user.email,
            name: user.full_name || user.email.split('@')[0],
          }
        } catch (err) {
          console.error('[auth] Login DB error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: (() => {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!s) throw new Error('AUTH_SECRET is not set. Run: openssl rand -base64 32')
    return s
  })(),
}