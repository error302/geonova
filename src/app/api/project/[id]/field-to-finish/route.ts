// ──────────────────────────────────────────────────────────────────────────
// METARDU — Field-to-Finish API Route
// ──────────────────────────────────────────────────────────────────────────
// POST /api/project/[id]/field-to-finish
//
// The ONE endpoint a surveyor needs after fieldwork.
//
// Takes the project's raw observations → runs the full pipeline:
//   1. EDM corrections
//   2. Traverse adjustment
//   3. Closure check
//   4. Area computation
//   5. Pre-submission validation
//
// Returns everything the surveyor needs to know:
//   - Did the traverse close?
//   - What's the area?
//   - Is it ready for submission?
//   - What's blocking submission?
//
// Usage:
//   const res = await fetch(`/api/project/${id}/field-to-finish`, { method: 'POST' });
//   const result = await res.json();
//   // result.instantFeedback.passes → true/false
//   // result.area.hectares → 0.4523
//   // result.preSubmit.ready → true/false
//   // result.preSubmit.issues → [...]
// ──────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { fieldToFinish, type FieldObservation, type FieldToFinishInput } from '@/lib/survey/field-to-finish';
import type { SurveyTypeKey } from '@/lib/engine/traverse';
import { preSubmitCheck } from '@/lib/submission/pre-submit-check';

interface FieldToFinishProjectRow {
  close_easting?: string;
  close_northing?: string;
  survey_type?: string;
  lr_number?: string;
  parcel_number?: string;
  county?: string;
  sub_county?: string;
  division?: string;
  locality?: string;
  client_name?: string;
  area_m2?: number;
  perimeter_m?: number;
  precision_ratio?: string;
  linear_misclosure?: number;
  angular_misclosure?: number;
  closing_error_e?: number;
  closing_error_n?: number;
}

interface SurveyPointRow {
  name?: string;
  easting?: number;
  northing?: number;
  type?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Auth
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
  if (!token?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projectId = params.id;

  try {
    // ── Load project data ──
    const projectResult = await db.query<FieldToFinishProjectRow>(
      'SELECT * FROM projects WHERE id = $1',
      [projectId],
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // ── Load survey points ──
    const pointsResult = await db.query<SurveyPointRow>(
      `SELECT * FROM survey_points
       WHERE project_id = $1
       ORDER BY name`,
      [projectId],
    );

    const surveyPoints = pointsResult.rows;

    // ── Load field book observations ──
    const obsResult = await db.query(
      `SELECT * FROM field_book_entries
       WHERE project_id = $1
       ORDER BY created_at`,
      [projectId],
    );

    const fieldObs: FieldObservation[] = obsResult.rows.map((row: Record<string, unknown>) => ({
      fromStation: String(row.from_station || row.station_from || ''),
      toStation: String(row.to_station || row.station_to || ''),
      bearing: row.bearing != null ? parseFloat(String(row.bearing)) : undefined,
      slopeDistance: parseFloat(String(row.slope_distance || row.slope_distance_m || 0)),
      verticalAngle: row.vertical_angle != null ? parseFloat(String(row.vertical_angle)) : undefined,
      ih: row.instrument_height != null ? parseFloat(String(row.instrument_height)) : undefined,
      th: row.target_height != null ? parseFloat(String(row.target_height)) : undefined,
      temperature: row.temperature != null ? parseFloat(String(row.temperature)) : undefined,
      pressure: row.pressure != null ? parseFloat(String(row.pressure)) : undefined,
      humidity: row.humidity != null ? parseFloat(String(row.humidity)) : undefined,
    }));

    // ── Run field-to-finish pipeline ──
    const input: FieldToFinishInput = {
      observations: fieldObs,
      startStation: {
        name: surveyPoints[0]?.name || 'P1',
        easting: parseFloat(String(surveyPoints[0]?.easting ?? 0)),
        northing: parseFloat(String(surveyPoints[0]?.northing ?? 0)),
      },
      closeStation: project.close_easting ? {
        name: 'CLOSE',
        easting: parseFloat(project.close_easting),
        northing: parseFloat(project.close_northing ?? ''),
      } : undefined,
      mode: project.close_easting ? 'link' : 'closed',
      surveyType: (project.survey_type || 'cadastral') as SurveyTypeKey,
      adjustmentMethod: 'bowditch',
      lrNumber: project.lr_number,
    };

    const pipelineResult = await fieldToFinish(input);

    // ── Run pre-submission check ──
    const preSubmit = preSubmitCheck(
      {
        ...project,
        survey_points: surveyPoints,
      },
      surveyPoints.map((p) => ({
        name: String(p.name ?? ''),
        easting: parseFloat(String(p.easting ?? 0)),
        northing: parseFloat(String(p.northing ?? 0)),
        type: p.type,
      })),
      pipelineResult.status !== 'failed'
        ? {
            precisionRatio: pipelineResult.instantFeedback.precisionRatio,
            passes: pipelineResult.instantFeedback.passes,
            totalDistance: pipelineResult.instantFeedback.perimeter,
            linearError: pipelineResult.instantFeedback.linearMisclosure,
          }
        : undefined,
    );

    // ── Save computed results back to project ──
    if (pipelineResult.status !== 'failed') {
      await db.query(
        `UPDATE projects SET
           precision_ratio = $1,
           linear_misclosure = $2,
           closing_error_e = $3,
           closing_error_n = $4,
           area_m2 = $5,
           perimeter_m = $6,
           updated_at = NOW()
         WHERE id = $7`,
        [
          pipelineResult.instantFeedback.precisionFormatted,
          pipelineResult.instantFeedback.linearMisclosure,
          pipelineResult.instantFeedback.closingErrorE,
          pipelineResult.instantFeedback.closingErrorN,
          pipelineResult.area.squareMetres,
          pipelineResult.closureCheck.perimeter,
          projectId,
        ],
      );
    }

    // ── Return everything ──
    return NextResponse.json({
      ...pipelineResult,
      preSubmit: {
        ready: preSubmit.ready,
        score: preSubmit.score,
        summary: preSubmit.summary,
        blockers: preSubmit.blockers,
        warnings: preSubmit.warnings,
        categories: preSubmit.categories,
      },
    });
  } catch (err) {
    console.error('[Field-to-Finish] Error:', err);
    return NextResponse.json(
      { error: 'Pipeline failed', details: String(err) },
      { status: 500 },
    );
  }
}
