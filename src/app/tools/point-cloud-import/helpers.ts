import { MAX_POINTS } from './constants';
import type { ColumnMapping, ImportedPoint, ParseError } from './types';

export function fmt(n: number, d: number = 4): string {
  return n.toFixed(d);
}

export function detectDelimiter(text: string): string {
  const firstLines = text.split('\n').slice(0, 5);
  let commaCount = 0;
  let tabCount = 0;
  let semicolonCount = 0;
  let spaceCount = 0;

  for (const line of firstLines) {
    if (line.startsWith('#') || line.trim() === '') continue;
    commaCount += (line.match(/,/g) || []).length;
    tabCount += (line.match(/\t/g) || []).length;
    semicolonCount += (line.match(/;/g) || []).length;
    spaceCount += (line.match(/ {2,}/g) || []).length;
  }

  const counts: [string, number][] = [
    ['\t', tabCount],
    [',', commaCount],
    [';', semicolonCount],
    [' ', spaceCount],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

export function isHeaderLine(line: string): boolean {
  const lower = line.toLowerCase();
  const headerKeywords = [
    'easting', 'northing', 'elevation', 'name', 'point', 'id',
    'x', 'y', 'z', 'e', 'n', 'rl', 'height', 'lat', 'lon',
  ];
  const tokens = lower.split(/[\t,; ]+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  // If more than half the tokens are header-like keywords, it's a header
  const matchCount = tokens.filter(t =>
    headerKeywords.some(kw => t === kw || t.includes(kw))
  ).length;
  return matchCount >= Math.ceil(tokens.length * 0.5);
}

export function guessColumnIndices(headers: string[]): ColumnMapping {
  const lower = headers.map(h => h.toLowerCase().trim());

  const eastingIdx = lower.findIndex(h =>
    h === 'easting' || h === 'e' || h === 'x' || h.includes('east') || h.includes('easting')
  );
  const northingIdx = lower.findIndex(h =>
    h === 'northing' || h === 'n' || h === 'y' || h.includes('north') || h.includes('northing')
  );
  const elevIdx = lower.findIndex(h =>
    h === 'elevation' || h === 'z' || h === 'rl' || h === 'height' ||
    h.includes('elev') || h.includes('height') || h === 'level'
  );
  const nameIdx = lower.findIndex(h =>
    h === 'name' || h === 'id' || h === 'point' || h === 'pointname' ||
    h === 'point_name' || h === 'code' || h.includes('name') || h.includes('id')
  );

  return {
    id: lower.indexOf('id') >= 0 ? lower.indexOf('id') : -1,
    easting: eastingIdx >= 0 ? eastingIdx : 0,
    northing: northingIdx >= 0 ? northingIdx : 1,
    elevation: elevIdx >= 0 ? elevIdx : 2,
    name: nameIdx >= 0 ? nameIdx : -1,
  };
}

export function parseXYZText(text: string): {
  points: ImportedPoint[];
  errors: ParseError[];
  totalLines: number;
  delimiter: string;
  hasHeader: boolean;
} {
  const delimiter = detectDelimiter(text);
  const lines = text.split('\n');
  const errors: ParseError[] = [];
  const points: ImportedPoint[] = [];
  const splitRe = delimiter === ' ' ? /\s+/ : new RegExp(`(?:${delimiter === '\t' ? '\\t' : delimiter})+`);
  let startIdx = 0;
  let hasHeader = false;

  // Detect header
  if (lines.length > 0 && isHeaderLine(lines[0])) {
    hasHeader = true;
    startIdx = 1;
  }

  // Detect comment lines
  while (startIdx < lines.length && lines[startIdx].trim().startsWith('#')) {
    startIdx++;
  }

  let colMapping: ColumnMapping | null = null;
  if (hasHeader) {
    const headers = lines[0].split(splitRe).map(h => h.trim());
    colMapping = guessColumnIndices(headers);
  }

  // Check the first data row to determine column count
  const firstDataRowIdx = startIdx;
  let colCount = 3;
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(splitRe);
    if (parts.length >= 3) {
      colCount = parts.length;
      break;
    }
  }

  // Default column mapping for 3-column data
  if (!colMapping) {
    if (colCount === 3) {
      colMapping = { id: -1, easting: 0, northing: 1, elevation: 2, name: -1 };
    } else if (colCount >= 4) {
      colMapping = { id: -1, easting: 1, northing: 2, elevation: 3, name: 0 };
    }
  }

  for (let i = startIdx; i < lines.length && points.length < MAX_POINTS; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(splitRe).map(s => s.trim());

    if (parts.length < 3) {
      errors.push({ row: i + 1, message: `Too few columns (${parts.length})` });
      continue;
    }

    if (!colMapping) {
      errors.push({ row: i + 1, message: 'Column mapping not resolved' });
      continue;
    }
    const mapping = colMapping;
    const eIdx = mapping.easting;
    const nIdx = mapping.northing;
    const zIdx = mapping.elevation;
    const nameIdx = mapping.name;

    const easting = parseFloat(parts[eIdx]);
    const northing = parseFloat(parts[nIdx]);
    const elevation = parseFloat(parts[zIdx]);

    if (isNaN(easting) || isNaN(northing) || isNaN(elevation)) {
      errors.push({ row: i + 1, message: 'Non-numeric coordinate value' });
      continue;
    }

    const pointName = nameIdx >= 0 && nameIdx < parts.length
      ? parts[nameIdx]
      : `P${points.length + 1}`;

    points.push({
      id: `pt-${points.length}`,
      name: pointName,
      easting,
      northing,
      elevation,
    });
  }

  return {
    points,
    errors: errors.slice(0, 50), // Cap displayed errors
    totalLines: lines.length,
    delimiter,
    hasHeader,
  };
}

export function downloadCSV(filename: string, csvString: string) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
