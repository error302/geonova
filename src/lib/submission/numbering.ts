import { createClient } from '@/lib/supabase/client'
import type { SurveyorProfile } from '@/types/submission'

export async function generateSubmissionNumber(
  surveyorProfileId: string,
  registrationNo: string
): Promise<{ submissionNumber: string; sequence: number; year: number }> {
  const supabase = createClient()
  const year = new Date().getFullYear()

  // Atomically increment sequence via RPC
  const { data, error } = await supabase.rpc('increment_submission_sequence', {
    p_surveyor_profile_id: surveyorProfileId,
    p_year: year,
  })

  if (error) throw new Error(`Failed to generate submission number: ${error.message}`)
  
  const seq = data as number

  const submissionNumber = `${registrationNo}_${year}_${String(seq).padStart(3, '0')}_R00`
  return { submissionNumber, sequence: seq, year }
}

export function incrementRevision(submissionNumber: string): string {
  // RS149_2025_002_R00 → RS149_2025_002_R01
  const parts = submissionNumber.split('_')
  if (parts.length !== 4) throw new Error('Invalid submission number format')
  const revPart = parts[3]
  const revNum = parseInt(revPart.replace('R', ''), 10)
  parts[3] = `R${String(revNum + 1).padStart(2, '0')}`
  return parts.join('_')
}

