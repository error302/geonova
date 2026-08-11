// ──────────────────────────────────────────────────────────────────────────
// METARDU — Survey Computation Audit Trail
// ──────────────────────────────────────────────────────────────────────────
// Every survey computation that produces legally defensible output MUST
// generate an audit trail entry. This module provides:
//
//   - SHA-256 checksummed computation records
//   - Full input/output capture with correction details
//   - Reference to the formula standard used (RDM 1.1, Survey Act, etc.)
//   - Tamper-evident chain (each entry hashes the previous)
//   - Exportable audit reports for ISK/Survey of Kenya review
//
// Compliance: Survey Act Cap. 299, RDM 1.1, ISK Practice Standards
// ──────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────

export interface AuditEntry {
  /** Unique audit entry ID */
  id: string;
  /** ISO-8601 timestamp of computation */
  timestamp: string;
  /** Survey this computation belongs to */
  surveyId: string;
  /** Project this computation belongs to */
  projectId: string;
  /** User who triggered the computation */
  userId: string;
  /** Type of computation performed */
  operation: AuditOperation;
  /** All input parameters (serializable) */
  inputs: Record<string, unknown>;
  /** All output results (serializable) */
  outputs: Record<string, unknown>;
  /** Corrections applied to raw observations */
  correctionsApplied: CorrectionRecord[];
  /** Formula/method used */
  formula: string;
  /** Reference standard (e.g., "RDM 1.1 Section 4.2") */
  reference: string;
  /** Software version */
  softwareVersion: string;
  /** SHA-256 checksum of inputs + outputs for integrity */
  checksum: string;
  /** Hash of the previous audit entry (chain integrity) */
  previousHash: string | null;
  /** Combined hash: checksum + previousHash */
  chainHash: string;
  /** Duration of computation in milliseconds */
  durationMs: number;
  /** Whether the computation passed accuracy checks */
  accuracyCheck: AccuracyCheckResult | null;
}

export type AuditOperation =
  | 'traverse_adjustment'
  | 'bowditch_adjustment'
  | 'transit_adjustment'
  | 'least_squares_adjustment'
  | 'levelling_rise_fall'
  | 'levelling_height_of_collimation'
  | 'area_computation'
  | 'volume_computation'
  | 'coordinate_transform'
  | 'cogo_intersection'
  | 'cogo_resection'
  | 'cogo_radiation'
  | 'curve_geometry'
  | 'earthwork_computation'
  | 'correction_pipeline'
  | 'error_propagation'
  | 'deed_plan_generation'
  | 'gnss_baseline_processing';

export interface CorrectionRecord {
  type: 'atmospheric' | 'curvature_refraction' | 'grid_scale_factor' | 'sea_level' | 'slope_reduction' | 'projection_convergence' | 'edm_constant';
  description: string;
  rawValue: number;
  correctedValue: number;
  correctionAmount: number;
  unit: string;
  formula: string;
}

export interface AccuracyCheckResult {
  passed: boolean;
  achieved: number;        // e.g., 1:25000
  required: number;        // e.g., 1:20000
  metric: string;          // e.g., "closure ratio"
  standard: string;        // e.g., "2nd Order, Class I"
  details: string;
}

// ─── Audit Trail Manager ─────────────────────────────────────────────────

export class AuditTrail {
  private entries: AuditEntry[] = [];
  private lastHash: string | null = null;
  private softwareVersion: string;

  constructor(softwareVersion: string = '1.0.1') {
    this.softwareVersion = softwareVersion;
  }

