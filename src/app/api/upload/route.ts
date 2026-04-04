import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads')

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const path = formData.get('path') as string | null

    if (!file || !bucket || !path) {
      return NextResponse.json({ error: 'Missing file, bucket, or path' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const targetDir = join(UPLOAD_DIR, bucket)
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // path might contain folders like "user_id/image.jpg", so we need to ensure those exist too
    const fullTargetPath = join(targetDir, path)
    const targetPathDir = fullTargetPath.substring(0, fullTargetPath.lastIndexOf('/'))
    if (!existsSync(targetPathDir)) {
      await mkdir(targetPathDir, { recursive: true })
    }

    await writeFile(fullTargetPath, buffer)

    return NextResponse.json({
      success: true,
      publicUrl: `/uploads/${bucket}/${path}`,
      path: `${bucket}/${path}`
    })
  } catch (error: any) {
    console.error('Local upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file locally' }, { status: 500 })
  }
}
