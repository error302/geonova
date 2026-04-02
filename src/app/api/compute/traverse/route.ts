import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { bowditchAdjustment, forwardTraverse } from '@/lib/engine/traverse';
import { apiSuccess, apiError } from '@/lib/api/response';

const traverseSchema = z.object({
  task: z.enum(['forward', 'adjust']),
  startPoint: z.object({
    name: z.string(),
    easting: z.number(),
    northing: z.number(),
  }),
  legs: z.array(
    z.object({
      station: z.string(),
      bearing: z.number().min(0).max(360),
      distance: z.number().positive(),
    })
  ),
  closingPoint: z
    .object({
      easting: z.number(),
      northing: z.number(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = traverseSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      apiError('Invalid traverse request.', { issues: parsed.error.issues }),
      { status: 400 }
    );
  }

  const { task, startPoint, legs, closingPoint } = parsed.data;

  const points = legs.map((l) => ({ name: l.station, easting: 0, northing: 0 }));
  const distances = legs.map((l) => l.distance);
  const bearings = legs.map((l) => l.bearing);

  if (task === 'forward') {
    const result = forwardTraverse({
      start: startPoint,
      stations: legs.map((l) => l.station),
      distances,
      bearings,
    });

    return NextResponse.json(
      apiSuccess({
        task: 'traverse_forward',
        legs: result.legs,
        totalDistance: result.totalDistance,
        endPoint: result.end,
      })
    );
  }

  const traverseInput = {
    points: [startPoint, ...points],
    distances,
    bearings,
    closingPoint,
  };

  const result = bowditchAdjustment(traverseInput);

  const errorMm = result.linearError * 1000;
  const ratioStr = `1/${Math.round(1 / result.precisionRatio)}`;

  return NextResponse.json(
    apiSuccess({
      task: 'traverse_adjust',
      method: 'bowditch',
      legs: result.legs,
      closingErrorE: result.closingErrorE,
      closingErrorN: result.closingErrorN,
      linearError: result.linearError,
      linearErrorMm: errorMm,
      precisionRatio: result.precisionRatio,
      precisionRatioStr: ratioStr,
      precisionGrade: result.precisionGrade,
      totalDistance: result.totalDistance,
      isClosed: result.isClosed,
      message: `${result.precisionGrade.charAt(0).toUpperCase() + result.precisionGrade.slice(1)} closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm)`,
    })
  );
}

export async function GET() {
  return NextResponse.json(
    apiSuccess({
      endpoint: '/api/compute/traverse',
      description: 'Run traverse computations: forward traverse and Bowditch adjustment',
      tasks: ['forward', 'adjust'],
    })
  );
}
