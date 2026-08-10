import { createClient } from '@/lib/api-client/server'
import type { NLIMSParcel } from '@/types/nlims'

export type VaultFreshness = 'FRESH' | 'VERIFY' | 'STALE'

export interface ParcelVaultEntry {
  id: string
  user_id: string
  parcel_number: string
  county: string
  registration_section: string | null
  area_sqm: number | null
  title_deed_number: string | null
  owner_type: string | null
  encumbrances: unknown[]
  status: string | null
  certificate_date: string
  expires_at: string
  freshness: VaultFreshness
  pdf_path: string | null
  shared: boolean
  parsed_data: NLIMSParcel
  created_at: string
  updated_at: string
}

export interface ParcelVaultShared {
  id: string
  parcel_number: string
  county: string
  registration_section: string | null
  area_sqm: number | null
  title_deed_number: string | null
  encumbrances_count: number
  status: string | null
  certificate_date: string
  freshness: string
  contributor_count: number
  last_updated: string
}

export interface VaultSearchResult {
  source: 'personal' | 'shared' | 'nlims'
  freshness?: VaultFreshness
  certificateDate?: string
  data: NLIMSParcel | ParcelVaultEntry | ParcelVaultShared
}

export interface VaultStats {
  totalParcels: number
  sharedParcels: number
  freshParcels: number
  verifyParcels: number
  staleParcels: number
}

export async function searchVault(
  parcelNumber: string,
  county: string,
  userId: string
): Promise<VaultSearchResult | null> {
  const dbClient = await createClient()
  const sanitized = parcelNumber.trim().toUpperCase().replace(/\s+/g, '')

  const { data: personal } = await dbClient
    .from('parcel_vault')
    .select('*')
    .eq('parcel_number', sanitized)
    .eq('user_id', userId)
    .single()

  if (personal) {
    const entry = personal as unknown as ParcelVaultEntry
    return {
      source: 'personal',
      freshness: entry.freshness,
      certificateDate: entry.certificate_date,
      data: entry
    }
  }

  const { data: shared } = await dbClient
    .from('parcel_vault_shared')
    .select('*')
    .eq('parcel_number', sanitized)
    .single()

  if (shared) {
    const entry = shared as unknown as ParcelVaultShared
    return {
      source: 'shared',
      freshness: entry.freshness as VaultFreshness,
      certificateDate: entry.certificate_date,
      data: entry
    }
  }

  return null
}

export async function saveToVault(
  parcel: NLIMSParcel,
  certificateDate: string,
  pdfPath: string,
  share: boolean,
  userId: string
): Promise<void> {
  const dbClient = await createClient()
  const sanitized = parcel.parcelNumber.trim().toUpperCase().replace(/\s+/g, '')

  await dbClient
    .from('parcel_vault')
    .upsert({
      user_id: userId,
      parcel_number: sanitized,
      county: parcel.county,
      registration_section: parcel.registrationSection,
      area_sqm: parcel.area,
      title_deed_number: parcel.titleDeedNumber,
      owner_type: parcel.ownerType,
      encumbrances: parcel.encumbrances,
      status: parcel.status,
      certificate_date: certificateDate,
      pdf_path: pdfPath,
      shared: share,
      parsed_data: parcel
    }, { onConflict: 'user_id,parcel_number' })

  if (share) {
    await dbClient
      .from('parcel_vault_shared')
      .upsert({
        parcel_number: sanitized,
        county: parcel.county,
        registration_section: parcel.registrationSection,
        area_sqm: parcel.area,
        title_deed_number: parcel.titleDeedNumber,
        encumbrances_count: parcel.encumbrances.length,
        status: parcel.status,
        certificate_date: certificateDate,
        freshness: new Date(certificateDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? 'FRESH' :
                   new Date(certificateDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? 'VERIFY' : 'STALE',
        last_updated: new Date().toISOString()
      }, { onConflict: 'parcel_number' })
  }
}

export async function getUserVault(userId: string): Promise<ParcelVaultEntry[]> {
  const dbClient = await createClient()
  const { data, error } = await dbClient
    .from('parcel_vault')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  // ponytail: Phase 6 — data is Record<string, unknown> | null from query builder;
  // cast through unknown to the expected array type
  return (data as unknown as ParcelVaultEntry[]) || []
}

export async function getVaultStats(): Promise<VaultStats> {
  const dbClient = await createClient()
  const [total, shared, fresh, verify, stale] = await Promise.all([
    dbClient.from('parcel_vault').select('id', { count: 'exact', head: true }),
    dbClient.from('parcel_vault_shared').select('id', { count: 'exact', head: true }),
    dbClient.from('parcel_vault').select('id', { count: 'exact', head: true }).eq('freshness', 'FRESH'),
    dbClient.from('parcel_vault').select('id', { count: 'exact', head: true }).eq('freshness', 'VERIFY'),
    dbClient.from('parcel_vault').select('id', { count: 'exact', head: true }).eq('freshness', 'STALE')
  ])

  const countOf = (row: unknown): number => ((row as { count?: number | null } | null)?.count ?? 0)
  return {
    totalParcels: countOf(total),
    sharedParcels: countOf(shared),
    freshParcels: countOf(fresh),
    verifyParcels: countOf(verify),
    staleParcels: countOf(stale)
  }
}

export async function deleteVaultEntry(parcelNumber: string, userId: string): Promise<void> {
  const dbClient = await createClient()
  await dbClient
    .from('parcel_vault')
    .delete()
    .eq('parcel_number', parcelNumber)
    .eq('user_id', userId)
}
