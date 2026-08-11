import db from '@/lib/db';
import { coordinateArea } from '@/lib/engine/area';
import { bowditchAdjustment } from '@/lib/engine/traverse';
import { bearingToString } from '@/lib/engine/angles';
import type { NamedPoint2D } from '@/lib/engine/types';
import { computeLineScaleFactor, computeUTMPointScaleFactor } from '@/lib/survey/adapter';
import type { LineScaleFactorResult } from '@/lib/survey/adapter';

export interface TraverseStation {
  station: string;
  bearing: number;
  distance: number;
  beaconNo?: string;
  monument?: string;
  markStatus?: string;
}

export interface AdjustedStation {
  station: string;
  easting: number;
  northing: number;
  beaconNo?: string;
  monument?: string;
  markStatus?: string;
}

export interface BearingLeg {
  from: string;
  to: string;
  bearing: string;
  distance: string;
}

export interface DeedPlanGeometry {
  stations: AdjustedStation[];
  bearingSchedule: BearingLeg[];
  areaM2: number;
  areaHa: number;
  areaAcres: number;
  misclosureMm: number;
  precisionRatio: string;
  closureStatus: 'PASS' | 'FAIL' | 'UNVERIFIED';
  minE: number;
  maxE: number;
  minN: number;
  maxN: number;
  /** Source of the coordinates — tracks whether pre-adjusted or independently computed */
  coordinateSource: 'pre_adjusted' | 'computed';
  /** Line scale factor for each boundary leg (survey engine, Simpson's rule) */
  lineScaleFactors?: Array<{
    from: string;
    to: string;
    scaleFactor: number;
    ppmFromUnity: number;
    gridDistance: number;
    ellipsoidalDistance: number;
  }>;
  /** UTM projection used for scale factor computation */
  projection?: 'UTM36S' | 'UTM37S';
}

/**
 * Pre-adjusted coordinates from an external source (e.g. traverse_coordinates
 * table, or a TraverseComputationResult). When provided to
 * computeDeedPlanGeometry(), the function skips independent Bowditch
 * computation and uses these coordinates directly — guaranteeing 100%
 * consistency with the traverse computation sheet.
 */
export interface PreAdjustedCoordinate {
  station: string;
  easting: number;
  northing: number;
  beaconNo?: string;
  monument?: string;
  markStatus?: string;
}

export interface PreAdjustedClosure {
  misclosureMm: number;
  precisionRatio: number;
}

export interface ComputeDeedPlanGeometryOptions {
  /**
   * Pre-adjusted traverse coordinates from an authoritative source.
   * When provided, computeDeedPlanGeometry() will use these coordinates
   * directly instead of recomputing from raw field book entries.
   * This ensures single-source-of-truth consistency with the traverse
   * computation sheet and all other output documents.
   */
  preAdjustedCoordinates?: PreAdjustedCoordinate[];
  /** Closure metrics corresponding to the pre-adjusted coordinates */
  preAdjustedClosure?: PreAdjustedClosure;
}

