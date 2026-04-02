import { bowditchAdjustment, forwardTraverse, ForwardTraverseInput, TraverseInput } from '@/lib/engine/traverse';
import { NamedPoint2D } from '@/lib/engine/types';
import { FieldBookRow } from '@/types/fieldbook';

export interface TraverseComputeInput {
  rows: FieldBookRow[];
  startPoint: NamedPoint2D;
  closingPoint?: NamedPoint2D;
}

function parseBearingDMS(bearingStr: string): number {
  if (!bearingStr) return 0;
  const match = bearingStr.match(/(\d+)[°](\d+)['"]?/);
  if (!match) return Number(bearingStr) || 0;
  const deg = Number(match[1]);
  const min = Number(match[2]);
  return deg + min / 60;
}

function parseTraverseRows(rows: FieldBookRow[]): {
  stations: string[];
  distances: number[];
  bearings: number[];
  points: NamedPoint2D[];
} {
  const stations: string[] = [];
  const distances: number[] = [];
  const bearings: number[] = [];
  const points: NamedPoint2D[] = [];

  for (const row of rows) {
    if (row.station && row.distance && row.bearing) {
      const station = String(row.station);
      const distance = Number(row.distance);
      const bearing = parseBearingDMS(String(row.bearing));

      if (station && distance > 0 && bearing >= 0) {
        stations.push(station);
        distances.push(distance);
        bearings.push(bearing);
        points.push({ name: station, easting: 0, northing: 0 });
      }
    }
  }

  return { stations, distances, bearings, points };
}

export function runForwardTraverse(input: TraverseComputeInput): ReturnType<typeof forwardTraverse> {
  const { stations, distances, bearings, points } = parseTraverseRows(input.rows);

  const forwardInput: ForwardTraverseInput = {
    start: input.startPoint,
    stations,
    distances,
    bearings,
  };

  return forwardTraverse(forwardInput);
}

export function runBowditchAdjustment(input: TraverseComputeInput): ReturnType<typeof bowditchAdjustment> {
  const { stations, distances, bearings, points } = parseTraverseRows(input.rows);

  if (points.length === 0) {
    throw new Error('No valid traverse legs found in field book');
  }

  const traverseInput: TraverseInput = {
    points: [input.startPoint, ...points],
    distances,
    bearings,
    closingPoint: input.closingPoint,
  };

  return bowditchAdjustment(traverseInput);
}

export function getTraversePrecisionStatus(result: ReturnType<typeof bowditchAdjustment>): {
  status: 'excellent' | 'good' | 'acceptable' | 'poor';
  message: string;
  ratio: string;
} {
  const ratio = result.precisionRatio;
  const ratioStr = `1/${Math.round(1 / ratio)}`;

  const grade = result.precisionGrade;
  const errorMm = result.linearError * 1000;

  let message = '';
  switch (grade) {
    case 'excellent':
      message = `Excellent closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm)`;
      break;
    case 'good':
      message = `Good closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm)`;
      break;
    case 'acceptable':
      message = `Acceptable closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm)`;
      break;
    case 'poor':
      message = `Poor closure: ${ratioStr} (error ${errorMm.toFixed(1)}mm) - needs re-observation`;
      break;
  }

  return { status: grade, message, ratio: ratioStr };
}
