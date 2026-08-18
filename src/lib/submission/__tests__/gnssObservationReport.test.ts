import {
  buildGNSSObservationReport,
  buildGNSSVerificationPayload,
  computeGNSSVerificationChecksum,
  computeInputFilesHash,
  generateGNSSReportId,
  GNSS_OBSERVATION_REPORT_ARTIFACT_KEY,
  GNSS_REPORT_THRESHOLDS,
  GNSS_VERIFICATION_FORMAT,
  renderGNSSVerificationQR,
  resolveGNSSReportVerdict,
} from '../gnssObservationReport'
import type { BaselineProcessResult, GNSSSessionQC } from '@/lib/online/gnssBaseline'

function makeBaseline(
  overrides: Partial<BaselineProcessResult> = {},
): BaselineProcessResult {
  return {
    rover_latitude: -1.2921,
    rover_longitude: 36.8219,
    rover_height: 1790.5,
    sigma_north: 0.008,
    sigma_east: 0.007,
    sigma_up: 0.015,
    quality: 'FIX',
    sat_count: 9,
    ratio: 3.5,
    raw_output: '% RTKLIB demo5\n2026/08/15 10:00:00.000 -1.29210000 36.82190000 1790.5000 1 9 0.0080 0.0070 0.0150 0.000 0.000 0.000 0 3.5',
    ...overrides,
  }
}

function makeQC(
  overrides: Partial<GNSSSessionQC> = {},
): GNSSSessionQC {
  return {
    base: {
      station: 'BASE',
      available: true,
      epoch_count: 3600,
      start_utc: '2026-08-15T08:00:00+00:00',
      end_utc: '2026-08-15T09:00:00+00:00',
      duration_minutes: 60,
      interval_sec: 1,
      mean_sats_per_epoch: 9,
      min_sats: 7,
      max_sats: 11,
      systems: { G: 8, E: 3 },
      total_cycle_slips: 2,
      slip_ratio: 0.0006,
      satellites: [
        {
          satellite: 'G01',
          system: 'G',
          tracked_epochs: 3580,
          tracking_pct: 99.4,
          snr_l1_mean: 46.2,
          snr_l1_max: 52.0,
          snr_l2_mean: 41.0,
          mp1_mean_m: 0.18,
          mp1_std_m: 0.11,
          mp2_mean_m: 0.21,
          mp2_std_m: 0.13,
          cycle_slips: 0,
          slip_method: 'geometry_free',
        },
      ],
      issues: [],
      verdict: 'pass',
    },
    rover: {
      station: 'ROVER',
      available: true,
      epoch_count: 3600,
      start_utc: '2026-08-15T08:00:00+00:00',
      end_utc: '2026-08-15T09:00:00+00:00',
      duration_minutes: 60,
      interval_sec: 1,
      mean_sats_per_epoch: 9,
      min_sats: 6,
      max_sats: 11,
      systems: { G: 8, E: 3 },
      total_cycle_slips: 4,
      slip_ratio: 0.0011,
      satellites: [
        {
          satellite: 'G01',
          system: 'G',
          tracked_epochs: 3595,
          tracking_pct: 99.9,
          snr_l1_mean: 45.8,
          snr_l1_max: 51.0,
          snr_l2_mean: 40.5,
          mp1_mean_m: 0.22,
          mp1_std_m: 0.12,
          mp2_mean_m: 0.24,
          mp2_std_m: 0.14,
          cycle_slips: 1,
          slip_method: 'geometry_free',
        },
      ],
      issues: [],
      verdict: 'pass',
    },
    ...overrides,
  }
}

