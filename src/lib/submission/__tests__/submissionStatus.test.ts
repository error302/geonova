import { buildSubmissionQAStatus } from '../submissionStatus'
import type { GNSSObservationReport } from '../gnssObservationReport'

function makeGNSSReport(
  verdict: GNSSObservationReport['verdict'],
  issues: Array<{ level: 'pass' | 'warn' | 'fail'; code: string; message: string }> = [],
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
    issues,
    verdict,
  }
}

describe('buildSubmissionQAStatus', () => {
  it('returns an empty view when no submission and no report exist', () => {
    const view = buildSubmissionQAStatus({})
    expect(view.hasPackage).toBe(false)
    expect(view.gnssFailures).toEqual([])
    expect(view.gnssWarnings).toEqual([])
    expect(view.gnssOverrideReason).toBeUndefined()
    expect(view.gnssVerdict).toBeUndefined()
  })

  it('surfaces the package summary when a submission exists', () => {
    const view = buildSubmissionQAStatus({
      submission: {
        submissionNumber: 'ISK/1234_2026_001_R01',
        packageStatus: 'ready',
        generatedAt: '2026-08-18T09:00:00.000Z',
      },
    })
    expect(view.hasPackage).toBe(true)
    expect(view.submissionNumber).toBe('ISK/1234_2026_001_R01')
    expect(view.packageStatus).toBe('ready')
  })

  it('exposes the underlying QC failures from a FAILED report', () => {
    const view = buildSubmissionQAStatus({
      gnssReport: makeGNSSReport('fail', [
        { level: 'fail', code: 'RATIO_BELOW_THRESHOLD', message: 'Ambiguity ratio 1.2 is below the 3.0 FIX threshold.' },
        { level: 'fail', code: 'QC_VERDICT_FAIL', message: 'Rover session QC failed: 22 cycle slips detected.' },
        { level: 'pass', code: 'SIGNAL_ACQUIRED', message: 'Signal acquired on all tracked satellites.' },
      ]),
    })
    expect(view.gnssVerdict).toBe('fail')
    expect(view.gnssReportId).toBe('gnss-report-001')
    expect(view.gnssFailures).toHaveLength(2)
    expect(view.gnssFailures.map((f) => f.code)).toEqual(['RATIO_BELOW_THRESHOLD', 'QC_VERDICT_FAIL'])
    expect(view.gnssWarnings).toEqual([])
  })

  it('separates QC warnings (warn level) from failures', () => {
    const view = buildSubmissionQAStatus({
      gnssReport: makeGNSSReport('warn', [
        { level: 'warn', code: 'MP_HIGH', message: 'Multipath RMS on L2 exceeds 0.5 m for 2 satellites.' },
      ]),
    })
    expect(view.gnssVerdict).toBe('warn')
    expect(view.gnssFailures).toEqual([])
    expect(view.gnssWarnings.map((w) => w.code)).toEqual(['MP_HIGH'])
  })

  it('extracts the verbatim override reason from the persisted QA result', () => {
    const view = buildSubmissionQAStatus({
      gnssReport: makeGNSSReport('fail'),
      validationResults: {
        passed: true,
        blockers: [],
        warnings: [
          {
            code: 'GNSS_QC_OVERRIDE',
            message: 'GNSS session QC FAILED but overridden: "Session re-observed after slip repair; report is superseded." (report gnss-report-001).',
          },
        ],
      },
    })
    expect(view.gnssOverrideReason).toBe('Session re-observed after slip repair; report is superseded.')
  })

  it('shows the override reason even when the stored report is absent', () => {
    const view = buildSubmissionQAStatus({
      validationResults: {
        passed: true,
        blockers: [],
        warnings: [{ code: 'GNSS_QC_OVERRIDE', message: 'GNSS session QC FAILED but overridden: "Legacy session archived." (report old-1).' }],
      },
    })
    expect(view.gnssOverrideReason).toBe('Legacy session archived.')
    expect(view.gnssVerdict).toBeUndefined()
  })

  it('falls back to the full warning message when the reason cannot be parsed', () => {
    const view = buildSubmissionQAStatus({
      validationResults: {
        passed: true,
        blockers: [],
        warnings: [{ code: 'GNSS_QC_OVERRIDE', message: 'Overridden per surveyor instruction.' }],
      },
    })
    expect(view.gnssOverrideReason).toBe('Overridden per surveyor instruction.')
  })

  it('ignores unrelated warnings when looking for an override', () => {
    const view = buildSubmissionQAStatus({
      gnssReport: makeGNSSReport('warn'),
      validationResults: {
        passed: true,
        blockers: [],
        warnings: [{ code: 'GNSS_QC_WARNING', message: 'GNSS session QC passed with warnings.' }],
      },
    })
    expect(view.gnssOverrideReason).toBeUndefined()
    expect(view.gnssVerdict).toBe('warn')
  })
})
