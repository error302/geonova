/**
 * Tests for src/lib/provenance/verifyProvenance.ts — the court-grade
 * provenance verification module.
 *
 * Verifies:
 *   - Traverse re-run produces matching residuals for bowditch and transit
 *   - Area re-run produces matching residuals
 *   - Input hash mismatch is detected
 *   - Residual drift is detected with per-key diffs
 *   - GNSS baseline only verifies input hash (no re-run)
 *   - Engine version drift is reported as informational
 *   - Tolerance settings work for numeric and ratio residuals
 */

import {
  verifyProvenance,
} from '../verifyProvenance'
import type { EngineProvenanceRecord } from '../engineProvenance'
import { computeInputHash, buildTraverseProvenance, buildAreaProvenance, ENGINE_VERSION } from '../engineProvenance'

// ─── Traverse fixtures ───────────────────────────────────────────────────────

const TRAVERSE_INPUT = {
  startPoint: { name: 'CTRL-1', easting: 500000, northing: 9800000 },
  legs: [
    { station: 'B1', bearing: 45.1234, distance: 50.234 },
    { station: 'B2', bearing: 120.5678, distance: 35.678 },
    { station: 'B3', bearing: 210.9012, distance: 42.345 },
    { station: 'B4', bearing: 315.3456, distance: 28.901 },
  ],
  closingPoint: { easting: 500123.456, northing: 9799876.543 },
  method: 'bowditch' as const,
}

const TRANSIT_INPUT = {
  ...TRAVERSE_INPUT,
  method: 'transit' as const,
}

// ─── Area fixtures ───────────────────────────────────────────────────────────