describe('resolveGNSSReportVerdict', () => {
  it('passes a fixed solution with a good ratio and tight sigmas', () => {
    const { verdict, issues } = resolveGNSSReportVerdict(makeBaseline(), makeQC())
    expect(verdict).toBe('pass')
    expect(issues.some((i) => i.code === 'FIXED_SOLUTION')).toBe(true)
    expect(issues.some((i) => i.code === 'RATIO_OK')).toBe(true)
    expect(issues.some((i) => i.code === 'SIGMA_OK')).toBe(true)
  })

  it('warns on a float solution regardless of sigmas', () => {
    const { verdict } = resolveGNSSReportVerdict(
      makeBaseline({ quality: 'FLOAT', ratio: 1.2 }),
      makeQC()
    )
    expect(verdict).toBe('warn')
  })

  it('fails on a non-fixed solution below survey grade', () => {
    const { verdict, issues } = resolveGNSSReportVerdict(
      makeBaseline({ quality: 'SINGLE' }),
      makeQC()
    )
    expect(verdict).toBe('fail')
    expect(issues.some((i) => i.code === 'NON_FIXED_SOLUTION')).toBe(true)
  })

  it('fails on a low ambiguity ratio on a fixed solution', () => {
    const { verdict } = resolveGNSSReportVerdict(
      makeBaseline({ ratio: 1.1 }),
      makeQC()
    )
    expect(verdict).toBe('fail')
  })

  it('fails on poor 2D precision', () => {
    const { verdict } = resolveGNSSReportVerdict(
      makeBaseline({ sigma_north: 0.12, sigma_east: 0.12 }),
      makeQC()
    )
    expect(verdict).toBe('fail')
  })

  it('propagates a failing station QC verdict to the report', () => {
    const qc = makeQC()
    qc.rover.verdict = 'fail'
    qc.rover.issues = [
      { level: 'fail', code: 'HIGH_MULTIPATH', message: 'G05: mean MP1 1.40 m (> 1.0 m)' },
    ]
    const { verdict, issues } = resolveGNSSReportVerdict(makeBaseline(), qc)
    expect(verdict).toBe('fail')
    expect(issues.some((i) => i.code === 'HIGH_MULTIPATH_ROVER')).toBe(true)
  })

  it('warns (but does not fail) when QC is unavailable', () => {
    const { verdict } = resolveGNSSReportVerdict(makeBaseline(), undefined)
    expect(verdict).toBe('warn')
  })

  it('checks kinematic fix percentage when epochs are present', () => {
    const baseline = makeBaseline({
      epoch_solutions: { FIX: 700, FLOAT: 300, SBAS: 0, DGPS: 0, SINGLE: 0, PPP: 0, UNKNOWN: 0 },
      solution_summary: {
        final_solution: 'FLOAT',
        epochs: 1000,
        fixed_epochs: 700,
        float_epochs: 300,
        fix_pct: 70,
        ratio: 2.0,
      },
    })
    const { verdict, issues } = resolveGNSSReportVerdict(baseline, makeQC())
    expect(verdict).toBe('fail')
    expect(issues.some((i) => i.code === 'FIX_PCT_LOW')).toBe(true)
  })
})

