import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { routeFile, validateFile } from '@/lib/parsers/fileRouter'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const sb = await createClient()
    const { data: { session } } = await sb.auth.getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validation = validateFile(file)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const enhanceWithAI = formData.get('enhanceWithAI') !== 'false'
    
    const result = await routeFile({ file, enhanceWithAI })

    return NextResponse.json({
      success: result.errors.length === 0,
      type: result.type,
      hasBuilding: !!result.building,
      hasBoq: !!result.boq,
      confidence: result.confidence,
      errors: result.errors,
      warnings: result.warnings,
      building: result.building ? {
        floors: result.building.floors.length,
        walls: result.building.walls.length,
        rooms: result.building.rooms.length,
        doors: result.building.doors.length,
        windows: result.building.windows.length,
      } : null,
      boq: result.boq ? {
        items: result.boq.items.length,
        total: result.boq.total,
      } : null,
    })
  } catch (error) {
    console.error('Upload parse error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Parse failed' },
      { status: 500 }
    )
  }
}