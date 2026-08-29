import { AuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import AzureADProvider from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { checkLoginAllowed, recordFailedLogin, recordSuccessfulLogin, getFailedAttemptCount } from '@/lib/security/loginLimiter'
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
  email_verified: boolean | null
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
 *
 * - If a user with the same email already exists, link the OAuth account
 *   by updating the provider info (but keep their existing role/password).
 * - If no user exists, create a new record with role='user' and the
 *   OAUTH_NO_PASSWORD sentinel so that password login is impossible.
 *
 * SECURITY (audit C-06, 2026-08-30): OAuth identity linking no longer trusts a
 * bare email match. Linking into a pre-existing PASSWORD account additionally
 * requires (a) the OAuth provider to have verified the email AND (b) the
 * pre-existing account to be already email-verified (or itself OAuth-created).
 * This kills the classic pre-hijacking chain: attacker registers a victim's
 * email with a password, victim later signs in with Google, and their OAuth
 * identity is silently welded onto the attacker's account. New OAuth accounts
 * are marked email_verified only when the provider actually verified it.
 */
async function findOrCreateOAuthUser(params: {
  email: string
  name?: string | null
  image?: string | null
  provider: string
  providerAccountId: string
  emailVerified: boolean
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
  const { email, name, image, provider, providerAccountId, emailVerified } = params
  const normalisedEmail = email.toLowerCase().trim()

  // Try to find existing user by email
  const { rows } = await db.query<AuthUserRow>(
    'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider, oauth_avatar_url, email_verified FROM users WHERE email = $1 LIMIT 1',
    [normalisedEmail]
  )

  if (rows.length > 0) {
    // ── Existing user — link OAuth account ──
    const user = rows[0]

    // SECURITY (audit C-06): refuse to weld an OAuth identity onto a password
    // account that has not proven ownership of the address. Existing accounts
    // created before migration 056 are grandfathered as email_verified.
    const isOAuthOnlyAccount = user.password_hash === OAUTH_NO_PASSWORD
    const accountEmailVerified = user.email_verified === true
    if (!isOAuthOnlyAccount && !accountEmailVerified) {
      logger.warn(
        `[auth] Refusing OAuth link onto unverified password account: ${normalisedEmail} via ${provider}`
      )
      throw new Error(
        'This email address belongs to an existing password account whose ownership has not been verified. Sign in with your password first, or contact support to link this identity.'
      )
    }

    // Determine role (reuse the same hierarchy logic as credentials)
    let role = user.role || 'user'
    // SECURITY: Platform owner email MUST be set via env var.
    // Previously hardcoded 'mohameddosho20@gmail.com' as default —
    // anyone controlling that Google account would get permanent
    // super_admin. Now: if env var is unset, no one gets super_admin
    // via this path (must be granted manually in DB).
    // SECURITY (audit C-06): email-matched admin grants additionally require
    // a verified email address — new self-service registrations default to
    // email_verified=false (migration 056), so registering the owner's email
    // first no longer yields super_admin.
    const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
    if (
      platformOwnerEmail &&
      user.email.toLowerCase() === platformOwnerEmail &&
      accountEmailVerified
    ) {
      role = 'super_admin'
    }
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
    if (adminEmails.includes(user.email.toLowerCase()) && accountEmailVerified) {
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
  const insertResult = await db.query<NewUserRow>(
    `INSERT INTO users (email, password_hash, full_name, role, provider, oauth_provider_id, oauth_avatar_url, email_verified)
     VALUES ($1, $2, $3, 'user', $4, $5, $6, $7)
     RETURNING id, email, full_name, role, provider`,
    [normalisedEmail, OAUTH_NO_PASSWORD, displayName, provider, providerAccountId, image || null, emailVerified]
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
        // SECURITY (audit H-08, 2026-08-30): use the RIGHTMOST X-Forwarded-For
        // hop — the one appended by our own reverse proxy. The first entry is
        // client-controlled behind an appending proxy and let attackers rotate
        // a fake IP per request to dodge the login lockout.
        const clientIp = forwarded.split(',').map((h: string) => h.trim()).filter(Boolean).pop() || 'unknown'

        // Check brute-force lockout BEFORE checking credentials
        const loginCheck = await checkLoginAllowed(credentials.email, clientIp)
        if (!loginCheck.allowed) {
          logger.warn(`[auth] Login blocked for ${credentials.email} from ${clientIp}: ${loginCheck.reason}`)
          return null
        }

        try {
          const { rows } = await db.query<Omit<AuthUserRow, 'oauth_avatar_url'>>(
            'SELECT id, email, password_hash, full_name, isk_number, verified_isk, role, provider, email_verified FROM users WHERE email = $1 LIMIT 1',
            [credentials.email.toLowerCase().trim()]
          )

          if (rows.length === 0) {
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          const user = rows[0]

          // Block password login for OAuth-only accounts
          if (user.password_hash === OAUTH_NO_PASSWORD) {
            logger.warn(`[auth] Password login attempted on OAuth-only account: ${user.email}`)
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          const valid = await bcrypt.compare(credentials.password, user.password_hash)
          if (!valid) {
            await recordFailedLogin(credentials.email, clientIp)
            const remaining = 5 - await getFailedAttemptCount(credentials.email, clientIp)
            if (remaining <= 2 && remaining > 0) {
              logger.warn(`[auth] ${remaining} attempts remaining for ${credentials.email} from ${clientIp}`)
            }
            return null
          }

          // Check if account is suspended
          try {
            const { rows: profileRows } = await db.query<{ is_suspended: boolean; suspension_reason: string | null }>(
              'SELECT is_suspended, suspension_reason FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [user.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              logger.warn(`[auth] Suspended account login attempt: ${user.email}`)
              return null
            }
          } catch (profileErr) {
            // SECURITY (audit H-07, 2026-08-30): only tolerate a MISSING
            // table (pre-migration environments). Any other database error
            // fails CLOSED — previously a transient DB error let suspended
            // accounts sign in.
            const pgCode = (profileErr as { code?: string })?.code
            if (pgCode !== '42P01' && pgCode !== '42703') {
              logger.error('[auth] Suspension check DB error — failing closed:', { error: profileErr })
              return null
            }
          }

          // Successful login — clear failure count
          await recordSuccessfulLogin(credentials.email, clientIp)

          // Determine role — priority: hardcoded owner > ADMIN_EMAILS > users.role > surveyor_profiles.role > 'surveyor'
          let role = user.role || 'surveyor'

          // Platform owner always gets super_admin regardless of env var or DB state
          // SECURITY: env var required — see comment above
          // SECURITY (audit C-06, 2026-08-30): email-matched super_admin grants
          // additionally require a verified email address. Self-service
          // registrations default to email_verified=false (migration 056), so
          // registering the owner's email address first no longer produces a
          // super_admin account. All pre-existing accounts are grandfathered
          // as verified by the same migration.
          const accountEmailVerified = (user as AuthUserRow).email_verified === true
          const platformOwnerEmail = process.env.PLATFORM_OWNER_EMAIL?.toLowerCase()
          if (platformOwnerEmail && user.email.toLowerCase() === platformOwnerEmail && accountEmailVerified) {
            role = 'super_admin'
          }

          const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase()).filter(Boolean)
          if (adminEmails.includes(user.email.toLowerCase()) && accountEmailVerified) {
            role = 'super_admin'
          } else if (!role || role === 'user') {
            // Fallback: check surveyor_profiles table
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
          logger.error('[auth] Login DB error:', { error: err })
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
          logger.warn(`[auth] OAuth sign-in rejected: no email from ${account.provider}`)
          return false
        }

        // Google specifically provides email_verified in the profile
        const oauthProfile = profile as Record<string, unknown> | undefined
        if (account.provider === 'google' && oauthProfile?.email_verified === false) {
          logger.warn(`[auth] Google OAuth sign-in rejected: email not verified for ${user.email}`)
          return false
        }

        // SECURITY (audit C-06, 2026-08-30): resolve whether the PROVIDER
        // actually verified the email, and fail closed when it didn't say.
        // Google exposes email_verified on the profile; Azure AD work/school
        // identities are tenant-verified but personal accounts (tenant
        // 'common') are not guaranteed — without an explicit verified claim
        // we treat the address as unverified for linking/grant purposes.
        // Sign-in itself still succeeds; only privileged grants and identity
        // linking are gated.
        const providerEmailVerified = oauthProfile?.email_verified === true

        try {
          const oauthUser = await findOrCreateOAuthUser({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            emailVerified: providerEmailVerified,
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
            const { rows: profileRows } = await db.query<{ is_suspended: boolean }>(
              'SELECT is_suspended FROM surveyor_profiles WHERE user_id = $1 LIMIT 1',
              [oauthUser.id]
            )
            if (profileRows.length > 0 && profileRows[0].is_suspended) {
              logger.warn(`[auth] Suspended OAuth account login attempt: ${user.email}`)
              return false
            }
          } catch {
            // surveyor_profiles may not exist — allow sign-in
          }

          return true
        } catch (err) {
          logger.error('[auth] OAuth user creation/linking error:', { error: err })
          return false
        }
      }

      // Unknown provider — reject
      logger.warn(`[auth] Unknown provider: ${account?.provider}`)
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
        logger.warn('[auth] AUTH_SECRET not set during build — using dummy. Set it before running the app.')
        return 'build-time-dummy-secret-do-not-use-in-production'
      }
      // Fail hard at runtime — never use a dummy secret in production
      throw new Error('AUTH_SECRET is not set. Run: openssl rand -base64 32')
    }
    return s
  })(),
}