describe('buildGNSSObservationReport', () => {
  it('builds a structured report with solution + QC + verdict', async () => {
    const { report, verdict } = await buildGNSSObservationReport({
      baseline: makeBaseline(),
      qc: makeQC(),
      baseStation: 'KIS-BASE',
      roverStation: 'KIS-ROV',
      options: { mode: 'static', frequency: 'l1+l2', elevationMask: 15, ambiguityResolution: 'fix' },
      surveyor: { name: 'J. Kamau', registrationNumber: 'RS149' },
    })

    expect(verdict).toBe('pass')
    expect(report.reportType).toBe('GNSS_OBSERVATION_REPORT')
    expect(report.stations).toEqual({ base: 'KIS-BASE', rover: 'KIS-ROV' })
    expect(report.solution.final_solution).toBe('FIX')
    expect(report.qc?.rover.verdict).toBe('pass')
    expect(report.issues.length).toBeGreaterThan(0)
  })

  it('renders a printable text report with the verdict line', async () => {
    const { text } = await buildGNSSObservationReport({
      baseline: makeBaseline(),
      qc: makeQC(),
    })
    expect(text).toContain('METARDU — GNSS OBSERVATION REPORT')
    expect(text).toContain('Report ID:')
    expect(text).toContain('FIXED (integer ambiguity resolved)')
    expect(text).toContain('PASS — observation session meets survey-grade acceptance criteria.')
    expect(text).toContain('G01') // per-satellite QC table
  })

  it('embeds a deterministic input hash and engine version (self-certifying)', async () => {
    const baseline = makeBaseline()
    const first = await buildGNSSObservationReport({ baseline, qc: makeQC() })
    const second = await buildGNSSObservationReport({ baseline, qc: makeQC() })

    // Same input → same hash; different report ids must not break determinism.
    expect(first.report.inputHash).toMatch(/^[0-9a-f]{64}$/)
    expect(second.report.inputHash).toBe(first.report.inputHash)
    expect(first.report.engineVersion).toMatch(/^\d+\.\d+\.\d+$/)
    // The printable artifact cross-references the same hash.
    expect(first.text).toContain(`Input hash: ${first.report.inputHash}`)
    expect(first.text).toContain('court-grade reproducibility')
  })

  it('changes the input hash when the baseline input changes', async () => {
    const baseline = makeBaseline()
    const a = await buildGNSSObservationReport({ baseline, qc: makeQC() })
    const b = await buildGNSSObservationReport({
      baseline: { ...baseline, ratio: 4.2 },
      qc: makeQC(),
    })
    expect(a.report.inputHash).not.toBe(b.report.inputHash)
  })

  it('embeds the raw RINEX file digests and a combined files hash (court-grade)', async () => {
    const baseline = makeBaseline()
    const files = [
      { role: 'base' as const, fileName: 'BASE0010.24o', sizeBytes: 120_000, sha256: 'ab'.repeat(32) },
      { role: 'rover' as const, fileName: 'ROVR0010.24o', sizeBytes: 118_000, sha256: 'cd'.repeat(32) },
      { role: 'nav' as const, fileName: 'BRDC0010.24n', sizeBytes: 60_000, sha256: 'ef'.repeat(32) },
    ]
    const { report, text } = await buildGNSSObservationReport({ baseline, qc: makeQC(), inputFiles: files })

    expect(report.inputFiles).toHaveLength(3)
    expect(report.inputFilesHash).toMatch(/^[0-9a-f]{64}$/)
    expect(report.inputFilesHash).toBe(await computeInputFilesHash(files))
    // The printable artifact lists every input file and its digest.
    for (const f of files) {
      expect(text).toContain(f.fileName)
      expect(text).toContain(f.sha256)
    }
    expect(text).toContain(`Input files hash: ${report.inputFilesHash}`)
  })

  it('computes the combined files hash independent of array order', async () => {
    const a = { role: 'base' as const, fileName: 'B.24o', sizeBytes: 1, sha256: 'aa'.repeat(32) }
    const b = { role: 'rover' as const, fileName: 'R.24o', sizeBytes: 2, sha256: 'bb'.repeat(32) }
    expect(await computeInputFilesHash([a, b])).toBe(await computeInputFilesHash([b, a]))
    expect(await computeInputFilesHash([a, b])).not.toBe(await computeInputFilesHash([{ ...b, sha256: 'cc'.repeat(32) }, a]))
  })

  it('hashes empty input files deterministically', async () => {
    const baseline = makeBaseline()
    const first = await buildGNSSObservationReport({ baseline, qc: makeQC() })
    const second = await buildGNSSObservationReport({ baseline, qc: makeQC() })
    expect(first.report.inputFilesHash).toBe(second.report.inputFilesHash)
    expect(first.report.inputFiles).toEqual([])
    expect(first.text).toContain('no raw RINEX file digests were recorded')
  })

  it('generates unique report ids', () => {
    expect(generateGNSSReportId()).not.toBe(generateGNSSReportId())
  })
})

