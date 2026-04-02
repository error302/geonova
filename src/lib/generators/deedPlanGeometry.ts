import { createClient } from '@/lib/supabase/client';
import { computePolygonArea } from '@/math/area';

export interface TraverseStation {
  station: string;
  bearing: number;
  distance: number;
  beaconNo?: string;
  monument?: string;
}

export interface AdjustedStation {
  station: string;
  easting: number;
  northing: number;
  beaconNo?: string;
  monument?: string;
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

function decimalToDMS(deg: number): string {
  const d = Math.floor(deg);
  const mRaw = (deg - d) * 60;
  const m = Math.floor(mRaw);
  const s = ((mRaw - m) * 60).toFixed(1);
  return `${String(d).padStart(3, '0')}°${String(m).padStart(2, '0')}'${s.padStart(4, '0')}"`;
}

export async function computeDeedPlanGeometry(
  projectId: string,
  supabase: ReturnType<typeof createClient>
): Promise<DeedPlanGeometry> {
  const { data: entries, error } = await supabase
    .from('project_fieldbook_entries')
    .select('row_index, station, raw_data')
    .eq('project_id', projectId)
    .order('row_index', { ascending: true });

  if (error) throw new Error('Failed to load fieldbook: ' + error.message);
  if (!entries || entries.length < 3) {
    throw new Error('Deed Plan requires at least 3 traverse stations. Add observations in the Field Book panel.');
  }

  const { data: project } = await supabase
    .from('projects')
    .select('boundary_data, utm_zone, hemisphere')
    .eq('id', projectId)
    .single();

  const legs: TraverseStation[] = entries
    .map((e) => ({
      station: String(e.station ?? e.raw_data?.station ?? ''),
      bearing: parseBearing(e.raw_data?.bearing ?? e.raw_data?.bs ?? 0),
      distance: parseFloat(String(e.raw_data?.distance ?? e.raw_data?.hd ?? '0')) || 0,
      beaconNo: String(e.raw_data?.beacon_no ?? ''),
      monument: String(e.raw_data?.monument_type ?? ''),
    }))
    .filter((l) => l.distance > 0);

  if (legs.length < 3) {
    throw new Error('Insufficient traverse data. Ensure bearing and distance are entered for each leg.');
  }

  const seed = project?.boundary_data as { startE?: number; startN?: number } | null;
  let E = seed?.startE ?? 0;
  let N = seed?.startN ?? 0;

  const rawCoords: { e: number; n: number; de: number; dn: number }[] = [];

  for (const leg of legs) {
    const bearingRad = (leg.bearing * Math.PI) / 180;
    const dE = leg.distance * Math.sin(bearingRad);
    const dN = leg.distance * Math.cos(bearingRad);
    E += dE;
    N += dN;
    rawCoords.push({ e: E, n: N, de: dE, dn: dN });
  }

  const closureE = E - (seed?.startE ?? 0);
  const closureN = N - (seed?.startN ?? 0);
  const closureLinear = Math.sqrt(closureE ** 2 + closureN ** 2);
  const totalDist = legs.reduce((s, l) => s + l.distance, 0);
  const misclosureMm = closureLinear * 1000;

  const ratio = totalDist > 0 && closureLinear > 0
    ? Math.round(totalDist / closureLinear)
    : 999999;
  const precisionRatio = `1:${ratio.toLocaleString()}`;

  const closureStatus: 'PASS' | 'FAIL' | 'UNVERIFIED' =
    ratio >= 5000 ? 'PASS' : ratio > 0 ? 'FAIL' : 'UNVERIFIED';

  const adjusted: AdjustedStation[] = [];
  let cumDist = 0;
  let adjE = seed?.startE ?? 0;
  let adjN = seed?.startN ?? 0;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    cumDist += leg.distance;
    const kE = closureLinear > 0 ? -(closureE / totalDist) * cumDist : 0;
    const kN = closureLinear > 0 ? -(closureN / totalDist) * cumDist : 0;
    adjE = rawCoords[i].e + kE + (seed?.startE ?? 0) - (rawCoords[0]?.e - rawCoords[0].de + kE);
    adjN = rawCoords[i].n + kN + (seed?.startN ?? 0) - (rawCoords[0]?.n - rawCoords[0].dn + kN);

    adjusted.push({
      station: leg.station,
      easting: parseFloat(adjE.toFixed(3)),
      northing: parseFloat(adjN.toFixed(3)),
      beaconNo: leg.beaconNo,
      monument: leg.monument,
    });
  }

  const pts = adjusted.map((s) => ({ e: s.easting, n: s.northing }));
  const areaM2 = computePolygonArea(pts);
  const areaHa = areaM2 / 10000;
  const areaAcres = areaHa * 2.47105;

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
      bearing: decimalToDMS(brg),
      distance: dist.toFixed(3),
    };
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
  };
}
