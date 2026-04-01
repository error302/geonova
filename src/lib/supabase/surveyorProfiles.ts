import { createClient } from '@/lib/supabase/client'
import type { SurveyorDocumentProfile } from '@/types/submission'

interface SurveyorProfileRow {
  user_id: string
  display_name: string | null
  isk_number: string | null
  firm_name: string | null
  county: string | null
  phone: string | null
  email: string | null
  office_address: string | null
  seal_image_path: string | null
  profile_public: boolean | null
  verified_isk: boolean | null
}

function normalizeDocumentProfile(
  userId: string,
  userEmail: string | undefined,
  row: SurveyorProfileRow | null
): SurveyorDocumentProfile {
  return {
    userId,
    name: row?.display_name?.trim() || userEmail?.split('@')[0] || '',
    firm: row?.firm_name?.trim() || '',
    licence: row?.isk_number?.trim() || '',
    phone: row?.phone?.trim() || '',
    email: row?.email?.trim() || userEmail || '',
    address: row?.office_address?.trim() || '',
    county: row?.county?.trim() || '',
    sealImagePath: row?.seal_image_path?.trim() || '',
    profilePublic: row?.profile_public ?? true,
    verifiedLicence: row?.verified_isk ?? false,
  }
}

export function surveyorProfileToDetailsRecord(profile: SurveyorDocumentProfile): Record<string, string> {
  return {
    name: profile.name,
    firm: profile.firm,
    licence: profile.licence,
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    county: profile.county || '',
    sealImagePath: profile.sealImagePath || '',
  }
}

export function detailsRecordToSurveyorProfile(
  details: Record<string, string>,
  current: SurveyorDocumentProfile
): SurveyorDocumentProfile {
  return {
    ...current,
    name: details.name?.trim() || current.name,
    firm: details.firm?.trim() || current.firm,
    licence: details.licence?.trim() || current.licence,
    phone: details.phone?.trim() || current.phone,
    email: details.email?.trim() || current.email,
    address: details.address?.trim() || current.address,
    county: details.county?.trim() || current.county,
    sealImagePath: details.sealImagePath?.trim() || current.sealImagePath,
  }
}

export async function getOwnSurveyorDocumentProfile(): Promise<SurveyorDocumentProfile> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data, error } = await supabase
    .from('surveyor_profiles')
    .select('user_id, display_name, isk_number, firm_name, county, phone, email, office_address, seal_image_path, profile_public, verified_isk')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizeDocumentProfile(user.id, user.email, (data as SurveyorProfileRow | null) ?? null)
}

export async function saveOwnSurveyorDocumentProfile(profile: SurveyorDocumentProfile): Promise<SurveyorDocumentProfile> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const payload = {
    user_id: user.id,
    display_name: profile.name || user.email || 'Surveyor',
    isk_number: profile.licence || null,
    firm_name: profile.firm || null,
    county: profile.county || null,
    phone: profile.phone || null,
    email: profile.email || user.email || null,
    office_address: profile.address || null,
    seal_image_path: profile.sealImagePath || null,
    profile_public: profile.profilePublic,
  }

  const { data, error } = await supabase
    .from('surveyor_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('user_id, display_name, isk_number, firm_name, county, phone, email, office_address, seal_image_path, profile_public, verified_isk')
    .single()

  if (error) {
    throw error
  }

  return normalizeDocumentProfile(user.id, user.email, data as SurveyorProfileRow)
}
