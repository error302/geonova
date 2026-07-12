export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register — Create new user account
 *
 * Hashes password with bcrypt and inserts into the users table.
 * Also creates a surveyor_profiles record so role lookup works on login.
 * Returns success so the client can auto-login via NextAuth.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { z } from 'zod'
import { rateLimit, getClientIdentifier } from '@/lib/security/rateLimit'

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  iskNumber: z.string().optional(),
})

export async function POST(request: NextRequest) {
  // Rate limit: 5 registrations per IP per 15 minutes
  const rl = await rateLimit(`register:${getClientIdentifier(request)}`, 5, 15 * 60 * 1000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, password, fullName, iskNumber } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    )

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Insert user + create surveyor_profile in a transaction
    const user = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'surveyor')
         RETURNING id, email, full_name`,
        [normalizedEmail, passwordHash, fullName]
      )

      const newUser = rows[0]

      // Create surveyor_profiles record — use gen_random_uuid() for id
      // since the table may not have a default
      await client.query(
        `INSERT INTO surveyor_profiles (id, user_id, role, is_suspended)
         VALUES (gen_random_uuid(), $1, 'surveyor', false)`,
        [newUser.id]
      )

      // Create profiles record (best effort). The profiles table is keyed by
      // id = users.id (FK) and has NO email column — email lives on users.
      //
      // CRITICAL: a failed statement poisons the entire PostgreSQL transaction
      // — every subsequent command (including COMMIT) is then treated as
      // ROLLBACK. A plain try/catch does NOT recover; it silently discards the
      // users + surveyor_profiles rows we just inserted (registration returns
      // 200 but nothing persists). We MUST use a SAVEPOINT so a failure here
      // rolls back only this statement, leaving the outer transaction intact.
      await client.query('SAVEPOINT sp_profiles')
      try {
        await client.query(
          `INSERT INTO profiles (id, full_name, isk_number)
           VALUES ($1, $2, $3)`,
          [newUser.id, fullName, iskNumber ?? null]
        )
        await client.query('RELEASE SAVEPOINT sp_profiles')
      } catch {
        // profiles table may have a different schema in some deployments —
        // roll back just this statement, keep users + surveyor_profiles.
        await client.query('ROLLBACK TO SAVEPOINT sp_profiles')
      }

      return newUser
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.full_name },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? (err as Error).message : 'Unknown error'
    console.error('[register] Error:', message)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
