import { NextResponse } from 'next/server'
import { getVaultStats } from '@/lib/parcelVault'

export async function GET() {
  try {
    const stats = await getVaultStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error('Vault stats error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
