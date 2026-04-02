import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { riseAndFall, heightOfCollimation } from '@/lib/engine/leveling';
import { apiSuccess, apiError } from '@/lib/api/response';

const levelingSchema = z.object({
  surveyType: z.enum(['engineering', 'mining', 'deformation']),
  method: z.enum(['rise_and_fall', 'height_of_collimation']),
  openingRL: z.number(),
  closingRL: z.number().optional(),
  readings: z.array(
    z.object({
      station: z.string(),
      bs: z.number().optional(),
      is: z.number().optional(),
      fs: z.number().optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = levelingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      apiError('Invalid leveling request.', { issues: parsed.error.issues }),
      { status: 400 }
    );
  }

  const { method, openingRL, closingRL, readings } = parsed.data;

  const totalStations = readings.filter((r) => r.bs !== undefined).length;
  const distanceKm = totalStations / 1000;

  const input = {
    readings,
    openingRL,
    closingRL,
    method,
    distanceKm: Math.max(distanceKm, 0.001),
  };

  const result = method === 'height_of_collimation'
    ? heightOfCollimation(input)
    : riseAndFall(input);

  const misclosureMm = Math.abs(result.misclosure) * 1000;
  const allowableMm = result.allowableMisclosure * 1000;

  return NextResponse.json(
    apiSuccess({
      task: 'leveling',
      method: result.method,
      readings: result.readings,
      misclosure: result.misclosure,
      misclosureMm,
      allowableMm,
      arithmeticCheck: result.arithmeticCheck,
      isAcceptable: result.isAcceptable,
      closureStatus: result.isAcceptable ? 'acceptable' : 'excessive',
      message: result.isAcceptable
        ? `Closure within tolerance (${misclosureMm.toFixed(1)}mm / ${allowableMm.toFixed(1)}mm)`
        : `Closure exceeds tolerance (${misclosureMm.toFixed(1)}mm / ${allowableMm.toFixed(1)}mm)`,
    })
  );
}

export async function GET() {
  return NextResponse.json(
    apiSuccess({
      endpoint: '/api/compute/leveling',
      description: 'Run leveling computations with 10√K mm closure check (RDM 1.1)',
      methods: ['rise_and_fall', 'height_of_collimation'],
      surveyTypes: ['engineering', 'mining', 'deformation'],
    })
  );
}
