/**
 * Seed script — Creates the admin user in the VM PostgreSQL
 * 
 * Run: npx tsx scripts/seed-admin.ts
 * 
 * Prerequisites:
 *   - DATABASE_URL must be set in environment
 *   - The users table must exist (run migration 050_users_table.sql first)
 */

import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is required')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: databaseUrl })

  const email = 'mohameddosho20@gmail.com'
  const password = 'Dosho10701$'
  const fullName = 'Mohamed Dosho'

  console.log(`Seeding admin user: ${email}`)

  const passwordHash = await bcrypt.hash(password, 10)

  try {
    // Check if user exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existing.length > 0) {
      // Update password
      await pool.query(
        'UPDATE users SET password_hash = $1, full_name = $2, updated_at = NOW() WHERE email = $3',
        [passwordHash, fullName, email]
      )
      console.log(`Updated existing admin user: ${email}`)
    } else {
      await pool.query(
        `INSERT INTO users (email, password_hash, full_name)
         VALUES ($1, $2, $3)`,
        [email, passwordHash, fullName]
      )
      console.log(`Created admin user: ${email}`)
    }

    console.log('Done!')
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
