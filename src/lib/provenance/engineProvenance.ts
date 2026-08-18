/**
 * Court-grade engine provenance — the Phase 13 package manifest's evidence
 * layer.
 *
 * Every engine computation whose output lands in the statutory submission
 * package is recorded as a provenance record carrying:
 *
 *   - inputHash    SHA-256 of the canonical engine input (what was fed in)
 *   - method       the adjustment/algorithm used (bowditch, least-squares, …)
 *   - engineVersion METARDU compute engine version at computation time
 *   - residuals    the QA diagnostics (misclosure, precision ratio, sigma, …)
 *   - timestamp    when the computation ran
 *
 * Records are aggregated into a provenance ledger embedded in `manifest.json`
 * (the Phase 13 "Index to Computations" section), so a boundary commission or
 * court can verify: given these inputs, with this method, on this engine
 * version, at this time, these residuals were produced — and re-run the
 * computation to confirm the hash.
 *
 * Pure module — no DB, no React, no file I/O. Unit-testable.
 *
 * @module provenance/engineProvenance
 */

import { canonicalJSON, sha256 } from '@/lib/audit/auditHash'
import type { GNSSObservationReport } from '@/lib/submission/gnssObservationReport'

/**
 * METARDU compute engine version embedded in every provenance record.
 * Keep in lockstep with package.json "version".
 */
export const ENGINE_VERSION = '1.0.1'

/** Numeric/string/boolean residual diagnostics (misclosure, ratio, sigma…). */
export type EngineProvenanceResiduals = Record<string, number | string | boolean | null>

export interface EngineProvenanceRecord {
  /** Which package artifact this output feeds (e.g. 'computation_workbook.xlsx'). */
  artifact: string
  /** Engine family ('traverse' | 'area' | 'gnss-baseline' | …). */
  engine: string
  /** The adjustment/algorithm ('bowditch' | 'transit' | 'coordinate-area' | …). */
  method: string
  engineVersion: string
  /** SHA-256 (hex) of the canonical engine input. */
  inputHash: string
  /** Human-readable note on what the hash covers. */
  inputDescriptor?: string
  residuals?: EngineProvenanceResiduals
  /** ISO timestamp of the computation. */
  timestamp: string
}

export interface EngineProvenanceLedger {
  engineVersion: string
  generatedAt: string
  records: EngineProvenanceRecord[]
}

/**
 * Deterministic SHA-256 of any engine input. Uses the audit chain's canonical
 * JSON serialization (sorted keys, no whitespace), so the hash is stable
 * regardless of object key insertion order and matches the audit trail's
 * hashing convention.
 */
export async function computeInputHash(input: unknown): Promise<string> {
  return sha256(canonicalJSON(input))
}

/**
 * Aggregate provenance records into the ledger shape embedded in the package
 * manifest.
 */
export function buildProvenanceLedger(
  records: EngineProvenanceRecord[],
  generatedAt = new Date().toISOString(),
): EngineProvenanceLedger {
  return {
    engineVersion: ENGINE_VERSION,
    generatedAt,
    records: records.map((r) => ({
      ...r,
      engineVersion: r.engineVersion || ENGINE_VERSION,
    })),
  }
}

// ─── Per-engine record builders ─────────────────────────────────────────────
//
// Each builder hashes the *actual engine input* (the raw observations, not the
// stored results) so the record is independently verifiable: re-run the method
// on the hashed input and compare residuals.

export interface TraverseProvenanceInput {
  /** Canonical input the adjustment consumed (start point, legs, bearings, distances, closing point). */
  input: unknown
  /** Input hash precomputed by the caller, or `input` will be hashed. */
  inputHash?: string
  inputDescriptor?: string
  method: string
  residuals: EngineProvenanceResiduals & { totalDistance: number }
  artifact?: string
  timestamp?: string
}

/** Provenance record for a closed-traverse adjustment (Bowditch/Transit). */
export async function buildTraverseProvenance(
  input: TraverseProvenanceInput,
): Promise<EngineProvenanceRecord> {
  return {
    artifact: input.artifact ?? 'traverse_adjustment',
    engine: 'traverse',
    method: input.method,
    engineVersion: ENGINE_VERSION,
    inputHash: input.inputHash ?? (await computeInputHash(input.input)),
    inputDescriptor:
      input.inputDescriptor ?? 'traverse input: start point, legs (bearing/distance), closing control',
    residuals: input.residuals,
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
}

export interface AreaProvenanceInput {
  /** Canonical coordinate list fed to the area engine. */
  coordinates: unknown
  inputHash?: string
  residuals: {
    areaM2: number
    areaHa?: number
    perimeterM?: number
  }
  artifact?: string
  timestamp?: string
}

/** Provenance record for a shoelace (coordinate-area) computation. */
export async function buildAreaProvenance(
  input: AreaProvenanceInput,
): Promise<EngineProvenanceRecord> {
  return {
    artifact: input.artifact ?? 'area_computation',
    engine: 'area',
    method: 'coordinate-area',
    engineVersion: ENGINE_VERSION,
    inputHash: input.inputHash ?? (await computeInputHash(input.coordinates)),
    inputDescriptor: 'coordinate list (easting/northing pairs)',
    residuals: input.residuals,
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
}

export interface GNSSProvenanceInput {
  /** The observation report artifact (carries its own embedded inputHash). */
  report: GNSSObservationReport
  timestamp?: string
}

/**
 * Provenance record for the GNSS baseline observation report. The report
 * itself is self-certifying (it embeds its own inputHash + engineVersion at
 * build time); the record reuses that hash so the manifest and the artifact
 * cross-reference each other.
 *
 * When the report carries raw RINEX file digests (inputFilesHash), that hash
 * anchors the record to the exact input bytes and takes precedence over the
 * result-derived inputHash.
 */
export async function buildGNSSProvenance(
  input: GNSSProvenanceInput,
): Promise<EngineProvenanceRecord> {
  const { report } = input
  const sigma2d = Math.hypot(
    report.solution.sigma_east || 0,
    report.solution.sigma_north || 0,
  )
  const inputFilesHash = report.inputFilesHash
  return {
    artifact: 'gnss_observation_report',
    engine: 'gnss-baseline',
    method: 'rtklib-baseline',
    engineVersion: report.engineVersion ?? ENGINE_VERSION,
    // File-anchored when the report recorded raw RINEX digests; otherwise
    // the report's embedded input hash; pre-certification reports fall back
    // to hashing the report itself.
    inputHash: inputFilesHash || report.inputHash || (await computeInputHash(report)),
    inputDescriptor: inputFilesHash
      ? 'raw RINEX input files (base/rover/nav SHA-256, see report)'
      : 'baseline-process result + session QC (see report hash)',
    residuals: {
      verdict: report.verdict,
      final_solution: report.solution.final_solution,
      ratio: report.solution.ratio,
      satellites: report.solution.satellites,
      sigma2d_m: sigma2d,
      fix_pct: report.solution.solution_summary?.fix_pct ?? null,
      epochs: report.solution.solution_summary?.epochs ?? null,
      // Per-file digests so the ledger itself enumerates the raw inputs.
      ...Object.fromEntries(
        (report.inputFiles ?? []).map((f) => [`sha256_${f.role}`, f.sha256] as const),
      ),
    },
    timestamp: input.timestamp ?? report.generatedAt,
  }
}
