/**
 * Tests for src/lib/provenance/engineProvenance.ts — the court-grade
 * provenance layer for the Phase 13 package manifest.
 *
 * Verifies:
 *   - input hashing is deterministic and key-order independent
 *   - per-engine record builders produce the full provenance shape
 *     (input hash, method, engine version, residuals, timestamp)
 *   - the ledger aggregates records with a single engine version
 */

import {
  buildAreaProvenance,
  buildGNSSProvenance,
  buildProvenanceLedger,
  buildTraverseProvenance,
  computeInputHash,
  ENGINE_VERSION,
} from '../engineProvenance'
import type { GNSSObservationReport } from '@/lib/submission/gnssObservationReport'

describe('computeInputHash', () => {
  it('is deterministic across calls', async () => {
    const input = { stations: ['A', 'B'], distances: [10.5, 22.1], bearings: [45, 120] }
    const a = await computeInputHash(input)
    const b = await computeInputHash(input)
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is independent of object key insertion order', async () => {
    const a = await computeInputHash({ x: 1, y: 2, z: 3 })
    const b = await computeInputHash({ z: 3, y: 2, x: 1 })
    expect(a).toBe(b)
  })

  it('changes when the input changes', async () => {
    const a = await computeInputHash({ distance: 10.5 })
    const b = await computeInputHash({ distance: 10.6 })
    expect(a).not.toBe(b)
  })

  it('distinguishes array order (observation sequence matters)', async () => {
    const a = await computeInputHash({ legs: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }] })
    const b = await computeInputHash({ legs: [{ from: 'B', to: 'C' }, { from: 'A', to: 'B' }] })
    expect(a).not.toBe(b)
  })
})

