export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/apiHandler';
import { db } from '@/lib/db';
import { generateIFC4 } from '@/lib/export/generateIFC';
import type { IFCExportOptions, IFCParcel, IFCControlPoint, IFCTraverseLine, IFCEquipmentRecord } from '@/types/ifc';

interface IFCProjectRow {
  name: string;
  utm_zone?: number | null;
  hemisphere?: string | null;
  datum?: string | null;
  survey_type?: string | null;
  client_name?: string | null;
  surveyor_name?: string | null;
  surveyor_license?: string | null;
}

/**
 * GET /api/project/[id]/export/ifc?format=ifc4
 *
 * Reads all survey / cadastral data for the given project from the database
 * and returns a complete IFC4 STEP file as an attachment download.
 *
 * Query parameters:
 *   format  – must be "ifc4" (default if omitted)
 *
 * Response headers:
 *   Content-Type:        application/x-step
 *   Content-Disposition: attachment; filename="<project>_export.ifc"
 */
export const GET = apiHandler({ auth: true, rateLimit: { max: 60, windowMs: 60000 } }, async (_req, ctx) => {
  const { id } = ctx.params;

  // ── Fetch project row ──────────────────────────────────────────────────
  const { rows: projRows } = await db.query<IFCProjectRow>(
    `SELECT name, utm_zone, hemisphere, datum, survey_type,
            client_name, surveyor_name, surveyor_license
       FROM projects WHERE id = $1 AND user_id = $2`,
    [id, ctx.userId],
  );

  if (projRows.length === 0) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const proj = projRows[0];

  // ── Fetch survey control points ────────────────────────────────────────
  const { rows: cpRows } = await db.query(
    `SELECT id, name AS label, easting, northing, elevation,
            beacon_type, description
       FROM survey_points
      WHERE project_id = $1 AND is_control = true
      ORDER BY name`,
    [id],
  );

  // ── Fetch parcel polygons ──────────────────────────────────────────────
  const { rows: parcelRows } = await db.query(
    `SELECT p.id, p.label, p.parcel_number, p.area_m2,
            (
              SELECT jsonb_agg(
                jsonb_build_object('easting', pv.easting, 'northing', pv.northing, 'elevation', pv.elevation)
                ORDER BY pv.vertex_order
              )
              FROM parcel_vertices pv WHERE pv.parcel_id = p.id
            ) AS vertices
       FROM parcels p
      WHERE p.project_id = $1
      ORDER BY p.label`,
    [id],
  );

  // ── Fetch traverse lines ───────────────────────────────────────────────
  const { rows: traverseRows } = await db.query(
    `SELECT ts.from_point, ts.to_point, ts.distance
       FROM traverse_stations ts
      WHERE ts.project_id = $1
      ORDER BY ts.id`,
    [id],
  );

  // ── Fetch equipment records ────────────────────────────────────────────
  const { rows: equipRows } = await db.query(
    `SELECT id, make, model, serial_number, last_calibration_date
       FROM equipment
      WHERE user_id = $1
      ORDER BY make, model`,
    [ctx.userId],
  );

  // ── Build IFC export options ──────────────────────────────────────────

  // Derive EPSG code from UTM zone + hemisphere
  const utmZone = proj.utm_zone ?? 37;
  const hemisphere = (proj.hemisphere ?? 'S').toUpperCase();
  const epsgCode = hemisphere === 'N' ? 32600 + utmZone : 32700 + utmZone;

  const parcels: IFCParcel[] = (parcelRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    label: (r.label as string) ?? r.parcel_number ?? 'Unnamed',
    vertices: (Array.isArray(r.vertices) ? r.vertices : []) as IFCParcel['vertices'],
    areaM2: (r.area_m2 as number) ?? undefined,
    parcelNumber: (r.parcel_number as string) ?? undefined,
  }));

  const controlPoints: IFCControlPoint[] = (cpRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    label: (r.label as string) ?? (r.name as string) ?? '',
    easting: r.easting as number,
    northing: r.northing as number,
    elevation: (r.elevation as number) ?? undefined,
    beaconType: (r.beacon_type as string) ?? undefined,
    description: (r.description as string) ?? undefined,
  }));

  const traverseLines: IFCTraverseLine[] = (traverseRows ?? []).map((r: Record<string, unknown>) => ({
    fromPoint: (r.from_point as string) ?? '',
    toPoint: (r.to_point as string) ?? '',
    distance: (r.distance as number) ?? undefined,
  }));

  const equipment: IFCEquipmentRecord[] = (equipRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    make: (r.make as string) ?? '',
    model: (r.model as string) ?? '',
    serialNumber: (r.serial_number as string) ?? undefined,
    lastCalibration: (r.last_calibration_date as string) ?? undefined,
  }));

  const ifcOpts: IFCExportOptions = {
    projectName: proj.name,
    projectNumber: proj.name,
    surveyorName: (proj.surveyor_name as string) ?? undefined,
    surveyorLicense: (proj.surveyor_license as string) ?? undefined,
    coordinateSystem: `UTM_${utmZone}${hemisphere}`,
    epsgCode,
    parcels: parcels.length > 0 ? parcels : undefined,
    controlPoints: controlPoints.length > 0 ? controlPoints : undefined,
    traverseLines: traverseLines.length > 0 ? traverseLines : undefined,
    equipment: equipment.length > 0 ? equipment : undefined,
  };

  // ── Generate IFC4 content ─────────────────────────────────────────────
  const ifcContent = generateIFC4(ifcOpts);

  const safeName = proj.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const filename = `${safeName}_export.ifc`;

  return new NextResponse(ifcContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-step',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(Buffer.byteLength(ifcContent, 'utf-8')),
    },
  });
});