  /**
   * Record a computation in the audit trail.
   *
   * @returns The complete audit entry with checksums.
   */
  record(params: {
    surveyId: string;
    projectId: string;
    userId: string;
    operation: AuditOperation;
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    correctionsApplied?: CorrectionRecord[];
    formula: string;
    reference: string;
    durationMs?: number;
    accuracyCheck?: AccuracyCheckResult | null;
  }): AuditEntry {
    const id = this.generateId();
    const timestamp = new Date().toISOString();

    // Compute integrity checksum
    const checksum = this.computeChecksum(params.inputs, params.outputs);

    // Chain hash: link to previous entry for tamper detection
    const chainHash = this.computeChainHash(checksum, this.lastHash);

    const entry: AuditEntry = {
      id,
      timestamp,
      surveyId: params.surveyId,
      projectId: params.projectId,
      userId: params.userId,
      operation: params.operation,
      inputs: this.sanitize(params.inputs),
      outputs: this.sanitize(params.outputs),
      correctionsApplied: params.correctionsApplied || [],
      formula: params.formula,
      reference: params.reference,
      softwareVersion: this.softwareVersion,
      checksum,
      previousHash: this.lastHash,
      chainHash,
      durationMs: params.durationMs || 0,
      accuracyCheck: params.accuracyCheck ?? null,
    };

    this.entries.push(entry);
    this.lastHash = chainHash;

    return entry;
  }

  /**
   * Record a traverse adjustment computation.
   */
  recordTraverseAdjustment(params: {
    surveyId: string;
    projectId: string;
    userId: string;
    method: 'bowditch' | 'transit' | 'least_squares';
    stations: Array<{ name: string; easting: number; northing: number }>;
    observations: Array<{ from: string; to: string; distance: number; bearing: number }>;
    corrections: CorrectionRecord[];
    misclosure: { linear: number; ratio: string };
    adjustedStations: Array<{ name: string; easting: number; northing: number; stdDevE: number; stdDevN: number }>;
    durationMs: number;
    accuracyCheck: AccuracyCheckResult;
  }): AuditEntry {
    const methodMap = {
      bowditch: 'bowditch_adjustment' as const,
      transit: 'transit_adjustment' as const,
      least_squares: 'least_squares_adjustment' as const,
    };

    const formulaMap = {
      bowditch: 'Bowditch/Compass Rule: ΔE = -(e/Σd)×d, ΔN = -(n/Σd)×d',
      transit: 'Transit Rule: ΔE = -(e/Σ|ΔE|)×|Δe|, ΔN = -(n/Σ|ΔN|)×|Δn|',
      least_squares: 'Least Squares: x̂ = (AᵀPA)⁻¹AᵀPl',
    };

    const referenceMap = {
      bowditch: 'RDM 1.1 Section 4.3 — Bowditch Adjustment',
      transit: 'RDM 1.1 Section 4.4 — Transit Adjustment',
      least_squares: 'RDM 1.1 Section 4.5 — Least Squares Adjustment',
    };

    return this.record({
      surveyId: params.surveyId,
      projectId: params.projectId,
      userId: params.userId,
      operation: methodMap[params.method],
      inputs: {
        method: params.method,
        stationCount: params.stations.length,
        observationCount: params.observations.length,
        stations: params.stations,
        observations: params.observations,
      },
      outputs: {
        misclosure: params.misclosure,
        adjustedStations: params.adjustedStations,
        correctionsApplied: params.corrections.length,
      },
      correctionsApplied: params.corrections,
      formula: formulaMap[params.method],
      reference: referenceMap[params.method],
      durationMs: params.durationMs,
      accuracyCheck: params.accuracyCheck,
    });
  }

