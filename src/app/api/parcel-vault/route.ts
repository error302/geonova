import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import db from '@/lib/db'
import { saveToVault, getUserVault, deleteVaultEntry } from '@/lib/parcelVault'
import type { NLIMSParcel } from '@/types/nlims'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const entries = await getUserVault(session.user.id)

    return NextResponse.json({ vault: entries })

  } catch (error) {
    console.error('Vault GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { parcel, certificateDate, pdfPath, share } = body as {
      parcel: NLIMSParcel
      certificateDate: string
      pdfPath?: string
      share?: boolean
    }

    if (!parcel || !certificateDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await saveToVault(parcel, certificateDate, pdfPath || '', share || false, session.user.id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Vault POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parcelNumber = searchParams.get('parcel')

    if (!parcelNumber) {
      return NextResponse.json({ error: 'Parcel number required' }, { status: 400 })
    }

    await deleteVaultEntry(parcelNumber, session.user.id)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Vault DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
