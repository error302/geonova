/**
 * Tests for the Statutory Validation Gate.
 *
 * The gate is a pure function — no DB, no I/O — so tests construct
 * StatutoryGateInput objects directly and assert on the returned
 * StatutoryGateResult.
 *
 * Coverage:
 *   - Each rule in isolation (pass + fail case where applicable)
 *   - Tolerance profile auto-selection by surveyType
 *   - Severity ordering (block → warn → info)
 *   - passed flag reflects block count only
 *   - Graceful degradation when input fields are missing
 *   - Rule versioning is exposed
 *   - listRules() returns all registered rules
 *   - formatGateResult() produces readable output
 */

import {
  runStatutoryGate,
  formatGateResult,
  listRules,
  RULE_VERSION,
  type StatutoryGateInput,
} from '../statutoryGate'

// ─── Helpers ────────────────────────────────────────────────────────────

function makeBaseInput(overrides: Partial<StatutoryGateInput> = {}): StatutoryGateInput {
  const baseSurveyor = { name: 'Jane Doe', licenseNumber: 'ISK/LS/2020/123' }
  const { surveyor: overrideSurveyor, ...restOverrides } = overrides
  return {
    surveyType: 'cadastral',
    ...restOverrides,
    surveyor: {
      name: overrideSurveyor?.name ?? baseSurveyor.name,
      licenseNumber: overrideSurveyor?.licenseNumber ?? baseSurveyor.licenseNumber,
    },
  }
}

/** A passing cadastral traverse: 1:6000 precision, 4 stations, small misclosure. */
function makePassingTraverse() {
  return {
    stationCount: 4,
    angularMisclosureSeconds: 10, // well within 60×√4 = 120"
    linearErrorM: 0.005, // 5mm
    totalDistanceM: 1000, // 1 km → allowable 10√1 = 10 mm
    precisionRatio: 6000, // 1:6000, above cadastral minimum 1:5000
  }
}

/** A failing cadastral traverse: 1:2000 precision (below 1:5000 minimum). */
function makeFailingTraverse() {
  return {
    stationCount: 4,
    angularMisclosureSeconds: 10,
    linearErrorM: 0.005,
    totalDistanceM: 1000,
    precisionRatio: 2000, // below 1:5000
  }
}

