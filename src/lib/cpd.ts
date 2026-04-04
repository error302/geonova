import db from '@/lib/db'
import type { CPDRecord, CPDCertificate, CPDActivity } from '@/types/cpd'
import { CPD_POINTS } from '@/types/cpd'

function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
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
  const points = customPoints ?? CPD_POINTS[activity]
  
  const result = await db.query(
    `INSERT INTO cpd_records (user_id, activity, points, description, reference_id, verifiable)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [userId, activity, points, description, referenceId]
  )

  if (result.rows.length === 0) throw new Error('Failed to insert CPD record')
  return result.rows[0].id
}

export async function getUserCPDForYear(userId: string, year: number): Promise<CPDRecord[]> {
  const startDate = new Date(year, 0, 1).toISOString()
  const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const result = await db.query(
    `SELECT * FROM cpd_records 
     WHERE user_id = $1 AND earned_at >= $2 AND earned_at <= $3
     ORDER BY earned_at DESC`,
    [userId, startDate, endDate]
  )

  return result.rows.map((row: any) => ({
    id: row.id,
    userId: row.user_id,
    activity: row.activity,
    points: row.points,
    description: row.description,
    earnedAt: row.earned_at,
    referenceId: row.reference_id,
    verifiable: row.verifiable
  }))
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
  const records = await getUserCPDForYear(userId, year)
  const totalPoints = records.reduce((sum, r) => sum + r.points, 0)
  const verificationCode = generateVerificationCode()

  const result = await db.query(
    `INSERT INTO cpd_certificates (user_id, year, total_points, verification_code)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, year, totalPoints, verificationCode]
  )

  if (result.rows.length === 0) throw new Error('Failed to generate certificate')

  const data = result.rows[0]

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
  const result = await db.query(
    `SELECT c.*, p.full_name as profile_name, p.isk_number,
            json_agg(cr.*) as cpd_records
     FROM cpd_certificates c
     LEFT JOIN profiles p ON p.id = c.user_id
     LEFT JOIN cpd_records cr ON cr.user_id = c.user_id 
       AND EXTRACT(YEAR FROM cr.earned_at) = c.year
     WHERE c.verification_code = $1
     GROUP BY c.id, p.full_name, p.isk_number`,
    [code.toUpperCase()]
  )

  if (result.rows.length === 0) return null

  const data = result.rows[0]

  return {
    id: data.id,
    userId: data.user_id,
    surveyorName: data.profile_name || 'Unknown',
    iskNumber: data.isk_number || 'N/A',
    year: data.year,
    totalPoints: data.total_points,
    activities: data.cpd_records || [],
    generatedAt: data.generated_at,
    verificationCode: data.verification_code,
    pdfPath: data.pdf_path
  }
}