describe('buildTraverseProvenance', () => {
  it('produces a record with input hash, method, version, residuals, timestamp', async () => {
    const input = {
      startPoint: { name: 'CTRL-1', easting: 1000, northing: 2000 },
      legs: [{ station: 'B1', bearing: 45, distance: 50.2 }],
      closingPoint: { easting: 1050.2, northing: 2035.1 },
    }
    const record = await buildTraverseProvenance({
      input,
      method: 'bowditch',
      residuals: {
        closingErrorE: 0.003,
        closingErrorN: -0.002,
        linearError: 0.0036,
        precisionRatio: 14200,
        precisionGrade: 'first',
        totalDistance: 50.2,
        passesQA: true,
      },
      timestamp: '2026-08-18T10:00:00.000Z',
    })

    expect(record.engine).toBe('traverse')
    expect(record.artifact).toBe('traverse_adjustment')
    expect(record.method).toBe('bowditch')
    expect(record.engineVersion).toBe(ENGINE_VERSION)
    expect(record.timestamp).toBe('2026-08-18T10:00:00.000Z')
    expect(record.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(record.inputHash).toBe(await computeInputHash(input))
    expect(record.residuals).toMatchObject({
      closingErrorE: 0.003,
      linearError: 0.0036,
      precisionRatio: 14200,
      passesQA: true,
    })
  })

  it('accepts a precomputed input hash', async () => {
    const record = await buildTraverseProvenance({
      input: { legs: [] },
      inputHash: 'abc123',
      method: 'transit',
      residuals: { totalDistance: 0 },
      timestamp: '2026-08-18T10:00:00.000Z',
    })
    expect(record.inputHash).toBe('abc123')
  })
})

describe('buildAreaProvenance', () => {
  it('hashes the coordinate list and records area residuals', async () => {
    const coordinates = [
      { easting: 0, northing: 0 },
      { easting: 100, northing: 0 },
      { easting: 100, northing: 80 },
      { easting: 0, northing: 80 },
    ]
    const record = await buildAreaProvenance({
      coordinates,
      residuals: { areaM2: 8000, areaHa: 0.8, perimeterM: 360 },
      timestamp: '2026-08-18T10:00:00.000Z',
    })

    expect(record.engine).toBe('area')
    expect(record.method).toBe('coordinate-area')
    expect(record.inputHash).toBe(await computeInputHash(coordinates))
    expect(record.residuals).toMatchObject({ areaM2: 8000, areaHa: 0.8 })
    expect(record.engineVersion).toBe(ENGINE_VERSION)
  })
})

describe('buildGNSSProvenance', () => {
  const makeReport = (overrides: Partial<GNSSObservationReport> = {}): GNSSObservationReport => ({
    reportId: 'GNSS-TEST',
    reportType: 'GNSS_OBSERVATION_REPORT',
    generatedAt: '2026-08-18T10:00:00.000Z',
    inputHash: 'deadbeef'.repeat(8),
    inputFilesHash: '',
    inputFiles: [],
    engineVersion: ENGINE_VERSION,
    stations: { base: 'BASE', rover: 'ROVER' },
    options: { mode: 'static' },
    solution: {
      final_solution: 'FIX',
      ratio: 3.5,
      satellites: 9,
      rover_latitude: -1.29,
      rover_longitude: 36.82,
      rover_height: 1790.5,
      sigma_north: 0.008,
      sigma_east: 0.007,
      sigma_up: 0.015,
      solution_summary: { final_solution: 'FIX', epochs: 1000, fixed_epochs: 980, float_epochs: 20, fix_pct: 98, ratio: 3.5 },
    },
    issues: [],
    verdict: 'pass',
    ...overrides,
  })

  it('reuses the report\u2019s embedded input hash for cross-verification', async () => {
    const record = await buildGNSSProvenance({ report: makeReport() })
    expect(record.inputHash).toBe('deadbeef'.repeat(8))
    expect(record.engine).toBe('gnss-baseline')
    expect(record.method).toBe('rtklib-baseline')
    expect(record.residuals).toMatchObject({
      verdict: 'pass',
      final_solution: 'FIX',
      ratio: 3.5,
      fix_pct: 98,
    })
    // 2D sigma = hypot(0.007, 0.008)
    expect(record.residuals?.sigma2d_m).toBeCloseTo(Math.hypot(0.007, 0.008), 6)
  })

  it('falls back to hashing the report when it predates self-certification', async () => {
    const legacy = makeReport({ inputHash: undefined as unknown as string })
    const record = await buildGNSSProvenance({ report: legacy })
    expect(record.inputHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('prefers the raw-file hash and carries per-file digests into the ledger', async () => {
    const filesHash = '11'.repeat(32)
    const report = makeReport({
      inputFilesHash: filesHash,
      inputFiles: [
        { role: 'base', fileName: 'BASE.24o', sizeBytes: 100, sha256: 'aa'.repeat(32) },
        { role: 'rover', fileName: 'ROVR.24o', sizeBytes: 90, sha256: 'bb'.repeat(32) },
      ],
    })
    const record = await buildGNSSProvenance({ report })
    // The manifest ledger anchors to the exact raw RINEX inputs, not the result.
    expect(record.inputHash).toBe(filesHash)
    expect(record.inputDescriptor).toContain('raw RINEX input files')
    expect(record.residuals).toMatchObject({
      sha256_base: 'aa'.repeat(32),
      sha256_rover: 'bb'.repeat(32),
    })
  })
})

describe('buildProvenanceLedger', () => {
  it('aggregates records under a single engine version and timestamp', async () => {
    const traverse = await buildTraverseProvenance({
      input: { legs: [] },
      method: 'bowditch',
      residuals: { totalDistance: 0 },
      timestamp: '2026-08-18T10:00:00.000Z',
    })
    const area = await buildAreaProvenance({
      coordinates: [{ easting: 0, northing: 0 }],
      residuals: { areaM2: 0 },
      timestamp: '2026-08-18T10:00:00.000Z',
    })

    const ledger = buildProvenanceLedger([traverse, area], '2026-08-18T11:00:00.000Z')
    expect(ledger.engineVersion).toBe(ENGINE_VERSION)
    expect(ledger.generatedAt).toBe('2026-08-18T11:00:00.000Z')
    expect(ledger.records).toHaveLength(2)
    expect(ledger.records.map((r) => r.engine)).toEqual(['traverse', 'area'])
    expect(ledger.records.every((r) => r.engineVersion === ENGINE_VERSION)).toBe(true)
  })

  it('returns an empty ledger for no records', () => {
    const ledger = buildProvenanceLedger([], '2026-08-18T11:00:00.000Z')
    expect(ledger.records).toEqual([])
    expect(ledger.engineVersion).toBe(ENGINE_VERSION)
  })
})