function parseBearing(raw: string | number): number {
  if (typeof raw === 'number') return raw;
  const dmsMatch = String(raw).match(/(\d+)[°\-\s](\d+)['\-\s](\d+\.?\d*)/);
  if (dmsMatch) {
    const [, d, m, s] = dmsMatch.map(Number);
    return d + m / 60 + s / 3600;
  }
  return parseFloat(String(raw)) || 0;
}


export async function computeDeedPlanGeometry(
  projectId: string,
  options?: ComputeDeedPlanGeometryOptions
): Promise<DeedPlanGeometry> {
  // ── Path A: Use pre-adjusted coordinates from an authoritative source ──
  // When the caller has already computed adjusted traverse coordinates (e.g.
  // from the traverse computation sheet or the traverse_coordinates table),
  // use them directly. This guarantees 100% consistency between all output
  // documents — the deed plan, computation sheet, Form C22, and DXF all
  // derive from the same adjusted coordinates.
  if (options?.preAdjustedCoordinates && options.preAdjustedCoordinates.length >= 3) {
    return buildFromPreAdjusted(options.preAdjustedCoordinates, options.preAdjustedClosure);
  }

  // ── Path B: Try to load pre-adjusted coordinates from the DB ──
  // If the project has a saved traverse with adjusted coordinates in the
  // traverse_coordinates table, use those instead of recomputing.
  const savedCoords = await loadPreAdjustedFromDB(projectId);
  if (savedCoords) {
    return buildFromPreAdjusted(savedCoords.stations, savedCoords.closure);
  }

  // ── Path C: Compute from raw field book entries (fallback) ──
  return computeFromFieldBook(projectId);
}

/**
 * Build DeedPlanGeometry from pre-adjusted coordinates.
 * Bearings and distances are RECOMPUTED from the adjusted coordinates to
 * ensure the bearing schedule is consistent with the coordinate schedule.
 */
function buildFromPreAdjusted(
  coords: PreAdjustedCoordinate[],
  closure?: PreAdjustedClosure
): DeedPlanGeometry {
  const adjusted: AdjustedStation[] = coords.map(c => ({
    station: c.station,
    easting: c.easting,
    northing: c.northing,
    beaconNo: c.beaconNo,
    monument: c.monument,
    markStatus: c.markStatus,
  }));

  // Compute area from adjusted coordinates (Shoelace formula)
  const pts = adjusted.map((s) => ({ easting: s.easting, northing: s.northing }));
  const areaResult = coordinateArea(pts);

  // Bearing schedule recomputed from adjusted positions — ensures consistency
  // Now includes grid scale factors from the survey engine (Simpson's rule)
  const projection: 'UTM36S' | 'UTM37S' = 'UTM37S'; // Default for Kenya
  const bearingSchedule: BearingLeg[] = adjusted.map((st, i) => {
    const next = adjusted[(i + 1) % adjusted.length];
    const dE = next.easting - st.easting;
    const dN = next.northing - st.northing;
    let brg = (Math.atan2(dE, dN) * 180) / Math.PI;
    if (brg < 0) brg += 360;
    const dist = Math.sqrt(dE ** 2 + dN ** 2);
    return {
      from: st.station,
      to: next.station,
      bearing: bearingToString(brg),
      distance: dist.toFixed(3),
    };
  });

  // Compute line scale factors using the survey engine's Simpson's rule
  const lineScaleFactors = adjusted.map((st, i) => {
    const next = adjusted[(i + 1) % adjusted.length];
    try {
      const sfResult = computeLineScaleFactor(
        st.easting, st.northing,
        next.easting, next.northing,
        projection
      );
      return {
        from: st.station,
        to: next.station,
        scaleFactor: sfResult.lineScaleFactor,
        ppmFromUnity: sfResult.ppmCorrection,
        gridDistance: sfResult.gridDistance,
        ellipsoidalDistance: sfResult.ellipsoidalDistance,
      };
    } catch {
      return {
        from: st.station,
        to: next.station,
        scaleFactor: 1.0,
        ppmFromUnity: 0,
        gridDistance: 0,
        ellipsoidalDistance: 0,
      };
    }
  });

  const eastings = adjusted.map((s) => s.easting);
  const northings = adjusted.map((s) => s.northing);

  const misclosureMm = closure?.misclosureMm ?? 0;
  const ratio = closure?.precisionRatio ?? Infinity;
  const precisionRatio = ratio === Infinity ? '1:∞' : `1:${Math.round(ratio).toLocaleString()}`;
  const closureStatus: 'PASS' | 'FAIL' | 'UNVERIFIED' =
    ratio >= 5000 ? 'PASS' : ratio > 0 && ratio < Infinity ? 'FAIL' : 'UNVERIFIED';

  return {
    stations: adjusted,
    bearingSchedule,
    areaM2: areaResult.areaSqm,
    areaHa: areaResult.areaHa,
    areaAcres: areaResult.areaAcres,
    misclosureMm,
    precisionRatio,
    closureStatus,
    minE: Math.min(...eastings),
    maxE: Math.max(...eastings),
    minN: Math.min(...northings),
    maxN: Math.max(...northings),
    coordinateSource: 'pre_adjusted',
    lineScaleFactors,
    projection,
  };
}

/**
 * Attempt to load pre-adjusted coordinates from the traverse_coordinates
 * table. Returns null if no saved traverse exists.
 *
 * Also queries the field book entries for beacon descriptions (monument type,
 * mark status, beacon number) so that the DeedPlanGeometry includes rich
 * beacon metadata — matching the behaviour of the external helper in
 * deedPlan.ts.
 */
export async function loadPreAdjustedFromDB(
  projectId: string
): Promise<{ stations: PreAdjustedCoordinate[]; closure: PreAdjustedClosure } | null> {
  try {
    // Find the most recent traverse for this project via parcels
    const traverseRes = await db.query<{ id: string; linear_misclosure: number | null; precision_ratio: number | null }>(
      `SELECT pt.id, pt.linear_misclosure, pt.precision_ratio
       FROM parcel_traverses pt
       JOIN parcels p ON p.id = pt.parcel_id
       JOIN blocks b ON b.id = p.block_id
       WHERE b.project_id = $1
       ORDER BY pt.created_at DESC LIMIT 1`,
      [projectId]
    );

    if (traverseRes.rows.length === 0) return null;

    const traverse = traverseRes.rows[0];
    const traverseId = traverse.id;

    const coordsRes = await db.query(
      'SELECT station, easting, northing, rl FROM traverse_coordinates WHERE traverse_id = $1 ORDER BY station',
      [traverseId]
    );

    if (coordsRes.rows.length < 3) return null;

    // Also try to get beacon info from field book entries for richer metadata
    const beaconLookup = new Map<string, { beaconNo: string; monument: string; markStatus: string }>();
    try {
      const fbRes = await db.query<{ station: string; raw_data: Record<string, unknown> | null }>(
        'SELECT station, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
        [projectId]
      );
      for (const row of fbRes.rows) {
        const raw = row.raw_data as Record<string, unknown> | null;
        if (row.station && raw) {
          beaconLookup.set(String(row.station), {
            beaconNo: String(raw.beacon_no ?? ''),
            monument: String(raw.monument_type ?? ''),
            markStatus: String(raw.mark_status ?? raw.monument_status ?? 'FOUND'),
          });
        }
      }
    } catch {
      // Field book table may not exist — proceed with defaults
    }

    const stations: PreAdjustedCoordinate[] = coordsRes.rows.map((c: Record<string, unknown>) => {
      const stn = String(c.station);
      const beacon = beaconLookup.get(stn);
      return {
        station: stn,
        easting: parseFloat(String(c.easting)),
        northing: parseFloat(String(c.northing)),
        beaconNo: beacon?.beaconNo || stn,
        monument: beacon?.monument || 'psc found',
        markStatus: beacon?.markStatus || 'FOUND',
      };
    });

    const closure: PreAdjustedClosure = {
      misclosureMm: parseFloat(String(traverse.linear_misclosure ?? 0)) * 1000,
      precisionRatio: parseFloat(String(traverse.precision_ratio ?? 0)) || Infinity,
    };

    return { stations, closure };
  } catch {
    // Table may not exist in all deployments — fall back gracefully
    return null;
  }
}

/**
 * Compute DeedPlanGeometry from raw field book entries using Bowditch
 * adjustment. This is the fallback path when no pre-adjusted coordinates
 * are available.
 */
async function computeFromFieldBook(projectId: string): Promise<DeedPlanGeometry> {
  const entriesRes = await db.query<{ row_index: number; station: string; raw_data: Record<string, unknown> }>(
    'SELECT row_index, station, raw_data FROM project_fieldbook_entries WHERE project_id = $1 ORDER BY row_index ASC',
    [projectId]
  );
  const entries = entriesRes.rows;

  if (!entries || entries.length < 3) {
    throw new Error('Deed Plan requires at least 3 traverse stations. Add observations in the Field Book panel.');
  }

  const projectRes = await db.query<{ boundary_data: Record<string, unknown> | null; utm_zone: number | null; hemisphere: string | null }>(
    'SELECT boundary_data, utm_zone, hemisphere FROM projects WHERE id = $1',
    [projectId]
  );
  const project = projectRes.rows[0];

  const legs: TraverseStation[] = entries
    .map((e: { row_index: number; station: string; raw_data: Record<string, unknown> }) => ({
      station: String(e.station ?? e.raw_data?.station ?? ''),
      bearing: parseBearing(String(e.raw_data?.bearing ?? e.raw_data?.bs ?? 0)),
      distance: parseFloat(String(e.raw_data?.distance ?? e.raw_data?.hd ?? '0')) || 0,
      beaconNo: String(e.raw_data?.beacon_no ?? ''),
      monument: String(e.raw_data?.monument_type ?? ''),
      markStatus: String(e.raw_data?.mark_status ?? e.raw_data?.monument_status ?? 'FOUND'),
    }))
    .filter((l) => l.distance > 0);

  if (legs.length < 3) {
    throw new Error('Insufficient traverse data. Ensure bearing and distance are entered for each leg.');
  }

  // Use boundary seed as starting coordinate
  const seed = project?.boundary_data as { startE?: number; startN?: number } | null;
  const startE = seed?.startE ?? 0;
  const startN = seed?.startN ?? 0;

  // Build the traverse input for the engine's Bowditch adjustment
  // This ensures the deed plan uses the SAME adjusted coordinates as the
  // traverse computation sheet — single source of truth for all outputs.
  // Source: Ghilani & Wolf Ch.12 — Bowditch (Compass) Rule
  const startPoint: NamedPoint2D = { name: legs[0].station, easting: startE, northing: startN };
  const traversePoints: NamedPoint2D[] = legs.map(l => ({ name: l.station, easting: 0, northing: 0 }));

  const traverseResult = bowditchAdjustment({
    points: [startPoint, ...traversePoints],
    distances: legs.map(l => l.distance),
    bearings: legs.map(l => l.bearing),
    closingPoint: { easting: startE, northing: startN },
  });

  // Extract adjusted coordinates from the engine result
  const adjusted: AdjustedStation[] = traverseResult.legs.map((leg, i) => ({
    station: legs[i].station,
    easting: leg.adjEasting,
    northing: leg.adjNorthing,
    beaconNo: legs[i].beaconNo,
    monument: legs[i].monument,
    markStatus: legs[i].markStatus,
  }));

  // Compute area from adjusted coordinates (Shoelace formula)
  const pts = adjusted.map((s) => ({ easting: s.easting, northing: s.northing }));
  const areaResult = coordinateArea(pts);
  const areaM2 = areaResult.areaSqm;
  const areaHa = areaResult.areaHa;
  const areaAcres = areaResult.areaAcres;

  // Closure metrics from the engine result
  const misclosureMm = traverseResult.linearError * 1000;
  const ratio = traverseResult.precisionRatio;
  const precisionRatio = `1:${Math.round(ratio).toLocaleString()}`;
  const closureStatus: 'PASS' | 'FAIL' | 'UNVERIFIED' =
    ratio >= 5000 ? 'PASS' : ratio > 0 ? 'FAIL' : 'UNVERIFIED';

  // Bearing schedule from adjusted coordinates — bearings are recomputed from
  // the adjusted positions to ensure consistency with the coordinate schedule
  // Now includes grid scale factors from the survey engine (Simpson's rule)
  const projection: 'UTM36S' | 'UTM37S' = 'UTM37S'; // Default for Kenya
  const bearingSchedule: BearingLeg[] = adjusted.map((st, i) => {
    const next = adjusted[(i + 1) % adjusted.length];
    const dE = next.easting - st.easting;
    const dN = next.northing - st.northing;
    let brg = (Math.atan2(dE, dN) * 180) / Math.PI;
    if (brg < 0) brg += 360;
    const dist = Math.sqrt(dE ** 2 + dN ** 2);
    return {
      from: st.station,
      to: next.station,
      bearing: bearingToString(brg),
      distance: dist.toFixed(3),
    };
  });

  // Compute line scale factors using the survey engine's Simpson's rule
  const lineScaleFactors = adjusted.map((st, i) => {
    const next = adjusted[(i + 1) % adjusted.length];
    try {
      const sfResult = computeLineScaleFactor(
        st.easting, st.northing,
        next.easting, next.northing,
        projection
      );
      return {
        from: st.station,
        to: next.station,
        scaleFactor: sfResult.lineScaleFactor,
        ppmFromUnity: sfResult.ppmCorrection,
        gridDistance: sfResult.gridDistance,
        ellipsoidalDistance: sfResult.ellipsoidalDistance,
      };
    } catch {
      return {
        from: st.station,
        to: next.station,
        scaleFactor: 1.0,
        ppmFromUnity: 0,
        gridDistance: 0,
        ellipsoidalDistance: 0,
      };
    }
  });

  const eastings = adjusted.map((s) => s.easting);
  const northings = adjusted.map((s) => s.northing);

  return {
    stations: adjusted,
    bearingSchedule,
    areaM2,
    areaHa,
    areaAcres,
    misclosureMm,
    precisionRatio,
    closureStatus,
    minE: Math.min(...eastings),
    maxE: Math.max(...eastings),
    minN: Math.min(...northings),
    maxN: Math.max(...northings),
    coordinateSource: 'computed',
    lineScaleFactors,
    projection,
  };
}