describe('GNSS observation report artifact key', () => {
  it('is the key used by the manifest mapping', () => {
    expect(GNSS_OBSERVATION_REPORT_ARTIFACT_KEY).toBe('gnss_observation_report')
    expect(GNSS_REPORT_THRESHOLDS.ratioGood).toBe(3.0)
  })
})

describe('GNSS on-site verification block (QR + machine-readable)', () => {
  it('builds the canonical 4-line verification payload', async () => {
    const { report } = await buildGNSSObservationReport({ baseline: makeBaseline(), qc: makeQC() })
    const payload = buildGNSSVerificationPayload(report)
    const lines = payload.split('\n')

    expect(lines).toHaveLength(4)
    expect(lines[0]).toBe(GNSS_VERIFICATION_FORMAT)
    expect(lines[1]).toBe(`reportId=${report.reportId}`)
    expect(lines[2]).toBe(`inputFilesHash=${report.inputFilesHash}`)
    expect(lines[3]).toBe(`engineVersion=${report.engineVersion}`)
  })

  it('embeds the payload and a recomputable checksum on the report', async () => {
    const { report } = await buildGNSSObservationReport({ baseline: makeBaseline(), qc: makeQC() })

    expect(report.verificationPayload).toBe(buildGNSSVerificationPayload(report))
    expect(report.verificationChecksum).toMatch(/^[0-9a-f]{64}$/)
    // The checksum is exactly sha256 of the canonical payload — a verifier
    // can recompute it from whatever the scanner read.
    expect(report.verificationChecksum).toBe(
      await computeGNSSVerificationChecksum(report.verificationPayload ?? '')
    )
  })

  it('renders a deterministic, uniform-width text QR', async () => {
    const { report } = await buildGNSSObservationReport({ baseline: makeBaseline(), qc: makeQC() })
    const payload = report.verificationPayload ?? ''
    const qr = renderGNSSVerificationQR(payload)
    const lines = qr.split('\n')

    expect(lines.length).toBeGreaterThan(15)
    // Every line is the same width (quiet zone + symbol + quiet zone).
    expect(new Set(lines.map((l) => l.length)).size).toBe(1)
    // Only the half-block alphabet is used.
    expect([...qr].every((c) => ['█', '▀', '▄', ' ', '\n'].includes(c))).toBe(true)
    // Deterministic for the same payload, sensitive to payload changes.
    expect(renderGNSSVerificationQR(payload)).toBe(qr)
    expect(renderGNSSVerificationQR(payload + 'x')).not.toBe(qr)
  })

  it('prints the verification section (QR + machine block) in the report text', async () => {
    const { report, text } = await buildGNSSObservationReport({ baseline: makeBaseline(), qc: makeQC() })

    expect(text).toContain('On-site verification')
    expect(text).toContain(GNSS_VERIFICATION_FORMAT)
    expect(text).toContain(`reportId=${report.reportId}`)
    expect(text).toContain(`inputFilesHash=${report.inputFilesHash}`)
    expect(text).toContain(`engineVersion=${report.engineVersion}`)
    expect(text).toContain(`checksum=sha256:${report.verificationChecksum}`)
    expect(text).toContain('█') // the QR's dark modules
  })

  it('derives the block for legacy reports without a stored payload', async () => {
    const { report } = await buildGNSSObservationReport({ baseline: makeBaseline(), qc: makeQC() })
    // Simulate a report built before the verification block existed.
    const legacy = { ...report, verificationPayload: undefined, verificationChecksum: undefined }
    const { formatGNSSObservationReportText } = await import('../gnssObservationReport')
    const legacyText = formatGNSSObservationReportText(legacy)

    expect(legacyText).toContain(`reportId=${report.reportId}`)
    expect(legacyText).toContain(`inputFilesHash=${report.inputFilesHash}`)
    expect(legacyText).toContain(GNSS_VERIFICATION_FORMAT)
    expect(legacyText).not.toContain('checksum=sha256:')
    expect(legacyText).toContain('█')
  })
})
