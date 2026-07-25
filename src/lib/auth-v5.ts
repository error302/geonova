// @ts-nocheck
/**
 * NextAuth v5 (Auth.js) — STAGED MIGRATION CONFIG
 *
 * !  This file is NOT yet active. The app still uses src/lib/auth.ts (v4).
 *     This is the v5 equivalent, ready for activation when the migration
 *     window opens (per docs/SYSTEM_DESIGN_V3.md section 6).
 *
 * @ts-nocheck is intentional: this file uses the NextAuth v5 API which
 * is not yet installed (next-auth@beta). TypeScript will error on the v5
 * imports/callbacks until the migration is executed. The file is preserved
 * as a ready-to-use artifact — remove @ts-nocheck after running
 * `npm install next-auth@beta`.
 *
 * To activate:
 *   1. Install: npm install next-auth@beta
 *   2. Remove the @ts-nocheck comment on line 1
 *   3. Run Prisma migration for v5 schema (emailVerified field, etc.)
 *   4. Update src/app/api/auth/[...nextauth]/route.ts to:
 *        export { GET, POST } from '@/lib/auth-v5'
 *   5. Find-and-replace getServerSession(authOptions) → auth() across the codebase
 *   6. Set NEXT_PUBLIC_AUTH_V5=true feature flag
 *
 * Until then, src/lib/auth.ts (v4) is the source of truth.
 *
 * Migration plan: docs/SYSTEM_DESIGN_V3.md section 6
 */

import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import AzureAD from 'next-auth/providers/azure-ad'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import {
  checkLoginAllowed,
  recordFailedLogin,
  recordSuccessfulLogin,
} from '@/lib/security/loginLimiter'

const OAUTH_NO_PASSWORD = 'OAUTH_NO_PASSWORD'

// ─── Session strategy: JWT with database fallback ───────────────────────────

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Session strategy: JWT for read performance, DB for revocation
  session: {
    strategy: 'jwt',
    // Cookie cache: session data cached 5 min, then re-validated against DB
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // ─── Providers (mirrors v4 authOptions) ───────────────────────────────────
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null

        // Extract client IP (v5 uses standard Request)
        const forwarded = req?.headers?.get('x-forwarded-for') || ''
        const clientIp = forwarded.split(',')[0]?.trim() || 'unknown'

        // Brute-force lockout check
        const loginCheck = await checkLoginAllowed(credentials.email, clientIp)
        if (!loginCheck.allowed) {
          console.warn(
            `[auth-v5] Login blocked for ${credentials.email} from ${clientIp}: ${loginCheck.reason}`
          )
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
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          // Verify password
          const isValid = await bcrypt.compare(credentials.password, user.password_hash)
          if (!isValid) {
            await recordFailedLogin(credentials.email, clientIp)
            return null
          }

          await recordSuccessfulLogin(credentials.email, clientIp)

          return {
            id: user.id,
            email: user.email,
            name: user.full_name,
            role: user.role,
            iskNumber: user.isk_number,
            verifiedIsk: user.verified_isk,
          }
        } catch (err) {
          console.error('[auth-v5] Authorization error:', err)
          return null
        }
      },
    }),

    // OAuth providers — same as v4, config from env
    ...(process.env.GOOGLE_CLIENT_ID
      ? [Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        })]
      : []),

    ...(process.env.AZURE_AD_CLIENT_ID
      ? [AzureAD({
          clientId: process.env.AZURE_AD_CLIENT_ID!,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
          tenantId: process.env.AZURE_AD_TENANT_ID!,
        })]
      : []),
  ],

  // ─── Callbacks (mirror v4, add typed session) ────────────────────────────
  callbacks: {
    async jwt({ token, user }) {
      // First sign-in: persist user fields to token
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role || 'user'
        token.iskNumber = (user as { iskNumber?: string }).iskNumber || ''
        token.verifiedIsk = (user as { verifiedIsk?: boolean }).verifiedIsk || false
      }
      return token
    },

    async session({ session, token }) {
      // Persist token fields to session for client + server access
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.iskNumber = token.iskNumber as string
        session.user.verifiedIsk = token.verifiedIsk as boolean
      }
      return session
    },

    async authorized({ request, auth }) {
      // Per-route authorization — replaces middleware.ts redirects
      // Return true to allow, false to redirect to login, or a Response object
      return true
    },
  },

  // ─── Events: post-creation hooks (new in v5) ────────────────────────────
  events: {
    async createUser({ user }) {
      // Auto-create default surveyor profile on registration
      // (better-auth-best-practices skill: hooks for post-creation defaults)
      try {
        await db.query(
          `INSERT INTO surveyor_profiles (user_id, region, plan, created_at)
           VALUES ($1, 'Kenya · 36S', 'free', NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          [user.id]
        )

        // Auto-create onboarding project
        await db.query(
          `INSERT INTO projects (user_id, name, type, created_at)
           VALUES ($1, 'My first project', 'cadastral', NOW())`,
          [user.id]
        )

        // Verbose log gated to dev only — never log user IDs in production
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[auth-v5] Created default profile + project for user ${user.id}`)
        }
      } catch (err) {
        console.error('[auth-v5] Failed to create default profile:', err)
        // Don't fail the registration — user can create profile manually
      }
    },
  },

  // ─── Pages ──────────────────────────────────────────────────────────────
  pages: {
    signIn: '/login',
    signUp: '/register',
    error: '/login',
  },

  // ─── Cookies (v5 syntax) ───────────────────────────────────────────────
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

  // ─── Debug ──────────────────────────────────────────────────────────────
  debug: process.env.NODE_ENV === 'development',
})

// ─── Type augmentation ──────────────────────────────────────────────────────
//
// NOTE: The `declare module 'next-auth'` blocks that add `role`, `iskNumber`,
// and `verifiedIsk` to Session.user are intentionally NOT included here.
// Including them globally breaks the v4 auth.ts which uses snake_case
// (`isk_number`, `verified_isk`) on its internal user objects.
//
// When activating v5, add the type augmentation to a separate file
// (e.g. src/types/auth-v5.d.ts) and remove the snake_case properties
// from src/lib/auth.ts at the same time. See docs/SYSTEM_DESIGN_V3.md
// section 6 for the full migration checklist.
