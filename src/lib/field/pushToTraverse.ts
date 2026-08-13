import proj4 from 'proj4';
import { FieldBeacon, TraverseStationInput } from '@/types/field';
import { SRID_21036, SRID_21037 } from '@/lib/map/projection'

// Define Kenya Arc 1960 UTM projections (Kenya's official cadastral datum)
proj4.defs(SRID_21036, '+proj=utm +zone=36 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs'); // Arc 1960 / UTM 36S
proj4.defs(SRID_21037, '+proj=utm +zone=37 +south +ellps=clrk80 +towgs84=-160,-6,-302,-0.807,0.339,-1.619,-2.554 +units=m +no_defs'); // Arc 1960 / UTM 37S

export type TargetCRS = typeof SRID_21036 | typeof SRID_21037;

// Determine best UTM zone for Kenya from longitude
export function detectUTMZone(lng: number): TargetCRS {
  return lng < 36.0 ? SRID_21036 : SRID_21037;
}

export function beaconsToTraverseStations(
  beacons: FieldBeacon[],
  targetCRS?: TargetCRS
): TraverseStationInput[] {
  return beacons.map(b => {
    const crs = targetCRS ?? detectUTMZone(b.coordinate.lng);
    const [easting, northing] = proj4('EPSG:4326', crs, [b.coordinate.lng, b.coordinate.lat]);
    return {
      id: b.id,
      label: b.label,
      easting: parseFloat(easting.toFixed(3)),
      northing: parseFloat(northing.toFixed(3)),
      elevation: b.coordinate.altitude ?? undefined,
      coordinateSystem: crs === SRID_21036 ? 'Arc1960_36S' : 'Arc1960_37S',
    };
  });
}

// Encode stations into URL search params for /tools/traverse-field-book
export function buildTraverseURL(stations: TraverseStationInput[]): string {
  const payload = encodeURIComponent(JSON.stringify(stations));
  return `/tools/traverse-field-book?field_import=${payload}`;
}
