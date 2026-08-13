export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { saveToVault, getUserVault, deleteVaultEntry } from '@/lib/parcelVault'
import type { NLIMSParcel } from '@/types/nlims'

export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const entries = await getUserVault(ctx.userId)
  return NextResponse.json({ vault: entries })
})

export const POST = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (req, ctx) => {
  const { parcel, certificateDate, pdfPath, share } = ctx.body as {
    parcel?: NLIMSParcel
    certificateDate?: string
    pdfPath?: string
    share?: boolean
  }

  if (!parcel || !certificateDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await saveToVault(parcel, certificateDate, pdfPath || '', share || false, ctx.userId)

  return NextResponse.json({ success: true })
})

export const DELETE = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (request, ctx) => {
  const parcelNumber = request.nextUrl.searchParams.get('parcel')

  if (!parcelNumber) {
    return NextResponse.json({ error: 'Parcel number required' }, { status: 400 })
  }

  await deleteVaultEntry(parcelNumber, ctx.userId)

  return NextResponse.json({ success: true })
})
