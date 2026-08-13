export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { apiHandler } from '@/lib/apiHandler'
import { calculateEDMCorrection, calculateScaleCorrection, combinedEDMCorrection, estimateAccuracy } from '@/lib/online/weather'
import { EDMCorrectionSchema } from '@/lib/validation/apiSchemas'

/**
 * POST /api/weather/edm-correction
 *
 * Calculates EDM atmospheric corrections from temperature, pressure, humidity.
 * Pure computation — no DB, no external API. Public (no auth) because the
 * field crew may use this from a tablet without logging in.
 *
 * Rate-limited to 60/min per IP to prevent abuse.
 */
export const POST = apiHandler(
  { auth: false, schema: EDMCorrectionSchema, rateLimit: { max: 60, windowMs: 60_000 } },
  async (_req, ctx) => {
    // Schema-validated input. Cast to the union shape the calculator functions expect.
    // The schema (EDMCorrectionSchema) allows optional distance/latitude/instrumentAccuracy
    // which the WeatherData interface doesn't declare, but the calculator functions
    // accept them via their parameter signatures.
    const body = ctx.body as Parameters<typeof calculateEDMCorrection>[0] & {
      distance?: number
      latitude?: number
      instrumentAccuracy?: number
    }

    const result = calculateEDMCorrection(body)

    if (body.distance !== undefined && body.elevation !== undefined && body.latitude !== undefined) {
      const corrected = combinedEDMCorrection(body.distance, body, body.elevation, body.latitude)
      const accuracy = estimateAccuracy(body.distance, body, body.instrumentAccuracy)
      return NextResponse.json({
        ...result,
        correctedDistance: corrected,
        correctionApplied: corrected - body.distance,
        estimatedAccuracy: accuracy,
      })
    }

    if (body.elevation !== undefined && body.latitude !== undefined) {
      const scaleCorrection = calculateScaleCorrection(body.elevation, body.latitude)
      return NextResponse.json({
        ...result,
        scaleCorrection,
      })
    }

    return NextResponse.json(result)
  },
)

/**
 * GET /api/weather/edm-correction — API docs
 */
export async function GET() {
  return NextResponse.json({
    description: 'EDM atmospheric correction calculator',
    parameters: {
      temperature: 'Temperature in Celsius (required)',
      pressure: 'Atmospheric pressure in hPa/mbar (required)',
      humidity: 'Relative humidity in % (optional, default 50)',
      elevation: 'Height above sea level in meters (optional)',
      latitude: 'Latitude in degrees (required for scale correction)',
      distance: 'Measured distance in meters (optional)',
      instrumentAccuracy: 'Instrument accuracy in mm (default: 3)',
    },
    example: {
      temperature: 25,
      pressure: 1013.25,
      humidity: 60,
      elevation: 1500,
      latitude: -1.2921,
    },
  })
}
