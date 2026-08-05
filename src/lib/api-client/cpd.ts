import { createClient } from '@/lib/api-client/server'
import { randomBytes } from 'crypto'
import type { CPDRecord, CPDCertificate, CPDActivity } from '@/types/cpd'
import { CPD_POINTS } from '@/types/cpd'

/**
 * Generate a cryptographically secure verification code for CPD certificates.
 * Uses crypto.randomBytes (not Math.random) — see src/lib/cpd.ts for rationale.
 */
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = randomBytes(12)
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(bytes[i] % chars.length)
  }
  return code
}

export async function awardCPDPoints(
  userId: string,
  activity: CPDActivity,
  description: string,
  referenceId?: string,
  customPoints?: number
): Promise<string> {
  const dbClient = await createClient()
  const points = customPoints ?? CPD_POINTS[activity]

  const result = await dbClient
    .from('cpd_records')
    .insert({
      user_id: userId,
      activity,
      points,
      description,
      reference_id: referenceId,
      verifiable: true
    })
    .select()
    .single()

  if (result.error) throw result.error
  const inserted = result.data as unknown as CPDRecord
  if (!inserted) throw new Error('Failed to create CPD record')
  return inserted.id
}

export async function getUserCPDForYear(userId: string, year: number): Promise<CPDRecord[]> {
  const dbClient = await createClient()
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const result = await dbClient
    .from('cpd_records')
    .select('*')
    .eq('user_id', userId)
    .gte('earned_at', startDate)
    .lte('earned_at', endDate)
    .order('earned_at', { ascending: false })

  if (result.error) throw result.error
  return (result.data as unknown as CPDRecord[]) || []
}

export async function getTotalCPDForYear(userId: string, year: number): Promise<number> {
  const records = await getUserCPDForYear(userId, year)
  return records.reduce((sum, r) => sum + r.points, 0)
}

export async function generateCPDCertificate(
  userId: string,
  year: number,
  surveyorName: string,
  iskNumber: string
): Promise<CPDCertificate> {
  const dbClient = await createClient()
  const records = await getUserCPDForYear(userId, year)
  const totalPoints = records.reduce((sum, r) => sum + r.points, 0)
  const verificationCode = generateVerificationCode()

  const result = await dbClient
    .from('cpd_certificates')
    .insert({
      user_id: userId,
      year,
      total_points: totalPoints,
      verification_code: verificationCode
    })
    .select()
    .single()

  if (result.error) throw result.error
  const data = result.data as { id: string; generated_at: string }

  return {
    id: data.id,
    userId,
    surveyorName,
    iskNumber,
    year,
    totalPoints,
    activities: records,
    generatedAt: data.generated_at,
    verificationCode
  }
}

export async function verifyCPDCertificate(code: string): Promise<CPDCertificate | null> {
  const dbClient = await createClient()
  const result = await dbClient
    .from('cpd_certificates')
    .select('*')
    .eq('verification_code', code.toUpperCase())
    .single()

  if (result.error || !result.data) return null
  const data = result.data as { id: string; user_id: string; year: number; total_points: number; generated_at: string; verification_code: string; pdf_path: string }

  // Fetch associated records and profile separately (no nested joins in QueryBuilder)
  const [recordsResult, profileResult] = await Promise.all([
    dbClient.from('cpd_records').select('*').eq('user_id', data.user_id),
    dbClient.from('profiles').select('full_name, isk_number').eq('id', data.user_id).single()
  ])

  const records = (recordsResult.data as unknown as CPDRecord[]) || []
  const profile = profileResult.data as { full_name: string | null; isk_number: string | null } | null

  return {
    id: data.id,
    userId: data.user_id,
    surveyorName: profile?.full_name || 'Unknown',
    iskNumber: profile?.isk_number || 'N/A',
    year: data.year,
    totalPoints: data.total_points,
    activities: records,
    generatedAt: data.generated_at,
    verificationCode: data.verification_code,
    pdfPath: data.pdf_path
  }
}
