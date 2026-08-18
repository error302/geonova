import { validateSubmission } from '../validateSubmission'
import type { SubmissionPackage } from '../types'
import type { GNSSObservationReport } from '../gnssObservationReport'

/**
 * A minimal but VALID package: every baseline check passes so the tests
 * isolate the GNSS session QC gate.
 */
function makePackage(
  overrides: Partial<SubmissionPackage> = {},
): SubmissionPackage {
  return {
    submissionRef: 'REF-001',
    projectId: '00000000-0000-4000-8000-000000000001',
    surveyor: {
      registrationNumber: 'ISK/1234',
      iskNumber: '1234',
      verifiedIsk: true,
      fullName: 'A. Surveyor',
      firmName: 'Survey Firm',
      isKMemberActive: true,
    },
    subtype: 'cadastral_subdivision',
    parcel: {
      lrNumber: 'LR 123/456',
      parcelNumber: '123/456',
      county: 'Nairobi',
      division: 'Westlands',
      district: 'Nairobi',
      locality: 'Parklands',
      areaM2: 1000,
      perimeterM: 130,
      clientName: 'Client',
    },
    traverse: {
      points: [
        {
          pointName: 'A', easting: 0, northing: 0,
          adjustedEasting: 0, adjustedNorthing: 0,
          observedBearing: 0, observedDistance: 100,
        },
        {
          pointName: 'B', easting: 100, northing: 0,
          adjustedEasting: 100, adjustedNorthing: 0,
          observedBearing: 90, observedDistance: 100,
        },
        {
          pointName: 'C', easting: 100, northing: 100,
          adjustedEasting: 100, adjustedNorthing: 100,
          observedBearing: 180, observedDistance: 100,
        },
      ],
      angularMisclosure: 0,
      linearMisclosure: 0,
      precisionRatio: '1:10000',
      closingErrorE: 0,
      closingErrorN: 0,
      adjustmentMethod: 'bowditch',
      areaM2: 1000,
      perimeterM: 300,
    },
    supportingDocs: [],
    generatedAt: '2026-08-18T00:00:00.000Z',
    revision: 1,
    ...overrides,
  }
}

function makeGNSSReport(
  verdict: GNSSObservationReport['verdict'],
): GNSSObservationReport {
  return {
    reportId: 'gnss-report-001',
    reportType: 'GNSS_OBSERVATION_REPORT',
    generatedAt: '2026-08-18T08:00:00.000Z',
    inputHash: 'a'.repeat(64),
    inputFilesHash: 'b'.repeat(64),
    inputFiles: [],
    engineVersion: '1.0.0',
    stations: { base: 'BASE', rover: 'ROVER' },
    options: { mode: 'static', frequency: 'l1+l2', qcMode: 'rinex3_multignss' },
    solution: {
      final_solution: 'FLOAT',
      ratio: 1.2,
      satellites: 8,
      rover_latitude: -1.2921,
      rover_longitude: 36.8219,
      rover_height: 1790.5,
      sigma_north: 0.01,
      sigma_east: 0.01,
      sigma_up: 0.02,
    },
    issues:
      verdict === 'fail'
        ? [
            {
              level: 'fail',
              code: 'RATIO_BELOW_THRESHOLD',
              message: 'Ambiguity ratio 1.2 is below the 3.0 FIX threshold.',
            },
            {
              level: 'fail',
              code: 'QC_VERDICT_FAIL',
              message: 'Rover session QC failed: 22 cycle slips detected.',
            },
          ]
        : verdict === 'warn'
          ? [
              {
                level: 'warn',
                code: 'MP_HIGH',
                message: 'Multipath RMS on L2 exceeds 0.5 m for 2 satellites.',
              },
            ]
          : [],
    verdict,
  }
}

