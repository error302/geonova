// METARDU Engine - Field data parser
import { NamedPoint3D } from './types';

export interface ParseResult {
  points: NamedPoint3D[];
  warnings: string[];
}

export interface ParseOptions {
  /** UTM zone (1-60). When provided, easting/northing are validated against
   *  the correct 6°-zone span (including negative eastings on the zone's west
   *  margin) instead of a naive 100000–900000 band. Default: no zone (range
   *  check disabled — caller may be parsing Cassini feet or a local grid). */
  utmZone?: number
}

/**
 * A UTM zone spans 6° of longitude ≈ 668 km at the equator, centered on the
 * 500,000 m false easting, so a valid in-zone easting falls in ~166,000–834,000.
 * Out-of-zone (neighbouring margin) coordinates can legitimately reach the full
 * 0–1,000,000 span, but a UTM easting is never negative and never exceeds
 * 1,000,000. Use that span as the hard physical bound so degree-typed mistakes
 * (e.g. 36.8) are caught while genuine projected coordinates are not.
 */
export function utmEastingRange(_zone: number): { min: number; max: number } {
  return { min: 0, max: 1_000_000 }
}

export function parseDelimitedFile(
  content: string,
  delimiter: string = ',',
  options: ParseOptions = {},
): ParseResult {
  const lines = content.trim().split('\n');
  const points: NamedPoint3D[] = [];
  const warnings: string[] = [];
  
  let startLine = 0;
  
  const firstLine = lines[0].toUpperCase();
  if (firstLine.includes('EASTING') || firstLine.includes('POINT') || firstLine.includes('NORTHING')) {
    startLine = 1;
  }
  
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(delimiter).map((p) => p.trim());
    
    let name = '';
    let easting = 0;
    let northing = 0;
    let elevation = 0;
    
    if (parts.length >= 3) {
      // Try to detect column order
      name = parts[0];
      easting = parseFloat(parts[1]);
      northing = parseFloat(parts[2]);
      if (parts.length >= 4) {
        elevation = parseFloat(parts[3]) || 0;
      }
    }
    
    if (isNaN(easting) || isNaN(northing)) {
      warnings.push(`Row ${i + 1}: Could not parse coordinates for point "${name}"`);
      continue;
    }
    
    if (options.utmZone !== undefined) {
      const { min, max } = utmEastingRange(options.utmZone)
      if (easting < min || easting > max) {
        warnings.push(`Row ${i + 1} (${name}): Easting ${easting} outside valid UTM zone ${options.utmZone} range (${min.toFixed(0)}-${max.toFixed(0)})`);
      }
    }
    
    points.push({ name, easting, northing, elevation });
  }
  
  return { points, warnings };
}

export function pointsToCSV(points: NamedPoint3D[]): string {
  const header = 'POINT,EASTING,NORTHING,ELEVATION\n';
  const rows = points.map((p) => `${p.name},${p.easting},${p.northing},${p.elevation}`).join('\n');
  return header + rows;
}

export function validatePoints(points: NamedPoint3D[], options: ParseOptions = {}): string[] {
  const warnings: string[] = [];
  const names = new Set<string>();
  
  for (const p of points) {
    if (names.has(p.name)) {
      warnings.push(`Duplicate point name: ${p.name}`);
    }
    names.add(p.name);
    
    if (options.utmZone !== undefined) {
      const { min, max } = utmEastingRange(options.utmZone)
      if (p.easting < min || p.easting > max) {
        warnings.push(`Point ${p.name}: Easting ${p.easting} outside valid UTM zone ${options.utmZone} range`);
      }
    }
  }
  
  return warnings;
}
