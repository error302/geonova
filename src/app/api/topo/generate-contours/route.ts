export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { generateContours, type IDWOutput } from '@/lib/topo/contourGenerator'
import { buildBreaklineTIN, checkContourSanity, type Breakline } from '@/lib/topo/breaklineTIN'
import { z } from 'zod'

const schema = z.object({
  points: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })).min(3),
  breaklines: z.array(z.object({
    points: z.array(z.object({ x: z.number(), y: z.number(), z: z.number() })),
    type: z.enum(['hard', 'soft', 'ridge', 'valley']).default('hard'),
  })).optional().default([]),
  interval: z.number().positive().default(1.0),
  maxSlope: z.number().default(45),
  gridResolution: z.number().positive().default(5),
})

export const POST = apiHandler(
  { auth: true, schema, rateLimit: { max: 10, windowMs: 60000 } },
  async (_req, ctx) => {
    const body = ctx.body as z.infer<typeof schema>

    // Build breakline-aware TIN
    const tin = buildBreaklineTIN(body.points, body.breaklines as Breakline[])

    // Build IDW grid from the points
    const pts = body.points
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
    }

    const res = body.gridResolution
    const cols = Math.max(2, Math.ceil((maxX - minX) / res) + 1)
    const rows = Math.max(2, Math.ceil((maxY - minY) / res) + 1)
    const grid: number[][] = []

    for (let row = 0; row < rows; row++) {
      const gridRow: number[] = []
      for (let col = 0; col < cols; col++) {
        const gx = minX + col * res
        const gy = minY + row * res

        // IDW interpolation (power = 2)
        let weightSum = 0
        let valueSum = 0
        for (const p of pts) {
          const dx = p.x - gx
          const dy = p.y - gy
          const dist2 = dx * dx + dy * dy
          if (dist2 < 1e-12) { weightSum = 1; valueSum = p.z; break }
          const w = 1 / dist2
          weightSum += w
          valueSum += w * p.z
        }
        gridRow.push(weightSum > 0 ? valueSum / weightSum : NaN)
      }
      grid.push(gridRow)
    }

    const idwOutput: IDWOutput = {
      grid, gridMinE: minX, gridMinN: minY,
      gridResolution: res, cols, rows,
    }

    // Generate contours
    const contourLines = generateContours(idwOutput, { interval: body.interval })

    // Run sanity checks
    const linesForCheck = contourLines.map(c => {
      // Flatten the MultiLineString coordinates
      return c.coordinates.flat().map(coord => [coord[0], coord[1]] as [number, number])
    })
    const sanity = checkContourSanity(linesForCheck, body.interval, body.maxSlope)

    return NextResponse.json({
      data: {
        contours: contourLines,
        sanity,
        tinInfo: {
          triangleCount: tin.triangles.length,
          removedTriangles: tin.removedTriangles,
          hasConstraints: tin.hasConstraints,
          breaklineCount: body.breaklines.length,
        },
      },
    })
  },
)