describe('validateSubmission — GNSS session QC gate', () => {
  it('passes when no GNSS observation report is stored', () => {
    const qa = validateSubmission(makePackage({ gnss: null }))
    expect(qa.passed).toBe(true)
    expect(qa.blockers).toHaveLength(0)
    expect(qa.warnings.some(w => w.code.startsWith('GNSS_'))).toBe(false)
  })

  it('passes a PASS-verdict GNSS report with no gate noise', () => {
    const qa = validateSubmission(
      makePackage({ gnss: makeGNSSReport('pass') }),
    )
    expect(qa.passed).toBe(true)
    expect(qa.blockers).toHaveLength(0)
    expect(qa.warnings.some(w => w.code.startsWith('GNSS_'))).toBe(false)
  })

  it('turns a WARN-verdict GNSS report into a non-blocking warning', () => {
    const qa = validateSubmission(
      makePackage({ gnss: makeGNSSReport('warn') }),
    )
    expect(qa.passed).toBe(true)
    expect(qa.warnings.some(w => w.code === 'GNSS_QC_WARNING')).toBe(true)
    expect(qa.blockers.some(b => b.code === 'GNSS_QC_FAILED')).toBe(false)
  })

  it('blocks assembly on a FAILED GNSS session without an override reason', () => {
    const qa = validateSubmission(
      makePackage({ gnss: makeGNSSReport('fail') }),
    )
    expect(qa.passed).toBe(false)
    const blocker = qa.blockers.find(b => b.code === 'GNSS_QC_FAILED')
    expect(blocker).toBeDefined()
    // The blocker surfaces the underlying QC failures for the surveyor.
    expect(blocker?.message ?? '').toContain('GNSS session QC FAILED')
    expect(blocker?.message ?? '').toContain('cycle slips')
    expect(blocker?.field).toBe('gnss')
  })

  it('passes assembly when the surveyor records an override reason', () => {
    const qa = validateSubmission(
      makePackage({ gnss: makeGNSSReport('fail') }),
      { gnssOverrideReason: 'Session re-observed after slip repair; report is superseded.' },
    )
    expect(qa.passed).toBe(true)
    expect(qa.blockers).toHaveLength(0)
    const override = qa.warnings.find(w => w.code === 'GNSS_QC_OVERRIDE')
    expect(override).toBeDefined()
    // The override reason is captured verbatim for the audit trail.
    expect(override?.message ?? '').toContain('Session re-observed after slip repair')
  })

  it('still blocks a blank/whitespace-only override reason', () => {
    const qa = validateSubmission(
      makePackage({ gnss: makeGNSSReport('fail') }),
      { gnssOverrideReason: '   ' },
    )
    expect(qa.passed).toBe(false)
    expect(qa.blockers.some(b => b.code === 'GNSS_QC_FAILED')).toBe(true)
  })
})

describe('validateSubmission — GNSS required-artifact gate', () => {
  it('blocks a GNSS-based subtype (geodetic_control) with no report', () => {
    const qa = validateSubmission(makePackage({ subtype: 'geodetic_control' }))
    expect(qa.passed).toBe(false)
    const blocker = qa.blockers.find(b => b.code === 'GNSS_REPORT_REQUIRED')
    expect(blocker).toBeDefined()
    expect(blocker?.field).toBe('gnss')
    expect(blocker?.message ?? '').toContain('required for geodetic_control submissions')
  })

  it('blocks a GNSS-based raw project survey type (geodetic) with no report', () => {
    // pkg.subtype is sourced from projects.survey_type at assembly time, so
    // the raw project type must also classify as GNSS-based.
    const qa = validateSubmission(makePackage({ subtype: 'geodetic' }))
    expect(qa.blockers.some(b => b.code === 'GNSS_REPORT_REQUIRED')).toBe(true)
  })

  it('blocks drone and deformation subtypes with no report', () => {
    for (const subtype of ['drone', 'deformation'] as const) {
      const qa = validateSubmission(makePackage({ subtype }))
      expect(qa.blockers.some(b => b.code === 'GNSS_REPORT_REQUIRED')).toBe(true)
    }
  })

  it('passes a GNSS-based subtype when the report is saved', () => {
    const qa = validateSubmission(
      makePackage({ subtype: 'geodetic_control', gnss: makeGNSSReport('pass') }),
    )
    expect(qa.passed).toBe(true)
    expect(qa.blockers.some(b => b.code === 'GNSS_REPORT_REQUIRED')).toBe(false)
  })

  it('does not block non-GNSS subtypes (cadastral) without a report', () => {
    const qa = validateSubmission(makePackage({ subtype: 'cadastral_subdivision' }))
    expect(qa.passed).toBe(true)
    expect(qa.blockers.some(b => b.code === 'GNSS_REPORT_REQUIRED')).toBe(false)
  })

  it('does not let an override bypass a MISSING report', () => {
    // The override only covers a FAILED session verdict — an absent report
    // must be generated and saved, not overridden.
    const qa = validateSubmission(
      makePackage({ subtype: 'geodetic_control' }),
      { gnssOverrideReason: 'Report lost in the field' },
    )
    expect(qa.passed).toBe(false)
    expect(qa.blockers.some(b => b.code === 'GNSS_REPORT_REQUIRED')).toBe(true)
    expect(qa.blockers.some(b => b.code === 'GNSS_QC_FAILED')).toBe(false)
  })
})
