/**
 * POST /api/submission/sequence
 * Atomically increments the submission sequence number for a surveyor/year pair
 * using an UPSERT — replaces the old supabase.rpc() stub that always failed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let surveyorProfileId: string
  let year: number

  try {
    const body = await req.json()
    surveyorProfileId = body.surveyorProfileId
    year = Number(body.year)
    if (!surveyorProfileId || !year) throw new Error('Missing params')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    // Ensure the submission_sequences table exists (defensive)
    await db.query(`
      CREATE TABLE IF NOT EXISTS submission_sequences (
        surveyor_profile_id UUID NOT NULL,
        year INT NOT NULL,
        sequence INT NOT NULL DEFAULT 0,
        PRIMARY KEY (surveyor_profile_id, year)
      )
    `)

    const result = await db.query(
      `INSERT INTO submission_sequences (surveyor_profile_id, year, sequence)
       VALUES ($1, $2, 1)
       ON CONFLICT (surveyor_profile_id, year)
       DO UPDATE SET sequence = submission_sequences.sequence + 1
       RETURNING sequence`,
      [surveyorProfileId, year]
    )

    return NextResponse.json({ sequence: result.rows[0].sequence })
  } catch (err: any) {
    console.error('[/api/submission/sequence] DB error:', err)
    return NextResponse.json(
      { error: 'Failed to generate sequence number' },
      { status: 500 }
    )
  }
}