  /**
   * Record a levelling computation.
   */
  recordLevelling(params: {
    surveyId: string;
    projectId: string;
    userId: string;
    method: 'rise_fall' | 'height_of_collimation';
    stations: Array<{ name: string; height: number }>;
    closure: { actual: number; allowable: number; passed: boolean };
    distanceKm: number;
    durationMs: number;
  }): AuditEntry {
    return this.record({
      surveyId: params.surveyId,
      projectId: params.projectId,
      userId: params.userId,
      operation: params.method === 'rise_fall' ? 'levelling_rise_fall' : 'levelling_height_of_collimation',
      inputs: {
        method: params.method,
        stationCount: params.stations.length,
        stations: params.stations,
        distanceKm: params.distanceKm,
      },
      outputs: {
        adjustedStations: params.stations,
        closure: params.closure,
      },
      formula: params.method === 'rise_fall'
        ? 'Rise & Fall: Rise = BS - FS, Height = Prev + Rise'
        : 'Height of Collimation: HPC = RL + BS, RL = HPC - FS',
      reference: 'RDM 1.1 Section 5.2 — Levelling (10√K mm closure)',
      durationMs: params.durationMs,
      accuracyCheck: {
        passed: params.closure.passed,
        achieved: params.closure.actual,
        required: params.closure.allowable,
        metric: 'levelling closure (mm)',
        standard: 'RDM 1.1 — 10√K mm',
        details: `Distance: ${params.distanceKm.toFixed(2)} km, Allowable: ${params.closure.allowable.toFixed(1)} mm, Actual: ${params.closure.actual.toFixed(1)} mm`,
      },
    });
  }

  /**
   * Record a coordinate transformation.
   */
  recordCoordinateTransform(params: {
    surveyId: string;
    projectId: string;
    userId: string;
    fromDatum: string;
    toDatum: string;
    fromProjection: string;
    toProjection: string;
    pointCount: number;
    maxShiftMeters: number;
    durationMs: number;
  }): AuditEntry {
    return this.record({
      surveyId: params.surveyId,
      projectId: params.projectId,
      userId: params.userId,
      operation: 'coordinate_transform',
      inputs: {
        fromDatum: params.fromDatum,
        toDatum: params.toDatum,
        fromProjection: params.fromProjection,
        toProjection: params.toProjection,
        pointCount: params.pointCount,
      },
      outputs: {
        maxShiftMeters: params.maxShiftMeters,
      },
      formula: 'Helmert 7-parameter transformation (Bursa-Wolf model)',
      reference: 'RDM 1.1 Section 3.2 — Datum Transformation',
      durationMs: params.durationMs,
    });
  }

  /**
   * Record a correction pipeline application.
   */
  recordCorrectionPipeline(params: {
    surveyId: string;
    projectId: string;
    userId: string;
    corrections: CorrectionRecord[];
    observationCount: number;
    durationMs: number;
  }): AuditEntry {
    return this.record({
      surveyId: params.surveyId,
      projectId: params.projectId,
      userId: params.userId,
      operation: 'correction_pipeline',
      inputs: {
        observationCount: params.observationCount,
        correctionTypes: params.corrections.map((c) => c.type),
      },
      outputs: {
        corrections: params.corrections,
        totalCorrection: params.corrections.reduce((sum, c) => sum + c.correctionAmount, 0),
      },
      correctionsApplied: params.corrections,
      formula: 'Sequential correction pipeline: atmospheric → C&R → scale → sea level → slope',
      reference: 'RDM 1.1 Section 4.1 — Observation Corrections',
      durationMs: params.durationMs,
    });
  }

  /**
   * Get all audit entries for a survey.
   */
  getEntriesForSurvey(surveyId: string): AuditEntry[] {
    return this.entries.filter((e) => e.surveyId === surveyId);
  }

  /**
   * Get all audit entries for a project.
   */
  getEntriesForProject(projectId: string): AuditEntry[] {
    return this.entries.filter((e) => e.projectId === projectId);
  }

  /**
   * Verify the integrity of the audit chain.
   *
   * @returns true if all chain hashes are valid, false if tampered.
   */
  verifyChain(): { valid: boolean; brokenAt: number | null; details: string } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const expectedPrevious = i === 0 ? null : this.entries[i - 1].chainHash;

      if (entry.previousHash !== expectedPrevious) {
        return {
          valid: false,
          brokenAt: i,
          details: `Chain break at entry ${i} (${entry.id}): expected previousHash ${expectedPrevious}, got ${entry.previousHash}`,
        };
      }

