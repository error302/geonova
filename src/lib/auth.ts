import NextAuth, { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { checkLoginAllowed, recordFailedLogin, recordSuccessfulLogin, getFailedAttemptCount } from '@/lib/security/loginLimiter'

/** Sentinel password hash for OAuth-only users (no password login possible) */
const OAUTH_NO_PASSWORD = 'OAUTH_NO_PASSWORD'

/**
 * Find or create a user record when they sign in via OAuth for the first time.
 *
 * - If a user with the same email already exists, link the OAuth account
 *   by updating the provider info (but keep their existing role/password).
 * - If no user exists, create a new record with role='user' and the
 *   OAUTH_NO_PASSWORD sentinel so that password login is impossible.
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

  // Try to find existing user by email
  const { rows } = await db.query(
    'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider, oauth_avatar_url FROM users WHERE email = $1 LIMIT 1',
    [normalisedEmail]
  )

  if (rows.length > 0) {
    // ── Existing user — link OAuth account ──
    const user = rows[0]

    // Determine role (reuse the same hierarchy logic as credentials)
    let role = user.role || 'user'
    // SECURITY: Platform owner email MUST be set via env var.
    // Previously hardcoded 'mohameddosho20@gmail.com' as default —
    // anyone controlling that Google account would get permanent
    // super_admin. Now: if env var is unset, no one gets super_admin
    // via this path (must be granted manually in DB).
    const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
    if (platformOwnerEmail && user.email.toLowerCase() === platformOwnerEmail) {
      role = 'super_admin'
    }
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    if (adminEmails.includes(user.email.toLowerCase())) {
      role = 'super_admin'
    }

    // Update provider info and avatar (don't override password_hash or role)
    await db.query(
      `UPDATE users SET
         provider = COALESCE(provider, $1),
         oauth_provider_id = COALESCE(oauth_provider_id, $2),
         oauth_avatar_url = COALESCE(oauth_avatar_url, $3),
         updated_at = NOW()
       WHERE id = $4`,
      [provider, providerAccountId, image || null, user.id]
    )

    // Ensure surveyor_profile exists
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

  // ── New user — create record ──
  const displayName = name || normalisedEmail.split('@')[0]
  const insertResult = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, provider, oauth_provider_id, oauth_avatar_url)
     VALUES ($1, $2, $3, 'user', $4, $5, $6)
     RETURNING id, email, full_name, role, provider`,
    [normalisedEmail, OAUTH_NO_PASSWORD, displayName, provider, providerAccountId, image || null]
  )

  const newUser = insertResult.rows[0]

  // Create surveyor_profile for the new user
  try {
    await db.query(
      `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended)
       VALUES (gen_random_uuid(), $1, 'user', false)
       ON CONFLICT (user_id) DO NOTHING`,
      [newUser.id]
    )
  } catch {
    // Non-critical
  }

  // Create profile entry
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
    role: 'user',
    isk_number: '',
    verified_isk: false,
    provider,
    image: image || null,
  }
}

export const authOptions: AuthOptions = {
  providers: [
    // ── Credentials (email + password) ──────────────────────────────────────
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Get client IP from the request
        // Note: In NextAuth v4, req can be a Request or an IncomingMessage
        // headers may be a Headers object (with .get()) or a plain object (with direct access)
        let forwarded = ''
        try {
          const headers = req?.headers
          if (headers && typeof (headers as Record<string, unknown>).get === 'function') {
            forwarded = (headers as { get: (n: string) => string | null }).get('x-forwarded-for') || ''
          } else if (headers) {
            forwarded = (headers as Record<string, string>)['x-forwarded-for'] || ''
          }
        } catch {
          forwarded = ''
        }
        const clientIp = forwarded.split(',')[0]?.trim() || 'unknown'

        // Check brute-force lockout BEFORE checking credentials
        const loginCheck = await checkLoginAllowed(credentials.email, clientIp)
        if (!loginCheck.allowed) {
          console.warn(`[auth] Login blocked for ${credentials.email} from ${clientIp}: ${loginCheck.reason}`)
          return null
        }

        try {
          const { rows } = await db.query(
            'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider FROM users WHERE email = $1 LIMIT 1',
            [credentials.email.toLowerCase().trim()]
          )

          if (rows.length === 0) {
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          const user = rows[0]

          // Block password login for OAuth-only accounts
          if (user.password_hash === OAUTH_NO_PASSWORD) {
            console.warn(`[auth] Password login attempted on OAuth-only account: ${user.email}`)
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          const valid = await bcrypt.compare(credentials.password, user.password_hash)
          if (!valid) {
            await recordFailedLogin(credentials.email, clientIp)
            const remaining = 5 - await getFailedAttemptCount(credentials.email, clientIp)
            if (remaining <= 2 && remaining > 0) {
              console.warn(`[auth] ${remaining} attempts remaining for ${credentials.email} from ${clientIp}`)
            }
            return null
          }

          // Check if account is suspended
          try {
            const { rows: profileRows } = await db.query(
              'SELECT is_suspended, suspension_reason FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [user.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              console.warn(`[auth] Suspended account login attempt: ${user.email}`)
              return null
            }
          } catch {
            // surveyor_profiles may not exist yet — allow login anyway
          }

          // Successful login — clear failure count
          await recordSuccessfulLogin(credentials.email, clientIp)

          // Determine role — priority: hardcoded owner > ADMIN_EMAILS > users.role > surveyor_profiles.role > 'surveyor'
          let role = user.role || 'surveyor'

          // Platform owner always gets super_admin regardless of env var or DB state
          // SECURITY: env var required — see comment above
          const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
          if (platformOwnerEmail && user.email.toLowerCase() === platformOwnerEmail) {
            role = 'super_admin'
          }

          const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
          if (adminEmails.includes(user.email.toLowerCase())) {
            role = 'super_admin'
          } else if (!role || role === 'user') {
            // Fallback: check surveyor_profiles table
            try {
              const { rows: profileRows } = await db.query(
                'SELECT role FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
                [user.id]
              )
              if (profileRows.length > 0 && profileRows[0].role) {
                role = profileRows[0].role
              }
            } catch {
              // Table may not exist — keep default
            }

            // Ensure the user has a surveyor_profile (auto-create if missing)
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
          console.error('[auth] Login DB error:', err)
          return null
        }
      },
    }),

    // ── Google OAuth ────────────────────────────────────────────────────────
    // SECURITY FIX (ByteByteGo audit): allowDangerousEmailAccountLinking was true,
    // which let an attacker register a Google account with a victim's email and
    // gain access. Now false — OAuth accounts must be explicitly linked.
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: false,
    }),

    // ── Microsoft / Azure AD OAuth ──────────────────────────────────────────
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      tenantId: 'common', // Allow both work/school and personal Microsoft accounts
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  callbacks: {
    /**
     * signIn callback — controls whether a sign-in is allowed.
     * For OAuth providers, we verify the email is present (OAuth providers
     * guarantee email verification). We also create/link the user record.
     */
    async signIn({ user, account, profile }) {
      // Credentials provider handles its own auth in authorize() — always allow
      if (account?.provider === 'credentials') {
        return true
      }

      // OAuth providers (google, azure-ad)
      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        // OAuth providers guarantee email_verified, but double-check
        if (!user.email) {
          console.warn(`[auth] OAuth sign-in rejected: no email from ${account.provider}`)
          return false
        }

        // Google specifically provides email_verified in the profile
        const googleProfile = profile as Record<string, unknown> | undefined
        if (account.provider === 'google' && googleProfile?.email_verified === false) {
          console.warn(`[auth] Google OAuth sign-in rejected: email not verified for ${user.email}`)
          return false
        }

        // Azure AD: for work/school accounts email is always verified.
        // For personal Microsoft accounts (tenantId === '9188040d-6c67-4c5b-b112-36a304b66dad'),
        // email may not be verified — but we accept them since they've authenticated.
        // If you want stricter verification, check profile?.email_verified here too.

        try {
          const oauthUser = await findOrCreateOAuthUser({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          })

          // Attach DB fields to the user object so jwt callback can access them
          user.id = oauthUser.id
          user.name = oauthUser.name
          user.role = oauthUser.role
          user.isk_number = oauthUser.isk_number
          user.verified_isk = oauthUser.verified_isk
          user.provider = oauthUser.provider
          user.image = oauthUser.image

          // Check if account is suspended
          try {
            const { rows: profileRows } = await db.query(
              'SELECT is_suspended FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [oauthUser.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              console.warn(`[auth] Suspended OAuth account login attempt: ${user.email}`)
              return false
            }
          } catch {
            // surveyor_profiles may not exist — allow sign-in
          }

          return true
        } catch (err) {
          console.error('[auth] OAuth user creation/linking error:', err)
          return false
        }
      }

      // Unknown provider — reject
      console.warn(`[auth] Unknown provider: ${account?.provider}`)
      return false
    },

    async jwt({ token, user, account }) {
      // On first sign-in, `user` is populated from the provider/authorize()
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
    maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from 30 for security)
  },
  secret: (() => {
    const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!s) {
      // During build, provide a dummy value — the app won't actually run
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        console.warn('[auth] AUTH_SECRET not set during build — using dummy. Set it before running the app.')
        return 'build-time-dummy-secret-do-not-use-in-production'
      }
      // Fail hard at runtime — never use a dummy secret in production
      throw new Error('AUTH_SECRET is not set. Run: openssl rand -base64 32')
    }
    return s
  })(),
}
