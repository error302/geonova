import { NextRequest, NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { db } from '@/lib/db'
import type { NLIMSSearchResult, NLIMSParcel } from '@/types/nlims'

// ─── DB Row Interfaces ───────────────────────────────────────────────────
interface ParcelVaultRow {
  parcel_number: string
  user_id: string
  parsed_data: unknown
  freshness: string | null
  certificate_date: string | null
}

interface ParcelVaultSharedRow {
  parcel_number: string
  registration_section: string | null
  county: string
  area_sqm: number | null
  title_deed_number: string | null
  certificate_date: string | null
  status: string | null
  freshness: string | null
}

interface NlimsCacheRow {
  parcel_number: string
  county: string
  data: unknown
  fetched_at: string
}

export const dynamic = 'force-dynamic'

// NLIMS integration is pending — generateMockParcel removed.
// Once the NLIMS API is connected, a real lookup function will replace this.

export const GET = apiHandler({ auth: true, rateLimit: { max: 30, windowMs: 60000 } }, async (request, ctx) => {
  const { searchParams } = new URL(request.url)
  const parcelNumber = searchParams.get('parcel')
  const county = searchParams.get('county')

  if (!parcelNumber) {
    return NextResponse.json(
      { found: false, error: 'Parcel number is required', isMockData: false } as NLIMSSearchResult,
      { status: 400 }
    )
  }

  const sanitizedParcel = parcelNumber.trim().toUpperCase().replace(/\s+/g, '')
  // Use authenticated user ID from session (not query param — security fix)
  const userId = ctx.userId

  // 1. Check personal vault
  const personalVault = await db.query<ParcelVaultRow>(
    'SELECT * FROM parcel_vault WHERE parcel_number = $1 AND user_id = $2',
    [sanitizedParcel, userId]
  )

  if (personalVault.rows.length > 0) {
    const vault = personalVault.rows[0]
    return NextResponse.json({
      found: true,
      parcel: vault.parsed_data as NLIMSParcel,
      isMockData: false,
      source: 'VAULT_PERSONAL',
      freshness: vault.freshness ?? undefined,
      certificateDate: vault.certificate_date ?? undefined
    } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
  }

  // 2. Check shared vault
  const sharedVault = await db.query<ParcelVaultSharedRow>(
    'SELECT * FROM parcel_vault_shared WHERE parcel_number = $1',
    [sanitizedParcel]
  )

  if (sharedVault.rows.length > 0) {
    const sv = sharedVault.rows[0]
    const mockFromVault: NLIMSParcel = {
      parcelNumber: sv.parcel_number,
      registrationSection: sv.registration_section || '',
      county: sv.county,
      area: sv.area_sqm || 0,
      areaHectares: (sv.area_sqm || 0) / 10000,
      ownerName: '[Community Shared - Owner Hidden]',
      ownerType: 'INDIVIDUAL',
      titleDeedNumber: sv.title_deed_number || '',
      titleDeedDate: sv.certificate_date || '',
      encumbrances: [],
      status: (sv.status as 'REGISTERED' | 'PENDING' | 'DISPUTED' | 'CANCELLED' | null) || 'REGISTERED',
      lastTransactionDate: sv.certificate_date || '',
      lastTransactionType: 'SEARCH',
      source: 'VAULT_SHARED',
      fetchedAt: new Date().toISOString()
    }
    return NextResponse.json({
      found: true,
      parcel: mockFromVault,
      isMockData: true,
      source: 'VAULT_SHARED',
      freshness: sv.freshness ?? undefined,
      certificateDate: sv.certificate_date ?? undefined
    } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
  }

  // 3. Check NLIMS cache (24h freshness)
  const cached = await db.query<NlimsCacheRow>(
    'SELECT data, fetched_at FROM nlims_cache WHERE parcel_number = $1 AND county = $2',
    [sanitizedParcel, county || '']
  )

  if (cached.rows.length > 0) {
    const row = cached.rows[0]
    const cacheAge = Date.now() - new Date(row.fetched_at).getTime()
    const oneDay = 24 * 60 * 60 * 1000

    if (cacheAge < oneDay) {
      return NextResponse.json({
        found: true,
        parcel: row.data as NLIMSParcel,
        isMockData: ((row.data as { source?: string } | null)?.source) === 'NLIMS_CACHED'
      } as NLIMSSearchResult)
    }
  }

  // 4. Live NLIMS API lookup
  const apiKey = process.env.NLIMS_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { found: false, error: 'NLIMS integration is pending — no API key configured', isMockData: false } as NLIMSSearchResult,
      { status: 503 }
    )
  }

  try {
    const response = await fetch('https://api.ardhi.go.ke/nlims/v1/parcel/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parcelNumber: sanitizedParcel, county: county || '' })
    })

    if (response.ok) {
      const data = (await response.json()) as NLIMSParcel
      const parcel: NLIMSParcel = {
        ...data,
        source: 'NLIMS_LIVE',
        fetchedAt: new Date().toISOString()
      }

      await db.query<never>(
        `INSERT INTO nlims_cache (parcel_number, county, data, fetched_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (parcel_number, county) DO UPDATE SET data = $3, fetched_at = $4`,
        [sanitizedParcel, county || '', parcel, new Date().toISOString()]
      )

      return NextResponse.json({
        found: true,
        parcel,
        isMockData: false
      } as NLIMSSearchResult)
    }
  } catch (apiError) {
    console.error('NLIMS API error:', apiError)
  }

  return NextResponse.json(
    { found: false, error: 'Parcel not found via NLIMS API', isMockData: false } as NLIMSSearchResult,
    { status: 404 }
  )
})
