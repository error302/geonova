import { FieldBookRow } from '@/types/fieldbook';
import { SurveyType } from '@/types/project';

export interface FieldBookWarning {
  rowIndex?: number;
  column?: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface AutoCalculateResult {
  rows: FieldBookRow[];
  warnings: FieldBookWarning[];
}

function parseNumber(value: string | number | null | undefined): number | null {
  if (value === '' || value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

function calculateEngineeringRL(
  rows: FieldBookRow[],
  changedRowIndex: number
): FieldBookRow[] {
  const updated = [...rows];
  let hpc: number | null = null;

  for (let i = 0; i < updated.length; i++) {
    const row = { ...updated[i] };
    const bs = parseNumber(row.bs);
    const is = parseNumber(row.is);
    const fs = parseNumber(row.fs);
    const prevRL = i > 0 ? parseNumber(updated[i - 1].rl) : null;

    if (bs !== null && (prevRL !== null || i === 0)) {
      const openingRL = parseNumber(rows[0]?.rl) ?? 1000;
      hpc = openingRL + bs;
      row.hpc = hpc;
    }

    if (hpc !== null) {
      if (is !== null) {
        row.rl = hpc - is;
      } else if (fs !== null) {
        row.rl = hpc - fs;
      }
    }

    updated[i] = row;
  }

  return updated;
}

function calculateTopographicRL(
  rows: FieldBookRow[],
  changedRowIndex: number
): FieldBookRow[] {
  const updated = [...rows];

  for (let i = 0; i < updated.length; i++) {
    const row = { ...updated[i] };
    const hd = parseNumber(row.hd);
    const va = parseNumber(row.va);
    const instRL = parseNumber(row.rl);

    if (hd !== null && va !== null && instRL !== null) {
      const vaRad = (va * Math.PI) / 180;
      const vertDist = hd / Math.cos(vaRad);
      row.rl = instRL + vertDist * Math.sin(vaRad);
    }

    updated[i] = row;
  }

  return updated;
}

function calculateMiningVolume(
  rows: FieldBookRow[],
  changedRowIndex: number
): FieldBookRow[] {
  return [...rows];
}

export function applyAutoCalculations(
  surveyType: SurveyType,
  rows: FieldBookRow[],
  changedRowIndex: number
): FieldBookRow[] {
  switch (surveyType) {
    case 'engineering':
    case 'mining':
      return calculateEngineeringRL(rows, changedRowIndex);
    case 'topographic':
      return calculateTopographicRL(rows, changedRowIndex);
    default:
      return rows;
  }
}

export function validateFieldBook(
  surveyType: SurveyType,
  rows: FieldBookRow[]
): FieldBookWarning[] {
  const warnings: FieldBookWarning[] = [];

  switch (surveyType) {
    case 'cadastral': {
      rows.forEach((row, idx) => {
        const distance = parseNumber(row.distance);
        const bearing = parseNumber(row.bearing);
        if (distance !== null && distance <= 0) {
          warnings.push({ rowIndex: idx, column: 'distance', message: 'Distance must be > 0', severity: 'error' });
        }
        if (bearing !== null && (bearing < 0 || bearing > 360)) {
          warnings.push({ rowIndex: idx, column: 'bearing', message: 'Bearing must be 0-360°', severity: 'error' });
        }
      });
      break;
    }

    case 'engineering':
    case 'mining': {
      rows.forEach((row, idx) => {
        const bs = parseNumber(row.bs);
        const is = parseNumber(row.is);
        const fs = parseNumber(row.fs);
        if (bs !== null && fs !== null && bs !== 0 && fs !== 0) {
        }
        if (bs !== null && is !== null && bs !== 0 && is !== 0) {
          warnings.push({ rowIndex: idx, column: 'bs', message: 'BS and IS in same row', severity: 'warning' });
        }
      });
      break;
    }

    case 'drone': {
      if (rows.length < 5) {
        warnings.push({ message: 'Minimum 5 GCPs recommended', severity: 'warning' });
      }
      break;
    }

    case 'deformation': {
      const epochs = new Set(rows.map((r) => r.epoch).filter(Boolean));
      if (epochs.size < 2) {
        warnings.push({ message: 'Minimum 2 epochs required for comparison', severity: 'warning' });
      }
      break;
    }

    case 'hydrographic': {
      rows.forEach((row, idx) => {
        const tide = parseNumber(row.tide_reading);
        if (tide !== null && (tide < -5 || tide > 5)) {
          warnings.push({ rowIndex: idx, column: 'tide_reading', message: 'Tide correction unrealistic (-5 to +5m)', severity: 'warning' });
        }
      });
      break;
    }
  }

  return warnings;
}