const AREA_INPUT = {
  coordinates: [
    { easting: 500000, northing: 9800000 },
    { easting: 500100, northing: 9800000 },
    { easting: 500100, northing: 9799920 },
    { easting: 500000, northing: 9799920 },
  ],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<EngineProvenanceRecord> = {}): EngineProvenanceRecord {
  return {
    artifact: 'traverse_adjustment',
    engine: 'traverse',
    method: 'bowditch',
    engineVersion: ENGINE_VERSION,
    inputHash: 'a'.repeat(64),
    inputDescriptor: 'test input',
    residuals: {},
    timestamp: '2026-08-18T10:00:00.000Z',
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('verifyProvenance', () => {
  describe('traverse re-run', () => {
    it('produces valid=true for a bowditch traverse with matching inputs', async () => {
      const inputHash = await computeInputHash(TRAVERSE_INPUT)
      // Re-run the traverse to get actual residuals
      const { bowditchAdjustment, evaluateTraverseClosure } = await import('@/lib/engine/traverse')
      const { coordinateArea } = await import('@/lib/engine/area')

      const distances = TRAVERSE_INPUT.legs.map((l) => l.distance)
      const bearings = TRAVERSE_INPUT.legs.map((l) => l.bearing)
      const points = TRAVERSE_INPUT.legs.map((l) => ({ name: l.station, easting: 0, northing: 0 }))
      const traverseInput = {
        points: [TRAVERSE_INPUT.startPoint, ...points],
        distances,
        bearings,
        closingPoint: TRAVERSE_INPUT.closingPoint,
      }
      const adjusted = bowditchAdjustment(traverseInput)
      const closure = evaluateTraverseClosure(adjusted.linearError, adjusted.totalDistance, 'cadastral')
      const coordinates = adjusted.legs.map((leg) => ({ easting: leg.adjEasting, northing: leg.adjNorthing }))
      const areaResult = coordinateArea(coordinates)

      const record = makeRecord({
        inputHash,
        residuals: {
          closingErrorE: adjusted.closingErrorE,
          closingErrorN: adjusted.closingErrorN,
          linearError: adjusted.linearError,
          totalDistance: adjusted.totalDistance,
          precisionGrade: adjusted.precisionGrade,
          adjustedAreaM2: areaResult.areaSqm,
          adjustedAreaHa: areaResult.areaHa,
        },
      })

      const result = await verifyProvenance({
        record,
        input: TRAVERSE_INPUT,
        engine: 'traverse',
      })

      expect(result.valid).toBe(true)
      expect(result.inputHash.match).toBe(true)
      expect(result.residuals.match).toBe(true)
      expect(result.residuals.mismatched).toBe(0)
      expect(result.engine).toBe('traverse')
      expect(result.summary).toContain('Input hash: MATCH')
      expect(result.summary).toContain('ALL')
      expect(result.summary).toContain('MATCH')
    })

    it('produces valid=true for a transit traverse', async () => {
      const input = TRANSIT_INPUT
      const inputHash = await computeInputHash(input)
      const { transitAdjustment, evaluateTraverseClosure } = await import('@/lib/engine/traverse')
      const { coordinateArea } = await import('@/lib/engine/area')

      const distances = input.legs.map((l) => l.distance)
      const bearings = input.legs.map((l) => l.bearing)
      const points = input.legs.map((l) => ({ name: l.station, easting: 0, northing: 0 }))
      const traverseInput = {
        points: [input.startPoint, ...points],
        distances,
        bearings,
        closingPoint: input.closingPoint,
      }
      const adjusted = transitAdjustment(traverseInput)
      const closure = evaluateTraverseClosure(adjusted.linearError, adjusted.totalDistance, 'cadastral')
      const coordinates = adjusted.legs.map((leg) => ({ easting: leg.adjEasting, northing: leg.adjNorthing }))
      const areaResult = coordinateArea(coordinates)

      const record = makeRecord({
        method: 'transit',
        inputHash,
        residuals: {
          closingErrorE: adjusted.closingErrorE,
          closingErrorN: adjusted.closingErrorN,
          linearError: adjusted.linearError,
          totalDistance: adjusted.totalDistance,
          precisionGrade: adjusted.precisionGrade,
          adjustedAreaM2: areaResult.areaSqm,
          adjustedAreaHa: areaResult.areaHa,
        },
      })

      const result = await verifyProvenance({
        record,
        input,
        engine: 'traverse',
      })

      expect(result.valid).toBe(true)
      expect(result.residuals.match).toBe(true)
    })
  })

  describe('area re-run', () => {
    it('produces valid=true for a coordinate area computation', async () => {
      const inputHash = await computeInputHash(AREA_INPUT)
      const { coordinateArea } = await import('@/lib/engine/area')
      const result2 = coordinateArea(AREA_INPUT.coordinates)

      const record = makeRecord({
        artifact: 'area_computation',
        engine: 'area',
        method: 'coordinate-area',
        inputHash,
        residuals: {
          areaM2: result2.areaSqm,
          areaHa: result2.areaHa,
          perimeterM: result2.perimeter,
        },
      })

      const result = await verifyProvenance({
        record,
        input: AREA_INPUT,
        engine: 'area',
      })

      expect(result.valid).toBe(true)
      expect(result.inputHash.match).toBe(true)
      expect(result.residuals.match).toBe(true)
      expect(result.engine).toBe('area')
    })

    it('detects a single-digit tamper in areaM2', async () => {
      const inputHash = await computeInputHash(AREA_INPUT)
      const { coordinateArea } = await import('@/lib/engine/area')
      const areaResult = coordinateArea(AREA_INPUT.coordinates)

      const record = makeRecord({
        engine: 'area',
        method: 'coordinate-area',
        inputHash,
        residuals: {
          areaM2: areaResult.areaSqm + 1, // tampered
          areaHa: areaResult.areaHa,
          perimeterM: areaResult.perimeter,
        },
      })

      const result = await verifyProvenance({
        record,
        input: AREA_INPUT,
        engine: 'area',
      })

      expect(result.valid).toBe(false)
      expect(result.residuals.match).toBe(false)
      expect(result.residuals.mismatched).toBeGreaterThanOrEqual(1)

      const areaDiff = result.residuals.diffs.find((d) => d.key === 'areaM2')
      expect(areaDiff).toBeDefined()
      expect(areaDiff!.match).toBe(false)
      expect(areaDiff!.delta).toBeCloseTo(1, 6)
    })
  })

  describe('input hash verification', () => {
    it('detects input hash mismatch when input is tampered', async () => {
      const inputHash = await computeInputHash(TRAVERSE_INPUT)

      const record = makeRecord({
        inputHash,
        residuals: {},
      })

      const tamperedInput = { ...TRAVERSE_INPUT, legs: [{ station: 'X', bearing: 99, distance: 1 }] }

      const result = await verifyProvenance({
        record,
        input: tamperedInput,
        engine: 'traverse',
      })

      expect(result.valid).toBe(false)
      expect(result.inputHash.match).toBe(false)
      expect(result.inputHash.stored).toBe(inputHash)
      expect(result.inputHash.recomputed).not.toBe(inputHash)
    })
  })

  describe('residual drift detection', () => {
    it('reports per-key diffs with delta values', async () => {
      const inputHash = await computeInputHash(TRAVERSE_INPUT)
      const { bowditchAdjustment, evaluateTraverseClosure } = await import('@/lib/engine/traverse')

      const distances = TRAVERSE_INPUT.legs.map((l) => l.distance)
      const bearings = TRAVERSE_INPUT.legs.map((l) => l.bearing)
      const points = TRAVERSE_INPUT.legs.map((l) => ({ name: l.station, easting: 0, northing: 0 }))
      const traverseInput = {
        points: [TRAVERSE_INPUT.startPoint, ...points],
        distances,
        bearings,
        closingPoint: TRAVERSE_INPUT.closingPoint,
      }
      const adjusted = bowditchAdjustment(traverseInput)
      const closure = evaluateTraverseClosure(adjusted.linearError, adjusted.totalDistance, 'cadastral')

      const record = makeRecord({
        inputHash,
        residuals: {
          closingErrorE: adjusted.closingErrorE + 0.01, // drift
          closingErrorN: adjusted.closingErrorN,
          linearError: adjusted.linearError + 0.02, // drift
          totalDistance: adjusted.totalDistance,
          precisionGrade: adjusted.precisionGrade,
          passesQA: closure.passes,
        },
      })

      const result = await verifyProvenance({
        record,
        input: TRAVERSE_INPUT,
        engine: 'traverse',
      })

      expect(result.valid).toBe(false)
      expect(result.residuals.mismatched).toBeGreaterThanOrEqual(1)
      expect(result.residuals.diffs.length).toBeGreaterThan(0)

      const ceDiff = result.residuals.diffs.find((d) => d.key === 'closingErrorE')
      expect(ceDiff).toBeDefined()
      expect(ceDiff!.match).toBe(false)
      expect(ceDiff!.delta).toBeCloseTo(0.01, 6)

      const leDiff = result.residuals.diffs.find((d) => d.key === 'linearError')
      expect(leDiff).toBeDefined()
      expect(leDiff!.match).toBe(false)
      expect(leDiff!.delta).toBeCloseTo(0.02, 6)
    })
  })

  describe('GNSS baseline (hash-only verification)', () => {
    it('reports valid=true when input hash matches (no re-run)', async () => {
      const report = { test: 'data' }
      const inputHash = await computeInputHash({ report })

      const record = makeRecord({
        engine: 'gnss-baseline',
        method: 'rtklib-baseline',
        inputHash,
        residuals: { verdict: 'pass', ratio: 3.5 },
      })

      const result = await verifyProvenance({
        record,
        input: { report },
        engine: 'gnss-baseline',
      })

      expect(result.valid).toBe(true)
      expect(result.inputHash.match).toBe(true)
      // GNSS residuals are passed through (no re-run)
      expect(result.residuals.match).toBe(true)
    })

    it('reports valid=false when input hash mismatches', async () => {
      const inputHash = await computeInputHash({ report: { original: true } })

      const record = makeRecord({
        engine: 'gnss-baseline',
        inputHash,
        residuals: { verdict: 'pass' },
      })

      const result = await verifyProvenance({
        record,
        input: { report: { tampered: true } },
        engine: 'gnss-baseline',
      })

      expect(result.valid).toBe(false)
      expect(result.inputHash.match).toBe(false)
    })
  })

  describe('engine version drift', () => {
    it('reports version drift as informational (does not invalidate)', async () => {
      const inputHash = await computeInputHash(TRAVERSE_INPUT)
      const { coordinateArea } = await import('@/lib/engine/area')

      const record = makeRecord({
        inputHash,
        engineVersion: '0.9.0', // old version
        residuals: { areaM2: 0 },
      })

      const result = await verifyProvenance({
        record,
        input: TRAVERSE_INPUT,
        engine: 'traverse',
      })

      expect(result.engineVersion.match).toBe(false)
      expect(result.engineVersion.stored).toBe('0.9.0')
      expect(result.engineVersion.current).toBe(ENGINE_VERSION)
      expect(result.summary).toContain('Engine version drift')
    })
  })

  describe('tolerance settings', () => {
    it('respects custom numeric tolerance', async () => {
      const inputHash = await computeInputHash(AREA_INPUT)
      const { coordinateArea } = await import('@/lib/engine/area')
      const areaResult = coordinateArea(AREA_INPUT.coordinates)

      const record = makeRecord({
        engine: 'area',
        method: 'coordinate-area',
        inputHash,
        residuals: {
          areaM2: areaResult.areaSqm + 0.0001,
          areaHa: areaResult.areaHa,
          perimeterM: areaResult.perimeter,
        },
      })

      // Default tolerance (1e-6) — 0.0001 delta exceeds it
      const strict = await verifyProvenance({
        record,
        input: AREA_INPUT,
        engine: 'area',
      })
      expect(strict.residuals.match).toBe(false)

      // Custom tolerance (0.001) — 0.0001 delta is within it
      const relaxed = await verifyProvenance({
        record,
        input: AREA_INPUT,
        engine: 'area',
        numericTolerance: 0.001,
      })
      expect(relaxed.residuals.match).toBe(true)
    })
  })

  describe('summary output', () => {
    it('produces a human-readable summary for a valid record', async () => {
      const inputHash = await computeInputHash(AREA_INPUT)
      const { coordinateArea } = await import('@/lib/engine/area')
      const areaResult = coordinateArea(AREA_INPUT.coordinates)

      const record = makeRecord({
        engine: 'area',
        method: 'coordinate-area',
        inputHash,
        residuals: {
          areaM2: areaResult.areaSqm,
          areaHa: areaResult.areaHa,
          perimeterM: areaResult.perimeter,
        },
      })

      const result = await verifyProvenance({
        record,
        input: AREA_INPUT,
        engine: 'area',
      })

      expect(result.summary).toContain('Input hash: MATCH')
      expect(result.summary).toContain('Residuals: ALL')
      expect(result.summary).toContain('MATCH')
      expect(result.verifiedAt).toBeDefined()
      expect(result.inputDescriptor).toBe('test input')
    })
  })
})
