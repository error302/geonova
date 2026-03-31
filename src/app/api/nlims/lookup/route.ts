import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { NLIMSSearchResult, NLIMSParcel } from '@/types/nlims'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

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
      const { data: personalVault } = await supabase
        .from('parcel_vault')
        .select('*')
        .eq('parcel_number', sanitizedParcel)
        .eq('user_id', userId)
        .single()

      if (personalVault) {
        return NextResponse.json({
          found: true,
          parcel: personalVault.parsed_data as NLIMSParcel,
          isMockData: false,
          source: 'VAULT_PERSONAL',
          freshness: personalVault.freshness,
          certificateDate: personalVault.certificate_date
        } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
      }

      const { data: sharedVault } = await supabase
        .from('parcel_vault_shared')
        .select('*')
        .eq('parcel_number', sanitizedParcel)
        .single()

      if (sharedVault) {
        const mockFromVault: NLIMSParcel = {
          parcelNumber: sharedVault.parcel_number,
          registrationSection: sharedVault.registration_section || '',
          county: sharedVault.county,
          area: sharedVault.area_sqm || 0,
          areaHectares: (sharedVault.area_sqm || 0) / 10000,
          ownerName: '[Community Shared - Owner Hidden]',
          ownerType: 'INDIVIDUAL',
          titleDeedNumber: sharedVault.title_deed_number || '',
          titleDeedDate: sharedVault.certificate_date,
          encumbrances: [],
          status: (sharedVault.status as any) || 'REGISTERED',
          lastTransactionDate: sharedVault.certificate_date,
          lastTransactionType: 'SEARCH',
          source: 'VAULT_SHARED',
          fetchedAt: new Date().toISOString()
        }
        return NextResponse.json({
          found: true,
          parcel: mockFromVault,
          isMockData: true,
          source: 'VAULT_SHARED',
          freshness: sharedVault.freshness,
          certificateDate: sharedVault.certificate_date
        } as NLIMSSearchResult & { source?: string; freshness?: string; certificateDate?: string })
      }
    }

    const { data: cached } = await supabase
      .from('nlims_cache')
      .select('data, fetched_at')
      .eq('parcel_number', sanitizedParcel)
      .eq('county', county || '')
      .single()

    if (cached) {
      const cacheAge = Date.now() - new Date(cached.fetched_at).getTime()
      const oneDay = 24 * 60 * 60 * 1000

      if (cacheAge < oneDay) {
        return NextResponse.json({
          found: true,
          parcel: cached.data as NLIMSParcel,
          isMockData: cached.data.source === 'NLIMS_CACHED'
        } as NLIMSSearchResult)
      }
    }

    const apiKey = process.env.NLIMS_API_KEY

    if (!apiKey) {
      const mockParcel = generateMockParcel(sanitizedParcel, county || '')

      await supabase
        .from('nlims_cache')
        .upsert({
          parcel_number: sanitizedParcel,
          county: county || '',
          data: mockParcel,
          fetched_at: new Date().toISOString()
        }, { onConflict: 'parcel_number,county' })

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

        await supabase
          .from('nlims_cache')
          .upsert({
            parcel_number: sanitizedParcel,
            county: county || '',
            data: parcel,
            fetched_at: new Date().toISOString()
          }, { onConflict: 'parcel_number,county' })

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

    await supabase
      .from('nlims_cache')
      .upsert({
        parcel_number: sanitizedParcel,
        county: county || '',
        data: mockParcel,
        fetched_at: new Date().toISOString()
      }, { onConflict: 'parcel_number,county' })

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
