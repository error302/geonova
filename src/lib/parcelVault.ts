import db from '@/lib/db'
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
  const sanitized = parcelNumber.trim().toUpperCase().replace(/\s+/g, '')

  const personal = await db.query(
    'SELECT * FROM parcel_vault WHERE parcel_number = $1 AND user_id = $2',
    [sanitized, userId]
  )

  if (personal.rows.length > 0) {
    return {
      source: 'personal',
      freshness: personal.rows[0].freshness,
      certificateDate: personal.rows[0].certificate_date,
      data: personal.rows[0]
    }
  }

  const shared = await db.query(
    'SELECT * FROM parcel_vault_shared WHERE parcel_number = $1',
    [sanitized]
  )

  if (shared.rows.length > 0) {
    return {
      source: 'shared',
      freshness: shared.rows[0].freshness as VaultFreshness,
      certificateDate: shared.rows[0].certificate_date,
      data: shared.rows[0]
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
  const sanitized = parcel.parcelNumber.trim().toUpperCase().replace(/\s+/g, '')

  await db.query(
    `INSERT INTO parcel_vault (
      user_id, parcel_number, county, registration_section, area_sqm,
      title_deed_number, owner_type, encumbrances, status, certificate_date,
      pdf_path, shared, parsed_data
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (user_id, parcel_number) DO UPDATE SET
      county = $3, registration_section = $4, area_sqm = $5, title_deed_number = $6,
      owner_type = $7, encumbrances = $8, status = $9, certificate_date = $10,
      pdf_path = $11, shared = $12, parsed_data = $13, updated_at = NOW()`,
    [
      userId, sanitized, parcel.county, parcel.registrationSection, parcel.area,
      parcel.titleDeedNumber, parcel.ownerType, parcel.encumbrances, parcel.status,
      certificateDate, pdfPath, share, parcel
    ]
  )

  if (share) {
    const freshness = new Date(certificateDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) ? 'FRESH' : 
                     new Date(certificateDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) ? 'VERIFY' : 'STALE'

    await db.query(
      `INSERT INTO parcel_vault_shared (
        parcel_number, county, registration_section, area_sqm, title_deed_number,
        encumbrances_count, status, certificate_date, freshness, last_updated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (parcel_number) DO UPDATE SET
        county = $2, registration_section = $3, area_sqm = $4, title_deed_number = $5,
        encumbrances_count = $6, status = $7, certificate_date = $8, freshness = $9, last_updated = $10`,
      [
        sanitized, parcel.county, parcel.registrationSection, parcel.area,
        parcel.titleDeedNumber, parcel.encumbrances.length, parcel.status,
        certificateDate, freshness, new Date().toISOString()
      ]
    )
  }
}

export async function getUserVault(userId: string): Promise<ParcelVaultEntry[]> {
  const result = await db.query(
    'SELECT * FROM parcel_vault WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  )
  return result.rows
}

export async function getVaultStats(): Promise<VaultStats> {
  const [total, shared, fresh, verify, stale] = await Promise.all([
    db.query('SELECT COUNT(*) as count FROM parcel_vault'),
    db.query('SELECT COUNT(*) as count FROM parcel_vault_shared'),
    db.query("SELECT COUNT(*) as count FROM parcel_vault WHERE freshness = 'FRESH'"),
    db.query("SELECT COUNT(*) as count FROM parcel_vault WHERE freshness = 'VERIFY'"),
    db.query("SELECT COUNT(*) as count FROM parcel_vault WHERE freshness = 'STALE'")
  ])

  return {
    totalParcels: parseInt(total.rows[0]?.count || '0'),
    sharedParcels: parseInt(shared.rows[0]?.count || '0'),
    freshParcels: parseInt(fresh.rows[0]?.count || '0'),
    verifyParcels: parseInt(verify.rows[0]?.count || '0'),
    staleParcels: parseInt(stale.rows[0]?.count || '0')
  }
}

export async function deleteVaultEntry(parcelNumber: string, userId: string): Promise<void> {
  await db.query(
    'DELETE FROM parcel_vault WHERE parcel_number = $1 AND user_id = $2',
    [parcelNumber, userId]
  )
}
