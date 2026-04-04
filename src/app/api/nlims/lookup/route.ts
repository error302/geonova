import { NextRequest, NextResponse } from 'next/server'
import db from '@/lib/db'
import type { NLIMSSearchResult, NLIMSParcel } from '@/types/nlims'

export const dynamic = 'force-dynamic'

function deriveSectionFromParcel(parcelNumber: string): string {
  const match = parcelNumber.match(/^([A-Za-z]+)/)
  return match ? match[1].toUpperCase() : 'UNKNOWN'
}

function generateMockParcel(parcelNumber: string, county: string): NLIMSParcel {
  return {
    parcelNumber,
    registrationSection: deriveSectionFromParcel(parcelNumber),
    county: county || 'Unknown',
    area: 450.0000,
    areaHectares: 0.0450,
    ownerName: '[NLIMS Integration Pending]',
    ownerType: 'INDIVIDUAL',
    titleDeedNumber: 'IR/12345',
    titleDeedDate: '2020-01-15',
    encumbrances: [],
    status: 'REGISTERED',
    lastTransactionDate: '2022-03-14',
    lastTransactionType: 'TRANSFER',
    source: 'NLIMS_CACHED',
    fetchedAt: new Date().toISOString()
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parcelNumber = searchParams.get('parcel')
    const county = searchParams.get('county')
    const userId = searchParams.get('userId')

    if (!parcelNumber) {
      return NextResponse.json(
        { found: false, error: 'Parcel number is required', isMockData: false } as NLIMSSearchResult,
        { status: 400 }
      )
    }

    const sanitizedParcel = parcelNumber.trim().toUpperCase().replace(/\s+/g, '')

    if (userId) {
      const personalVault = await db.query(
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
          freshness: vault.freshness,
          certificateDate: vault.certificate_date
        } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
      }

      const sharedVault = await db.query(
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
          titleDeedDate: sv.certificate_date,
          encumbrances: [],
          status: (sv.status as 'REGISTERED' | 'PENDING' | 'DISPUTED' | 'CANCELLED') || 'REGISTERED',
          lastTransactionDate: sv.certificate_date,
          lastTransactionType: 'SEARCH',
          source: 'VAULT_SHARED',
          fetchedAt: new Date().toISOString()
        }
        return NextResponse.json({
          found: true,
          parcel: mockFromVault,
          isMockData: true,
          source: 'VAULT_SHARED',
          freshness: sv.freshness,
          certificateDate: sv.certificate_date
        } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
      }
    }

    const cached = await db.query(
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
          isMockData: row.data?.source === 'NLIMS_CACHED'
        } as NLIMSSearchResult)
      }
    }

    const apiKey = process.env.NLIMS_API_KEY

    if (!apiKey) {
      const mockParcel = generateMockParcel(sanitizedParcel, county || '')

      await db.query(
        `INSERT INTO nlims_cache (parcel_number, county, data, fetched_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (parcel_number, county) DO UPDATE SET data = $3, fetched_at = $4`,
        [sanitizedParcel, county || '', mockParcel, new Date().toISOString()]
      )

      return NextResponse.json({
        found: true,
        parcel: mockParcel,
        isMockData: true
      } as NLIMSSearchResult)
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
        const data = await response.json()
        const parcel: NLIMSParcel = {
          ...data,
          source: 'NLIMS_LIVE',
          fetchedAt: new Date().toISOString()
        }

        await db.query(
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

    const mockParcel = generateMockParcel(sanitizedParcel, county || '')

    await db.query(
      `INSERT INTO nlims_cache (parcel_number, county, data, fetched_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (parcel_number, county) DO UPDATE SET data = $3, fetched_at = $4`,
      [sanitizedParcel, county || '', mockParcel, new Date().toISOString()]
    )

    return NextResponse.json({
      found: true,
      parcel: mockParcel,
      isMockData: true
    } as NLIMSSearchResult)

  } catch (error) {
    console.error('NLIMS lookup error:', error)
    return NextResponse.json(
      { found: false, error: 'Failed to lookup parcel', isMockData: false } as NLIMSSearchResult,
      { status: 500 }
    )
  }
}
