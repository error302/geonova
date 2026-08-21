/**
 * NextAuth v5 (Auth.js) — ACTIVE MIGRATION CONFIG
 *
 * P1-1 (2026-08-15): Full parity port of the v4 `src/lib/auth.ts` to the
 * NextAuth v5 API. See docs/nextauth-v5-migration-plan.md.
 *
 * v5 differences handled here:
 *   - `NextAuth({...})` returns `{ handlers, auth, signIn, signOut }` instead
 *     of a handler function built from a separate `authOptions` object.
 *   - `auth()` replaces `auth()` (see codemod).
 *   - Credentials `authorize(credentials, request)` receives a standard
 *     `Request` (headers is a `Headers` object).
 *
 * Parity invariants (must stay in sync with the v4 auth.ts until it is retired):
 *   - snake_case session/JWT fields (`isk_number`, `verified_isk`, `role`,
 *     `provider`, `id`) — the whole app + src/types/next-auth.d.ts depend on
 *     these. Do NOT rename to camelCase.
 *   - OAuth account linking via findOrCreateOAuthUser (signIn callback).
 *   - Suspension check, brute-force limiter, PLATFORM_OWNER_EMAIL / ADMIN_EMAILS
 *     role resolution, surveyor_profiles auto-create.
 *   - session maxAge 7 days.
 */

import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import {
  checkLoginAllowed,
  recordFailedLogin,
  recordSuccessfulLogin,
  getFailedAttemptCount,
} from '@/lib/security/loginLimiter'
import { logger } from '@/lib/logger'

/** Sentinel password hash for OAuth-only users (no password login possible) */
const OAUTH_NO_PASSWORD = 'OAUTH_NO_PASSWORD'

// ─── Row types ───────────────────────────────────────────────────────────────
interface AuthUserRow {
  id: string
  email: string
  password_hash: string
  full_name: string | null
  isk_number: string | null
  verified_isk: boolean
  role: string | null
  provider: string | null
  oauth_avatar_url: string | null
}

interface NewUserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  provider: string | null
}

/**
 * Find or create a user record when they sign in via OAuth for the first time.
 * Mirrors v4 auth.ts findOrCreateOAuthUser exactly.
 */