describe('Statutory Validation Gate', () => {
  // ─── Overall behavior ─────────────────────────────────────────────────

  describe('runStatutoryGate', () => {
    it('passes with a valid cadastral input including passing traverse', () => {
      const input = makeBaseInput({ traverse: makePassingTraverse() })
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(true)
      expect(result.summary.block).toBe(0)
    })

    it('blocks when traverse precision is below profile minimum', () => {
      const input = makeBaseInput({ traverse: makeFailingTraverse() })
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(false)
      expect(result.summary.block).toBeGreaterThanOrEqual(1)
      const precisionViolation = result.violations.find(
        (v) => v.rule === 'rdm_1_1.traverse_precision'
      )
      expect(precisionViolation).toBeDefined()
      expect(precisionViolation!.severity).toBe('block')
      expect(precisionViolation!.actual).toBe(2000)
      expect(precisionViolation!.allowable).toBe(5000)
    })

    it('blocks when surveyor name is missing', () => {
      const input = makeBaseInput({
        surveyor: { name: '', licenseNumber: 'ISK/LS/2020/123' },
      })
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(false)
      expect(
        result.violations.some((v) => v.rule === 'sok_standard.surveyor_name_required')
      ).toBe(true)
    })

    it('blocks when surveyor license is missing', () => {
      const input = makeBaseInput({
        surveyor: { name: 'Jane Doe', licenseNumber: '' },
      })
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(false)
      expect(
        result.violations.some((v) => v.rule === 'sok_standard.surveyor_license_required')
      ).toBe(true)
    })

    it('warns (does not block) when license format is non-standard', () => {
      const input = makeBaseInput({
        surveyor: { name: 'Jane Doe', licenseNumber: 'LEGACY-123' },
      })
      const result = runStatutoryGate(input)
      const formatViolation = result.violations.find(
        (v) => v.rule === 'sok_standard.surveyor_license_format'
      )
      expect(formatViolation).toBeDefined()
      expect(formatViolation!.severity).toBe('warn')
      // Should not block — warn only
      const blockViolations = result.violations.filter((v) => v.severity === 'block')
      expect(blockViolations.some((v) => v.rule === 'sok_standard.surveyor_license_format')).toBe(false)
    })
  })

  // ─── Tolerance profile auto-selection ────────────────────────────────

  describe('profile auto-selection', () => {
    it('selects cadastral profile for cadastral surveys', () => {
      const input = makeBaseInput({ surveyType: 'cadastral' })
      const result = runStatutoryGate(input)
      expect(result.profile).toBe('cadastral')
    })

    it('selects engineering profile for engineering surveys', () => {
      const input = makeBaseInput({ surveyType: 'engineering' })
      const result = runStatutoryGate(input)
      expect(result.profile).toBe('engineering')
    })

    it('selects control profile for geodetic surveys', () => {
      const input = makeBaseInput({ surveyType: 'geodetic' })
      const result = runStatutoryGate(input)
      expect(result.profile).toBe('control')
    })

    it('respects toleranceProfileOverride over auto-selection', () => {
      const input = makeBaseInput({
        surveyType: 'cadastral',
        toleranceProfileOverride: 'control',
      })
      const result = runStatutoryGate(input)
      expect(result.profile).toBe('control')
    })

    it('applies stricter precision threshold for control profile', () => {
      // 1:6000 passes cadastral (1:5000) but fails control (1:20000)
      const input = makeBaseInput({
        surveyType: 'geodetic',
        traverse: makePassingTraverse(), // 1:6000
      })
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(false)
      expect(
        result.violations.some(
          (v) => v.rule === 'rdm_1_1.traverse_precision' && v.allowable === 20000
        )
      ).toBe(true)
    })
  })

  // ─── Traverse rules ──────────────────────────────────────────────────

  describe('traverse rules', () => {
    it('blocks on angular misclosure exceeding √n × 60" for cadastral', () => {
      // 4 stations → allowable 60×√4 = 120"
      const input = makeBaseInput({
        traverse: {
          stationCount: 4,
          angularMisclosureSeconds: 150, // exceeds 120"
          linearErrorM: 0.001,
          totalDistanceM: 100,
          precisionRatio: 6000,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'cap299.angular_misclosure')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('blocks on linear misclosure exceeding 10√K mm for cadastral', () => {
      // 1 km traverse → allowable 10√1 = 10 mm
      const input = makeBaseInput({
        traverse: {
          stationCount: 4,
          angularMisclosureSeconds: 5,
          linearErrorM: 0.05, // 50 mm — far above 10 mm
          totalDistanceM: 1000,
          precisionRatio: 6000,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.linear_misclosure')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('blocks on insufficient station count for cadastral (<3)', () => {
      const input = makeBaseInput({
        traverse: {
          stationCount: 2,
          angularMisclosureSeconds: 0,
          linearErrorM: 0,
          totalDistanceM: 100,
          precisionRatio: 6000,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'cap299.min_stations')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('does not enforce min station count for engineering surveys', () => {
      const input = makeBaseInput({
        surveyType: 'engineering',
        traverse: {
          stationCount: 2,
          angularMisclosureSeconds: 0,
          linearErrorM: 0,
          totalDistanceM: 100,
          precisionRatio: 15000,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'cap299.min_stations')
      ).toBe(false)
    })
  })

  // ─── Leveling rules ──────────────────────────────────────────────────

  describe('leveling rules', () => {
    it('blocks on arithmetic check failure', () => {
      // ΣBS − ΣFS should equal Last RL − First RL
      // Here: (1.5 − 0.5) = 1.0 but (100.5 − 100.0) = 0.5 → mismatch
      const input = makeBaseInput({
        leveling: {
          sumBS: 1.5,
          sumFS: 0.5,
          firstRL: 100.0,
          lastRL: 100.5, // expected 1.0 difference, got 0.5
          distanceKm: 0.5,
          type: 'ordinary' as const,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'survey_regs_1994.leveling_arithmetic')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('blocks on leveling closure exceeding 10√K mm for ordinary', () => {
      // 1 km ordinary leveling → allowable 10√1 = 10 mm = 0.010 m
      // Arithmetic must balance: ΣBS - ΣFS must equal lastRL - firstRL
      // Closing error of 50mm: firstRL=100.0, lastRL=100.05, so
      // ΣBS - ΣFS must also = 0.05 to pass arithmetic check, then
      // the closing error of 0.05m = 50mm exceeds the 10mm allowable.
      const input = makeBaseInput({
        leveling: {
          sumBS: 1.55,
          sumFS: 1.5, // arithmetic: 1.55 - 1.5 = 0.05 = lastRL - firstRL 
          firstRL: 100.0,
          lastRL: 100.05, // 50 mm closing error
          distanceKm: 1.0,
          type: 'ordinary' as const,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.leveling_closure')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('applies 5√K mm for precise leveling (stricter)', () => {
      // 1 km precise leveling → allowable 5√1 = 5 mm
      // 8mm closure fails precise but passes ordinary
      // Arithmetic balance: ΣBS - ΣFS = lastRL - firstRL = 0.008
      const preciseInput = makeBaseInput({
        leveling: {
          sumBS: 1.508,
          sumFS: 1.5, // arithmetic: 1.508 - 1.5 = 0.008 = lastRL - firstRL 
          firstRL: 100.0,
          lastRL: 100.008, // 8 mm
          distanceKm: 1.0,
          type: 'precise' as const,
        },
      })
      const preciseResult = runStatutoryGate(preciseInput)
      expect(preciseResult.passed).toBe(false)

      const ordinaryInput = makeBaseInput({
        leveling: {
          sumBS: 1.508,
          sumFS: 1.5,
          firstRL: 100.0,
          lastRL: 100.008,
          distanceKm: 1.0,
          type: 'ordinary' as const,
        },
      })
      const ordinaryResult = runStatutoryGate(ordinaryInput)
      // 8 mm < 10 mm allowable for ordinary → passes closure rule
      expect(
        ordinaryResult.violations.some((v) => v.rule === 'rdm_1_1.leveling_closure')
      ).toBe(false)
    })
  })

  // ─── Parcel rules ────────────────────────────────────────────────────

  describe('parcel rules', () => {
    it('blocks when a parcel has fewer than 3 vertices', () => {
      const input = makeBaseInput({
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'A', easting: 0, northing: 0 },
              { name: 'B', easting: 50, northing: 0 },
              // only 2 vertices — needs 3 minimum
            ],
          },
        ],
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'ardhisasa.parcel_min_vertices')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('passes when a parcel has 3+ vertices', () => {
      const input = makeBaseInput({
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'A', easting: 0, northing: 0 },
              { name: 'B', easting: 50, northing: 0 },
              { name: 'C', easting: 50, northing: 50 },
            ],
          },
        ],
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'ardhisasa.parcel_min_vertices')
      ).toBe(false)
    })

    it('blocks on area reconciliation mismatch for subdivisions', () => {
      // Parent: 1.0 ha square (100m × 100m)
      // Two parts: 0.4 ha + 0.4 ha = 0.8 ha — mismatch of 0.2 ha
      const input = makeBaseInput({
        submissionType: 'subdivision',
        parentParcel: {
          areaHectares: 1.0,
          vertices: [
            { name: 'A', easting: 0, northing: 0 },
            { name: 'B', easting: 100, northing: 0 },
            { name: 'C', easting: 100, northing: 100 },
            { name: 'D', easting: 0, northing: 100 },
          ],
        },
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'A', easting: 0, northing: 0 },
              { name: 'B', easting: 100, northing: 0 },
              { name: 'C', easting: 100, northing: 40 },
              { name: 'D', easting: 0, northing: 40 },
            ], // 0.4 ha
          },
          {
            parcelNumber: 'P/002',
            vertices: [
              { name: 'E', easting: 0, northing: 40 },
              { name: 'F', easting: 100, northing: 40 },
              { name: 'G', easting: 100, northing: 80 },
              { name: 'H', easting: 0, northing: 80 },
            ], // 0.4 ha
          },
        ],
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'ardhisasa.area_reconciliation')
      ).toBe(true)
      expect(result.passed).toBe(false)
    })

    it('skips area reconciliation for non-submission survey types', () => {
      // Same shape as above but no submissionType — rule should not fire
      const input = makeBaseInput({
        // submissionType omitted
        parentParcel: {
          areaHectares: 1.0,
          vertices: [
            { name: 'A', easting: 0, northing: 0 },
            { name: 'B', easting: 100, northing: 0 },
            { name: 'C', easting: 100, northing: 100 },
            { name: 'D', easting: 0, northing: 100 },
          ],
        },
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'A', easting: 0, northing: 0 },
              { name: 'B', easting: 50, northing: 0 },
              { name: 'C', easting: 50, northing: 50 },
            ],
          },
        ],
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'ardhisasa.area_reconciliation')
      ).toBe(false)
    })
  })

  // ─── Beacon nomenclature ─────────────────────────────────────────────

  describe('beacon nomenclature', () => {
    it('warns (does not block) on non-standard beacon names', () => {
      const input = makeBaseInput({
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'corner-1', easting: 0, northing: 0 }, // non-standard
              { name: 'B', easting: 50, northing: 0 },
              { name: 'C', easting: 50, northing: 50 },
            ],
          },
        ],
      })
      const result = runStatutoryGate(input)
      const nomenclatureViolation = result.violations.find(
        (v) => v.rule === 'sok_standard.beacon_nomenclature'
      )
      expect(nomenclatureViolation).toBeDefined()
      expect(nomenclatureViolation!.severity).toBe('warn')
    })

    it('does not warn on standard KP/MB/IRP/RMB beacon names', () => {
      const input = makeBaseInput({
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'KP/1/1', easting: 0, northing: 0 },
              { name: 'KP/1/2', easting: 50, northing: 0 },
              { name: 'KP/1/3', easting: 50, northing: 50 },
            ],
          },
        ],
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'sok_standard.beacon_nomenclature')
      ).toBe(false)
    })
  })

  // ─── Severity ordering and structure ────────────────────────────────

  describe('result structure', () => {
    it('orders violations block → warn → info', () => {
      const input = makeBaseInput({
        surveyor: { name: '', licenseNumber: '' }, // 2 block violations
        parcels: [
          {
            parcelNumber: 'P/001',
            vertices: [
              { name: 'weird-name', easting: 0, northing: 0 },
              { name: 'B', easting: 50, northing: 0 },
              { name: 'C', easting: 50, northing: 50 },
            ],
          },
        ], // 1 warn violation (beacon nomenclature)
      })
      const result = runStatutoryGate(input)
      const severities = result.violations.map((v) => v.severity)
      const firstWarnIdx = severities.indexOf('warn')
      const lastBlockIdx = severities.lastIndexOf('block')
      expect(lastBlockIdx).toBeLessThan(firstWarnIdx)
    })

    it('returns evaluatedAt as a valid ISO timestamp', () => {
      const result = runStatutoryGate(makeBaseInput())
      expect(() => new Date(result.evaluatedAt).toISOString()).not.toThrow()
    })

    it('exposes rule version', () => {
      const result = runStatutoryGate(makeBaseInput())
      expect(result.ruleVersion).toBe(RULE_VERSION)
      expect(result.ruleVersion).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('summary counts match violations', () => {
      const input = makeBaseInput({
        surveyor: { name: '', licenseNumber: 'weird' },
      })
      const result = runStatutoryGate(input)
      expect(result.summary.total).toBe(result.violations.length)
      expect(result.summary.block + result.summary.warn + result.summary.info).toBe(
        result.summary.total
      )
    })

    it('passed is true iff summary.block === 0', () => {
      const passingInput = makeBaseInput()
      const passingResult = runStatutoryGate(passingInput)
      expect(passingResult.passed).toBe(passingResult.summary.block === 0)

      const failingInput = makeBaseInput({
        surveyor: { name: '', licenseNumber: '' },
      })
      const failingResult = runStatutoryGate(failingInput)
      expect(failingResult.passed).toBe(failingResult.summary.block === 0)
    })
  })

  // ─── Graceful degradation ────────────────────────────────────────────

  describe('graceful degradation', () => {
    it('passes with minimal input (surveyor only)', () => {
      // No traverse, no leveling, no parcels — gate should not fail
      // because there's nothing to validate. Only surveyor rules fire.
      const input = makeBaseInput()
      const result = runStatutoryGate(input)
      expect(result.passed).toBe(true)
      expect(result.summary.block).toBe(0)
    })

    it('does not throw when traverse is partially populated', () => {
      const input = makeBaseInput({
        traverse: {
          stationCount: 4,
          // angularMisclosureSeconds omitted
          linearErrorM: 0.005,
          totalDistanceM: 1000,
          precisionRatio: 6000,
        },
      })
      expect(() => runStatutoryGate(input)).not.toThrow()
      const result = runStatutoryGate(input)
      // Should skip angular misclosure rule, not fail on it
      expect(
        result.violations.some((v) => v.rule === 'cap299.angular_misclosure')
      ).toBe(false)
    })
  })

  // ─── Engineering design rules (KeNHA / KeRRA / RDM 1.1 §2.3) ────────

  describe('engineering rules', () => {
    it('blocks when horizontal curve radius is below minimum for design speed', () => {
      // At 80 km/h, e=0.07, f=0.15: R_min = 80²/(127×0.22) = 6400/27.94 ≈ 229 m
      // Provide 150 m — below minimum
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          horizontalCurveRadiusM: 150,
        },
      })
      const result = runStatutoryGate(input)
      const curveViolation = result.violations.find(
        (v) => v.rule === 'rdm_1_1.min_curve_radius'
      )
      expect(curveViolation).toBeDefined()
      expect(curveViolation!.severity).toBe('block')
      expect(curveViolation!.actual).toBe(150)
      expect(curveViolation!.allowable).toBeGreaterThan(200)
      expect(result.passed).toBe(false)
    })

    it('passes when horizontal curve radius exceeds minimum', () => {
      // At 80 km/h: R_min ≈ 229 m. Provide 300 m — above minimum
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          horizontalCurveRadiusM: 300,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.min_curve_radius')
      ).toBe(false)
    })

    it('blocks when available sight distance is below SSD', () => {
      // At 80 km/h, grade 0: SSD = 0.278×80×2.5 + 80²/(254×0.35) = 55.6 + 71.9 ≈ 127 m
      // Provide 80 m — below SSD
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          availableSightDistanceM: 80,
        },
      })
      const result = runStatutoryGate(input)
      const ssdViolation = result.violations.find(
        (v) => v.rule === 'rdm_1_1.sight_distance'
      )
      expect(ssdViolation).toBeDefined()
      expect(ssdViolation!.severity).toBe('block')
      expect(ssdViolation!.actual).toBe(80)
      expect(ssdViolation!.allowable).toBeGreaterThan(100)
      expect(result.passed).toBe(false)
    })

    it('passes when available sight distance exceeds SSD', () => {
      // At 80 km/h: SSD ≈ 127 m. Provide 200 m — above SSD
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          availableSightDistanceM: 200,
        },
      })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.sight_distance')
      ).toBe(false)
    })

    it('warns (does not block) when superelevation exceeds 7% normal max', () => {
      // 8% superelevation — above 7% normal but below 10% absolute
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          superelevation: 0.08,
        },
      })
      const result = runStatutoryGate(input)
      const superViolation = result.violations.find(
        (v) => v.rule === 'kenha.superelevation_high'
      )
      expect(superViolation).toBeDefined()
      expect(superViolation!.severity).toBe('warn')
      // Should not produce a block-level superelevation violation
      expect(
        result.violations.some((v) => v.rule === 'kenha.superelevation_absolute_max')
      ).toBe(false)
    })

    it('blocks when superelevation exceeds 10% absolute max', () => {
      // 12% superelevation — above 10% absolute cap
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          superelevation: 0.12,
        },
      })
      const result = runStatutoryGate(input)
      const superViolation = result.violations.find(
        (v) => v.rule === 'kenha.superelevation_absolute_max'
      )
      expect(superViolation).toBeDefined()
      expect(superViolation!.severity).toBe('block')
      expect(result.passed).toBe(false)
    })

    it('does not fire engineering rules when engineering field is absent', () => {
      // No engineering data — rules should be skipped, not fail
      const input = makeBaseInput({ surveyType: 'engineering' })
      const result = runStatutoryGate(input)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.min_curve_radius')
      ).toBe(false)
      expect(
        result.violations.some((v) => v.rule === 'rdm_1_1.sight_distance')
      ).toBe(false)
      expect(
        result.violations.some((v) => v.rule === 'kenha.superelevation_high')
      ).toBe(false)
    })

    it('respects custom superelevation and side friction in curve radius calc', () => {
      // At 80 km/h with e=0.10, f=0.10: R_min = 80²/(127×0.20) = 6400/25.4 ≈ 252 m
      // Provide 240 m — below this custom minimum
      const input = makeBaseInput({
        surveyType: 'engineering',
        engineering: {
          designSpeedKph: 80,
          horizontalCurveRadiusM: 240,
          superelevation: 0.10,
          sideFriction: 0.10,
        },
      })
      const result = runStatutoryGate(input)
      const curveViolation = result.violations.find(
        (v) => v.rule === 'rdm_1_1.min_curve_radius'
      )
      expect(curveViolation).toBeDefined()
      expect(curveViolation!.allowable).toBeGreaterThan(240)
    })
  })

  // ─── Rule registry ───────────────────────────────────────────────────

  describe('listRules', () => {
    it('returns all registered rules with required fields', () => {
      const rules = listRules()
      expect(rules.length).toBeGreaterThanOrEqual(13)
      for (const rule of rules) {
        expect(rule.id).toMatch(/^[a-z0-9_]+\.[a-z0-9_]+$/)
        expect(rule.description).toBeTruthy()
        expect(['cap299', 'survey_regs_1994', 'rdm_1_1', 'ardhisasa', 'lra_2012', 'sok_standard']).toContain(rule.source)
        expect(['block', 'warn', 'info']).toContain(rule.severity)
      }
    })

    it('includes the cap299.min_stations rule', () => {
      expect(listRules().some((r) => r.id === 'cap299.min_stations')).toBe(true)
    })

    it('includes the ardhisasa.area_reconciliation rule', () => {
      expect(listRules().some((r) => r.id === 'ardhisasa.area_reconciliation')).toBe(true)
    })
  })

  // ─── formatGateResult ────────────────────────────────────────────────

  describe('formatGateResult', () => {
    it('includes PASS/BLOCKED status in output', () => {
      const passingResult = runStatutoryGate(makeBaseInput())
      const passingText = formatGateResult(passingResult)
      expect(passingText).toContain('PASS')

      const failingResult = runStatutoryGate(
        makeBaseInput({ surveyor: { name: '', licenseNumber: '' } })
      )
      const failingText = formatGateResult(failingResult)
      expect(failingText).toContain('BLOCKED')
    })

    it('includes rule version and profile in output', () => {
      const result = runStatutoryGate(makeBaseInput())
      const text = formatGateResult(result)
      expect(text).toContain('Rule version:')
      expect(text).toContain('Profile:')
    })

    it('lists all violations with their rule id and source', () => {
      const result = runStatutoryGate(
        makeBaseInput({ surveyor: { name: '', licenseNumber: '' } })
      )
      const text = formatGateResult(result)
      expect(text).toContain('sok_standard.surveyor_name_required')
      expect(text).toContain('sok_standard.surveyor_license_required')
    })

    it('states "All checks passed" when there are no violations', () => {
      const result = runStatutoryGate(makeBaseInput())
      const text = formatGateResult(result)
      expect(text).toContain('All checks passed')
    })
  })
})
