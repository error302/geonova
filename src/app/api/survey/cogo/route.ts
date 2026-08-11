export const dynamic = 'force-dynamic'

/**
 * COGO API Route
 *
 * Coordinate geometry computations: inverse, forward, intersections.
 *
 * SECURITY: Requires authentication. Previously unauthenticated —
 * pure math so no data leak, but unauthenticated CPU-heavy work
 * was a DoS vector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/requireAuth';
import {
  computeBearingAndDistance,
  computePoint,
  lineLineIntersection,
  lineCircleIntersection,
  circleCircleIntersection,
  type Point,
} from '@/lib/survey/cogo/engine';
import { CogoOperationSchema } from '@/lib/validation/apiSchemas';
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  // SECURITY: Require authentication to prevent DoS via unauthenticated compute
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rawBody = await request.json().catch(() => null)
    const parsed = CogoOperationSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 422 }
      )
    }

    const body = parsed.data
    switch (body.operation) {
      case 'inverse': {
        const result = computeBearingAndDistance(body.from as Point, body.to as Point);
        return NextResponse.json(result);
      }
      case 'forward': {
        const result = computePoint(body.from as Point, body.bearing, body.distance);
        return NextResponse.json(result);
      }
      case 'lineLineIntersection': {
        const result = lineLineIntersection(body.point1 as Point, body.bearing1, body.point2 as Point, body.bearing2);
        return NextResponse.json(result);
      }
      case 'lineCircleIntersection': {
        const result = lineCircleIntersection(body.linePoint as Point, body.bearing, body.circleCenter as Point, body.radius);
        return NextResponse.json(result);
      }
      case 'circleCircleIntersection': {
        const result = circleCircleIntersection(body.center1 as Point, body.radius1, body.center2 as Point, body.radius2);
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: `Unknown operation: ${(body as { operation?: string }).operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('COGO API error:', { error: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Computation failed' },
      { status: 500 }
    );
  }
}
