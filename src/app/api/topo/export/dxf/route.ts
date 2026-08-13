export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setCurrentUserId } from '@/lib/db'
import Drawing from 'dxf-writer'
import {
  initialiseSokDXFLayers,
  DXF_LAYERS
} from '@/lib/drawing/dxfLayers'
import type { ContourLine } from '@/lib/topo/contourGenerator'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const userId = session.user.id
  if (userId) setCurrentUserId(String(userId))

  try {
    const { projectId, contours, spotHeights } = await req.json() as {
      projectId?: string
      contours: ContourLine[]
      spotHeights: { e: number; n: number; z: number; label?: string }[]
    }

    const drawing = new Drawing()
    initialiseSokDXFLayers(drawing)

    contours.forEach((contour: ContourLine) => {
      const layerName = contour.isIndex
        ? DXF_LAYERS.CONTOUR_I.name
        : DXF_LAYERS.CONTOURS.name

      drawing.setActiveLayer(layerName)

      contour.coordinates.forEach((ring: [number, number][]) => {
        for (let i = 0; i < ring.length - 1; i++) {
          drawing.drawLine(ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1])
        }
        if (ring.length > 1) {
          drawing.drawLine(ring[ring.length - 1][0], ring[ring.length - 1][1], ring[0][0], ring[0][1])
        }

        if (contour.isIndex && ring.length > 4) {
          const mid = ring[Math.floor(ring.length / 4)]
          drawing.drawText(mid[0], mid[1], 0.5, 0, `${contour.elevation.toFixed(1)}`)
        }
      })
    })

    drawing.setActiveLayer(DXF_LAYERS.SPOT.name)
    spotHeights.forEach((pt: { e: number; n: number; z: number; label?: string }) => {
      drawing.drawCircle(pt.e, pt.n, 0.2)
      drawing.drawText(pt.e + 0.3, pt.n + 0.3, 0.4, 0, pt.z.toFixed(2))
    })

    const dxfString = drawing.toDxfString()

    return new NextResponse(dxfString, {
      headers: {
        'Content-Type': 'application/dxf',
        'Content-Disposition': `attachment; filename="topo_${projectId}.dxf"`
      }
    })
  } catch {
    return NextResponse.json({ error: 'DXF generation failed' }, { status: 500 })
  }
}