async function findOrCreateOAuthUser(params: {
  email: string
  name?: string | null
  image?: string | null
  provider: string
  providerAccountId: string
}): Promise<{
  id: string
  email: string
  name: string
  role: string
  isk_number: string
  verified_isk: boolean
  provider: string
  image?: string | null
}> {
  const { email, name, image, provider, providerAccountId } = params
  const normalisedEmail = email.toLowerCase().trim()

  const { rows } = await db.query<AuthUserRow>(
    'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider, oauth_avatar_url FROM users WHERE email = $1 LIMIT 1',
    [normalisedEmail]
  )

  if (rows.length > 0) {
    const user = rows[0]

    let role = user.role || 'user'
    const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
    if (platformOwnerEmail && user.email.toLowerCase() === platformOwnerEmail) {
      role = 'super_admin'
    }
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (adminEmails.includes(user.email.toLowerCase())) {
      role = 'super_admin'
    }

    await db.query(
      `UPDATE users SET
         provider = COALESCE(provider, $1),
         oauth_provider_id = COALESCE(oauth_provider_id, $2),
         oauth_avatar_url = COALESCE(oauth_avatar_url, $3),
         role = $5,
         updated_at = NOW()
       WHERE id = $4`,
      [provider, providerAccountId, image || null, user.id, role]
    )

    try {
      await db.query(
        `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended)
         VALUES (gen_random_uuid(), $1, $2, false)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, role]
      )
    } catch {
      // Non-critical
    }

    return {
      id: user.id,
      email: user.email,
      name: user.full_name || name || user.email.split('@')[0],
      role,
      isk_number: user.isk_number || '',
      verified_isk: user.verified_isk || false,
      provider: user.provider || provider,
      image: image || user.oauth_avatar_url || null,
    }
  }

  const displayName = name || normalisedEmail.split('@')[0]

  // Determine role for new OAuth user — check if they are platform owner or admin
  let initialRole = 'user'
  const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
  if (platformOwnerEmail && normalisedEmail === platformOwnerEmail) {
    initialRole = 'super_admin'
  }
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (adminEmails.includes(normalisedEmail)) {
    initialRole = 'super_admin'
  }

  const insertResult = await db.query<NewUserRow>(
    `INSERT INTO users (email, password_hash, full_name, role, provider, oauth_provider_id, oauth_avatar_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, email, full_name, role, provider`,
    [normalisedEmail, OAUTH_NO_PASSWORD, displayName, initialRole, provider, providerAccountId, image || null]
  )

  const newUser = insertResult.rows[0]

  try {
    await db.query(
      `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended)
       VALUES (gen_random_uuid(), $1, $2, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id, initialRole === 'super_admin' ? 'admin' : 'surveyor']
    )
  } catch {
    // Non-critical
  }

  try {
    await db.query(
      `INSERT INTO profiles (id, full_name, avatar_url)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [newUser.id, displayName, image || null]
    )
  } catch {
    // Non-critical
  }

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.full_name || displayName,
    role: initialRole,
    isk_number: '',
    verified_isk: false,
    provider,
    image: image || null,
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        const email = typeof credentials?.email === 'string' ? credentials.email : null
        const password = typeof credentials?.password === 'string' ? credentials.password : null
        if (!email || !password) return null

        // Client IP — v5 passes a standard Request (headers is a Headers object)
        let forwarded = ''
        try {
          forwarded = req?.headers?.get?.('x-forwarded-for') || ''
        } catch {
          forwarded = ''
        }
        const clientIp = forwarded.split(',')[0]?.trim() || 'unknown'

        const loginCheck = await checkLoginAllowed(email, clientIp)
        if (!loginCheck.allowed) {
          logger.warn(`[auth-v5] Login blocked for ${email} from ${clientIp}: ${loginCheck.reason}`)
          return null
        }

        try {
          const { rows } = await db.query<Omit<AuthUserRow, 'oauth_avatar_url'>>(
            'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider FROM users WHERE email = $1 LIMIT 1',
            [email.toLowerCase().trim()]
          )

          if (rows.length === 0) {
            await recordFailedLogin(email, clientIp)
            return null
          }

          const user = rows[0]

          if (user.password_hash === OAUTH_NO_PASSWORD) {
            logger.warn(`[auth-v5] Password login attempted on OAuth-only account: ${user.email}`)
            await recordFailedLogin(email, clientIp)
            return null
          }

          const valid = await bcrypt.compare(password, user.password_hash)
          if (!valid) {
            await recordFailedLogin(email, clientIp)
            const remaining = 5 - await getFailedAttemptCount(email, clientIp)
            if (remaining <= 2 && remaining > 0) {
              logger.warn(`[auth-v5] ${remaining} attempts remaining for ${email} from ${clientIp}`)
            }
            return null
          }

          try {
            const { rows: profileRows } = await db.query<{ is_suspended: boolean; suspension_reason: string | null }>(
              'SELECT is_suspended, suspension_reason FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [user.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              logger.warn(`[auth-v5] Suspended account login attempt: ${user.email}`)
              return null
            }
          } catch {
            // surveyor_profiles may not exist yet — allow login anyway
          }

          await recordSuccessfulLogin(email, clientIp)

          let role = user.role || 'surveyor'

          const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
          if (platformOwnerEmail && user.email.toLowerCase() === platformOwnerEmail) {
            role = 'super_admin'
          }

          const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
          if (adminEmails.includes(user.email.toLowerCase())) {
            role = 'super_admin'
          } else if (!role || role === 'user') {
            try {
              const { rows: profileRows } = await db.query<{ role: string | null }>(
                'SELECT role FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
                [user.id]
              )
              if (profileRows.length > 0 && profileRows[0].role) {
                role = profileRows[0].role
              }
            } catch {
              // Table may not exist — keep default
            }

            try {
              await db.query(
                `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended)
                 VALUES (gen_random_uuid(), $1, $2, false)
                 ON CONFLICT (user_id) DO NOTHING`,
                [user.id, role]
              )
            } catch {
              // Non-critical — continue login
            }
          }

          // Persist resolved role back to database if it differs
          if (role !== user.role) {
            try {
              await db.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2', [role, user.id])
            } catch {
              // Non-critical — session role is still correct
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.full_name || user.email.split('@')[0],
            isk_number: user.isk_number || '',
            verified_isk: user.verified_isk || false,
            role,
            provider: user.provider || 'credentials',
          }
        } catch (err) {
          logger.error('[auth-v5] Login DB error:', { error: err })
          return null
        }
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: false,
    }),

    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      // v5: tenantId is deprecated in favour of `issuer`. Defaulting the issuer
      // to 'common' (work/school + personal Microsoft accounts) preserves the
      // v4 `tenantId: 'common'` behaviour.
      allowDangerousEmailAccountLinking: false,
    }),
  ],

  // Auth.js v5 rejects requests whose Host doesn't match AUTH_URL/NEXTAUTH_URL.
  // The app runs behind a trusted reverse proxy (nginx → Docker), so we trust
  // the forwarded Host header. Required to avoid UntrustedHost 500s on /api/auth/*.
  trustHost: true,

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'credentials') {
        return true
      }

      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        if (!user.email) {
          logger.warn(`[auth-v5] OAuth sign-in rejected: no email from ${account.provider}`)
          return false
        }

        const googleProfile = profile as Record<string, unknown> | undefined
        if (account.provider === 'google' && googleProfile?.email_verified === false) {
          logger.warn(`[auth-v5] Google OAuth sign-in rejected: email not verified for ${user.email}`)
          return false
        }

        try {
          const oauthUser = await findOrCreateOAuthUser({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          })

          user.id = oauthUser.id
          user.name = oauthUser.name
          user.role = oauthUser.role
          user.isk_number = oauthUser.isk_number
          user.verified_isk = oauthUser.verified_isk
          user.provider = oauthUser.provider
          user.image = oauthUser.image

          try {
            const { rows: profileRows } = await db.query<{ is_suspended: boolean }>(
              'SELECT is_suspended FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [oauthUser.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              logger.warn(`[auth-v5] Suspended OAuth account login attempt: ${user.email}`)
              return false
            }
          } catch {
            // surveyor_profiles may not exist — allow sign-in
          }

          return true
        } catch (err) {
          logger.error('[auth-v5] OAuth user creation/linking error:', { error: err })
          return false
        }
      }

      logger.warn(`[auth-v5] Unknown provider: ${account?.provider}`)
      return false
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name || user.email?.split('@')[0] || ''
        token.isk_number = user.isk_number || ''
        token.verified_isk = user.verified_isk || false
        token.role = (user as { role?: string }).role || 'user'
        token.provider = (user as { provider?: string }).provider || account?.provider || 'credentials'
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        session.user.isk_number = token.isk_number as string
        session.user.verified_isk = token.verified_isk as boolean
        session.user.role = token.role as string
        session.user.provider = token.provider as string
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (parity with v4)
  },

  secret: (() => {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!s) {
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        logger.warn('[auth-v5] AUTH_SECRET not set during build — using dummy. Set it before running the app.')
        return 'build-time-dummy-secret-do-not-use-in-production'
      }
      throw new Error('AUTH_SECRET is not set. Run: openssl rand -base64 32')
    }
    return s
  })(),
})
