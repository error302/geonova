/**
 * /api/import/share-target — Web Share Target receiver
 *
 * Triggered when a user shares a CSV/GeoJSON/KML/XLSX file from another
 * Android/iOS app to METARDU (installed as PWA). The manifest declares this
 * as the share_target action. We persist the file via /api/storage and
 * redirect the user to the import page with the file preloaded.
 *
 * This is a POST endpoint (multipart/form-data per the manifest).
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth-v5'
import { db } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'

const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), 'upload')
const MAX_FILE_SIZE = 50 * 1024 * 1024

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const userId = String(session.user.id)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null) ?? ''
  const text = (formData.get('text') as string | null) ?? ''
  const url = (formData.get('url') as string | null) ?? ''

  // If a URL was shared instead of a file, redirect to import with the URL
  if (!file && url) {
    const importUrl = `/import?source=share&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`
    return NextResponse.redirect(new URL(importUrl, request.url), 303)
  }

  if (!file) {
    return NextResponse.json({ error: 'No file received' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 })
  }

  // Persist the file to disk + DB
  const hash = crypto.randomBytes(8).toString('hex')
  const safeName = (file.name || 'shared-file').replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `shared/${userId}/${hash}-${safeName}`
  const fullPath = path.resolve(path.join(STORAGE_ROOT, storagePath))

  await fs.mkdir(path.dirname(fullPath), { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(fullPath, buffer)

  await db.query<never>(
    `INSERT INTO file_uploads (user_id, bucket, file_path, original_name, mime_type, size_bytes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (file_path) DO UPDATE SET updated_at = NOW()`,
    [userId, 'shared', storagePath, file.name, file.type, file.size],
  ).catch(() => {
    // file_uploads table may not exist yet — file is still on disk
  })

  // Redirect to /import page with the stored path so the UI can pick it up
  const params = new URLSearchParams({
    source: 'share',
    path: storagePath,
    name: file.name,
    type: file.type,
  })
  if (title) params.set('title', title)
  if (text) params.set('description', text)

  return NextResponse.redirect(new URL(`/import?${params.toString()}`, request.url), 303)
}