      // Verify checksum
      const expectedChecksum = this.computeChecksum(entry.inputs, entry.outputs);
      if (entry.checksum !== expectedChecksum) {
        return {
          valid: false,
          brokenAt: i,
          details: `Checksum mismatch at entry ${i} (${entry.id}): data may have been tampered with`,
        };
      }
    }

    return { valid: true, brokenAt: null, details: 'Chain intact — all entries verified.' };
  }

  /**
   * Export audit trail as a human-readable report.
   */
  exportReport(projectId: string): string {
    const entries = this.getEntriesForProject(projectId);
    const chain = this.verifyChain();

    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════',
      '  METARDU — Survey Computation Audit Report',
      '═══════════════════════════════════════════════════════════════',
      '',
      `  Project ID:     ${projectId}`,
      `  Generated:      ${new Date().toISOString()}`,
      `  Entries:        ${entries.length}`,
      `  Chain Status:   ${chain.valid ? '✓ INTACT' : '✗ BROKEN'}`,
      `  Software:       METARDU v${this.softwareVersion}`,
      '',
      '───────────────────────────────────────────────────────────────',
      '',
    ];

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      lines.push(`  [${i + 1}] ${e.operation.toUpperCase().replace(/_/g, ' ')}`);
      lines.push(`      Timestamp:  ${e.timestamp}`);
      lines.push(`      Survey:     ${e.surveyId}`);
      lines.push(`      User:       ${e.userId}`);
      lines.push(`      Formula:    ${e.formula}`);
      lines.push(`      Reference:  ${e.reference}`);
      lines.push(`      Duration:   ${e.durationMs} ms`);
      lines.push(`      Checksum:   ${e.checksum.substring(0, 16)}…`);
      lines.push(`      Chain Hash: ${e.chainHash.substring(0, 16)}…`);

      if (e.correctionsApplied.length > 0) {
        lines.push(`      Corrections:`);
        for (const c of e.correctionsApplied) {
          lines.push(`        • ${c.description}: ${c.rawValue} → ${c.correctedValue} ${c.unit} (Δ${c.correctionAmount})`);
        }
      }

      if (e.accuracyCheck) {
        const ac = e.accuracyCheck;
        lines.push(`      Accuracy:   ${ac.passed ? '✓ PASS' : '✗ FAIL'} — ${ac.metric}`);
        lines.push(`                  Achieved: ${ac.achieved}, Required: ${ac.required}`);
        lines.push(`                  Standard: ${ac.standard}`);
        lines.push(`                  ${ac.details}`);
      }

      lines.push('');
    }

    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  Chain Verification: ${chain.valid ? 'ALL ENTRIES VERIFIED' : chain.details}`);
    lines.push('═══════════════════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Export audit entries as JSON for API/storage.
   */
  exportJSON(projectId: string): {
    projectId: string;
    generatedAt: string;
    softwareVersion: string;
    chainValid: boolean;
    entries: AuditEntry[];
  } {
    const entries = this.getEntriesForProject(projectId);
    const chain = this.verifyChain();

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      softwareVersion: this.softwareVersion,
      chainValid: chain.valid,
      entries,
    };
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `audit_${timestamp}_${random}`;
  }

  private computeChecksum(inputs: Record<string, unknown>, outputs: Record<string, unknown>): string {
    const data = JSON.stringify({ inputs, outputs }, Object.keys({ inputs, outputs }).sort());
    return createHash('sha256').update(data).digest('hex');
  }

  private computeChainHash(checksum: string, previousHash: string | null): string {
    const combined = previousHash ? `${checksum}:${previousHash}` : checksum;
    return createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Sanitize data for storage — remove functions, circular refs, etc.
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    try {
      return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    } catch {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'function' || typeof value === 'symbol') continue;
        if (value === undefined) continue;
        sanitized[key] = value;
      }
      return sanitized;
    }
  }
}

// ─── Singleton for In-Memory Use ─────────────────────────────────────────

let instance: AuditTrail | null = null;

export function getAuditTrail(): AuditTrail {
  if (!instance) {
    instance = new AuditTrail(process.env.npm_package_version || '1.0.1');
  }
  return instance;
}
