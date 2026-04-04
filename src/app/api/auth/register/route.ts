/**
 * POST /api/auth/register — Create new user account
 * 
 * Hashes password with bcrypt and inserts into the users table.
 * Does NOT auto-login — returns success so the client can redirect to /login.
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'
import { env } from '@/lib/env'
import { z } from 'zod'

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    if (env.DATABASE_URL) {
      pool = new Pool({ connectionString: env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 })
    } else {
      throw new Error('Database not configured')
    }
  }
  return pool
}

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1, 'Full name is required'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, password, fullName } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const p = getPool()

    // Check if user already exists
    const { rows: existing } = await p.query(
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

    // Insert user
    const { rows } = await p.query(
      `INSERT INTO users (email, password_hash, full_name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, full_name`,
      [normalizedEmail, passwordHash, fullName]
    )

    return NextResponse.json({
      success: true,
      user: { id: rows[0].id, email: rows[0].email, name: rows[0].full_name },
    })
  } catch (err: any) {
    console.error('[register] Error:', err)
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    )
  }
}
