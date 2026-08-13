// Helper utilities for parsing residual tables and computing RMSE / validation
// summaries.
//
// Extracted from src/app/tools/gcp-validation/page.tsx — pure functions,
// no React, no hooks, so this file does not need 'use client'.

import type {
  AccuracyClass,
  KnownGCP,
  ResidualFormat,
  ResidualRow,
  ValidationResult,
  ValidationSummary,
} from './types';

export function fmt(n: number, d: number = 4): string {
  return n.toFixed(d);
}

export function calculateRMSE(errors: number[]): number {
  if (errors.length === 0) return 0;
  const sumSquared = errors.reduce((sum, e) => sum + e * e, 0);
  return Math.sqrt(sumSquared / errors.length);
}

export function detectFormat(text: string): ResidualFormat {
  const trimmed = text.trim().toLowerCase();
  if (trimmed.includes('#point') || trimmed.includes('#metashape')) return 'agisoft';
  if (trimmed.includes('gcp_name') && trimmed.includes('errortotal')) return 'pix4d';
  // Fallback: if it has a lot of tab-separated fields, guess Agisoft; if comma, Pix4D
  const lines = trimmed.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) return 'auto';
  const firstDataLine = lines[0];
  const tabCount = (firstDataLine.match(/\t/g) || []).length;
  const commaCount = (firstDataLine.match(/,/g) || []).length;
  if (tabCount >= 3 && commaCount < 2) return 'agisoft';
  if (commaCount >= 5) return 'pix4d';
  return 'auto';
}

export function parseAgisoft(text: string): ResidualRow[] {
  const rows: ResidualRow[] = [];
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Agisoft format: name  x  y  z  error  (whitespace or tab separated)
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 5) {
      const name = parts[0];
      const softwareE = parseFloat(parts[1]);
      const softwareN = parseFloat(parts[2]);
      const softwareZ = parseFloat(parts[3]);
      const reprojError = parseFloat(parts[4]);
      if (!isNaN(softwareE) && !isNaN(softwareN) && !isNaN(softwareZ)) {
        rows.push({
          id: Date.now() + Math.random(),
          name,
          softwareE,
          softwareN,
          softwareZ,
          reprojectionError: isNaN(reprojError) ? undefined : reprojError,
          source: 'agisoft',
        });
      }
    }
  }
  return rows;
}

export function parsePix4D(text: string): ResidualRow[] {
  const rows: ResidualRow[] = [];
  const lines = text.trim().split('\n');
  let headerParsed = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip header row
    if (!headerParsed) {
      headerParsed = true;
      if (trimmed.toLowerCase().startsWith('gcp_name')) continue;
    }
    const parts = trimmed.split(',').map(s => s.trim());
    // Minimum expected: GCP_Name, X_photo, Y_photo, Z_photo, X_GCP, Y_GCP, Z_GCP, ErrorX, ErrorY, ErrorZ, ErrorXY, ErrorTotal
    if (parts.length >= 11) {
      const name = parts[0];
      // Pix4D columns: software coords in X_GCP, Y_GCP, Z_GCP (indices 4,5,6)
      // OR in X_photo, Y_photo, Z_photo (indices 1,2,3) - we take the GCP columns
      const softwareE = parseFloat(parts[4]);
      const softwareN = parseFloat(parts[5]);
      const softwareZ = parseFloat(parts[6]);
      const errorX = parseFloat(parts[7]);
      const errorY = parseFloat(parts[8]);
      const errorZ = parseFloat(parts[9]);
      const errorXY = parseFloat(parts[10]);
      const errorTotal = parts.length >= 12 ? parseFloat(parts[11]) : undefined;
      if (!isNaN(softwareE) && !isNaN(softwareN) && !isNaN(softwareZ)) {
        rows.push({
          id: Date.now() + Math.random(),
          name,
          softwareE,
          softwareN,
          softwareZ,
          errorX: isNaN(errorX) ? undefined : errorX,
          errorY: isNaN(errorY) ? undefined : errorY,
          errorZ: isNaN(errorZ) ? undefined : errorZ,
          errorXY: isNaN(errorXY) ? undefined : errorXY,
          errorTotal: errorTotal !== undefined && !isNaN(errorTotal) ? errorTotal : undefined,
          source: 'pix4d',
        });
      }
    }
  }
  return rows;
}

export function parseResiduals(text: string, format: ResidualFormat): ResidualRow[] {
  const detected = format === 'auto' ? detectFormat(text) : format;
  if (detected === 'pix4d') return parsePix4D(text);
  if (detected === 'agisoft') return parseAgisoft(text);
  // Try both
  const agisoft = parseAgisoft(text);
  const pix4d = parsePix4D(text);
  return agisoft.length >= pix4d.length ? agisoft : pix4d;
}

export function runValidation(
  knownGCPs: KnownGCP[],
  residuals: ResidualRow[],
  accuracyClass: AccuracyClass,
  _utmZone: number
): ValidationSummary | null {
  if (knownGCPs.length === 0 || residuals.length === 0) return null;

  const knownMap = new Map<string, KnownGCP>();
  for (const g of knownGCPs) {
    knownMap.set(g.name.trim(), g);
  }

  const results: ValidationResult[] = [];
  const unmatched: string[] = [];

  for (const r of residuals) {
    const known = knownMap.get(r.name.trim());
    if (!known) {
      unmatched.push(r.name);
      continue;
    }

    const knownE = parseFloat(known.easting);
    const knownN = parseFloat(known.northing);
    const knownZ = parseFloat(known.elevation);
    if (isNaN(knownE) || isNaN(knownN) || isNaN(knownZ)) continue;

    const deltaE = r.softwareE - knownE;
    const deltaN = r.softwareN - knownN;
    const deltaZ = r.softwareZ - knownZ;
    const horizontalError = Math.sqrt(deltaE * deltaE + deltaN * deltaN);
    const error3D = Math.sqrt(deltaE * deltaE + deltaN * deltaN + deltaZ * deltaZ);

    const hPass = horizontalError <= accuracyClass.horizontal;
    const vPass = Math.abs(deltaZ) <= accuracyClass.vertical;

    results.push({
      name: r.name,
      knownE, knownN, knownZ,
      softwareE: r.softwareE, softwareN: r.softwareN, softwareZ: r.softwareZ,
      deltaE, deltaN, deltaZ,
      horizontalError, error3D,
      hPass, vPass, overallPass: hPass && vPass,
    });
  }

  if (results.length === 0) return null;

  const hErrors = results.map(r => r.horizontalError);
  const vErrors = results.map(r => Math.abs(r.deltaZ));
  const errors3D = results.map(r => r.error3D);

  const hRMSE = calculateRMSE(hErrors);
  const vRMSE = calculateRMSE(vErrors);
  const maxHorizontal = Math.max(...hErrors);
  const maxVertical = Math.max(...vErrors);
  const max3D = Math.max(...errors3D);

  const passCount = results.filter(r => r.overallPass).length;
  const failCount = results.length - passCount;

  return {
    points: results,
    hRMSE, vRMSE, maxHorizontal, maxVertical, max3D,
    hPass: hRMSE <= accuracyClass.horizontal,
    vPass: vRMSE <= accuracyClass.vertical,
    pass: (hRMSE <= accuracyClass.horizontal) && (vRMSE <= accuracyClass.vertical),
    passCount, failCount,
    totalGCPs: residuals.length,
    matchedGCPs: results.length,
    unmatchedNames: unmatched,
  };
}
