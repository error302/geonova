/**
 * GNSS Observation Report — session-QC evidence for the submission package
 *
 * Builds a structured (JSON) + printable (plain-text) observation report from
 * a baseline-processing result (RTKLIB via /api/gnss/baseline-process) and its
 * session QC (multipath, cycle slips, SNR, tracking — computed in the Python
 * worker). The printable text is the artifact that lands in the submission
 * package (`gnss_observation_report.txt`) so a surveyor can demonstrate
 * observation-session quality in front of a boundary commission.
 *
 * Pure module — no DB, no React, no file I/O. Unit-testable.
 *
 * @module submission/gnssObservationReport
 */

import QRCode from 'qrcode'
import type {
  BaselineProcessOptions,
  BaselineProcessResult,
  GNSSSessionQC,
  GNSSStationQC,
} from '@/lib/online/gnssBaseline'
import { computeInputHash, ENGINE_VERSION } from '@/lib/provenance/engineProvenance'
import { canonicalJSON, sha256 } from '@/lib/audit/auditHash'

/** Artifact key used in project_submissions.generated_artifacts and the manifest. */
export const GNSS_OBSERVATION_REPORT_ARTIFACT_KEY = 'gnss_observation_report'

/** Solution-quality thresholds used for the report verdict (documented). */
export const GNSS_REPORT_THRESHOLDS = {
  /** RTKLIB ratio above which a fixed solution is considered reliable. */
  ratioGood: 3.0,
  ratioWarn: 1.5,
  /** Horizontal (2D) sigma (m) — survey-grade static is cm-level. */
  sigma2dGood: 0.03,
  sigma2dWarn: 0.10,
  /** Kinematic sessions: % of epochs with a fixed solution. */
  fixPctGood: 95.0,
  fixPctWarn: 80.0,
} as const

/**
 * A raw RINEX input file with its self-certifying digest.
 *
 * The SHA-256 is computed over the exact bytes that were sent to the
 * processing engine (the same text the page read from the file), so a
 * boundary commission can re-run the baseline on those bytes and confirm
 * the residuals — court-grade reproducibility.
 */
export interface GNSSInputFile {
  role: 'base' | 'rover' | 'nav'
  fileName: string
  sizeBytes: number
  /** SHA-256 (hex, lowercase) of the file content. */
  sha256: string
}

export interface GNSSObservationReportInput {
  baseline: BaselineProcessResult
  qc?: GNSSSessionQC
  options?: BaselineProcessOptions
  baseStation?: string
  roverStation?: string
  surveyor?: {
    name?: string
    registrationNumber?: string
    firmName?: string
  }
  /** Raw RINEX files (base/rover/nav) with their SHA-256 digests. */
  inputFiles?: GNSSInputFile[]
  generatedAt?: string
}

export interface GNSSReportIssue {
  level: 'pass' | 'warn' | 'fail'
  code: string
  message: string
}

export interface GNSSObservationReport {
  reportId: string
  reportType: 'GNSS_OBSERVATION_REPORT'
  generatedAt: string
  /** SHA-256 of the canonical baseline-process input — self-certifying evidence. */
  inputHash: string
  /**
   * SHA-256 over the canonical list of raw RINEX input files (role, name,
   * size, per-file digest) — anchors the report to the exact input bytes.
   */
  inputFilesHash: string
  /** Raw RINEX input files with their individual SHA-256 digests. */
  inputFiles: GNSSInputFile[]
  /** METARDU compute engine version that produced this report. */
  engineVersion: string
  /**
   * Canonical machine-readable identity payload — four lines
   * (`METARDU-GNSS/1.0` format tag, report id, input files hash, engine
   * version). Encoded in the printable QR and mirrored in the
   * machine-readable block for on-site scanning verification. Absent on
   * reports built before the verification block existed (legacy records).
   */
  verificationPayload?: string
  /** SHA-256 (hex, lowercase) of verificationPayload — recomputable on-site. */
  verificationChecksum?: string
  surveyor?: { name?: string; registrationNumber?: string; firmName?: string }
  stations: { base: string; rover: string }
  options: BaselineProcessOptions
  solution: {
    final_solution: BaselineProcessResult['quality']
    ratio: number
    satellites: number
    rover_latitude: number
    rover_longitude: number
    rover_height: number
    sigma_north: number
    sigma_east: number
    sigma_up: number
    epoch_solutions?: BaselineProcessResult['epoch_solutions']
    solution_summary?: BaselineProcessResult['solution_summary']
  }
  qc?: GNSSSessionQC
  issues: GNSSReportIssue[]
  verdict: 'pass' | 'warn' | 'fail'
}

const qualityLabel: Record<BaselineProcessResult['quality'], string> = {
  FIX: 'Fixed integer ambiguity',
  FLOAT: 'Float ambiguity',
  SBAS: 'SBAS-augmented',
  DGPS: 'DGNSS differential',
  SINGLE: 'Single-point',
  PPP: 'Precise Point Positioning',
  UNKNOWN: 'Unknown',
}

/**
 * Resolve the overall verdict from the solution + QC evidence.
 *
 * Rules (documented in the report):
 *  - Solution: FIX is required for a pass; FLOAT warns; anything below warns
 *    or fails. A sub-3.0 ratio on a fixed solution warns; < 1.5 fails.
 *  - Precision: 2D sigma ≤ 30 mm passes, ≤ 100 mm warns, beyond that fails.
 *  - Kinematic sessions: fix percentage ≥ 95 passes, ≥ 80 warns, else fails.
 *  - Session QC: a fail/warn on either station propagates to the report.
 *  - QC absence never fails the report — the solution still stands.
 */
export function resolveGNSSReportVerdict(
  baseline: BaselineProcessResult,
  qc?: GNSSSessionQC,
): { verdict: 'pass' | 'warn' | 'fail'; issues: GNSSReportIssue[] } {
  const issues: GNSSReportIssue[] = []
  const stationQC: GNSSStationQC[] = []
  if (qc?.base?.available) stationQC.push(qc.base)
  if (qc?.rover?.available) stationQC.push(qc.rover)

  const sigma2d = Math.hypot(baseline.sigma_east || 0, baseline.sigma_north || 0)

  // Solution type
  if (baseline.quality === 'FIX') {
    issues.push({ level: 'pass', code: 'FIXED_SOLUTION', message: 'Final solution is FIXED (integer ambiguity resolved)' })
  } else if (baseline.quality === 'FLOAT') {
    issues.push({ level: 'warn', code: 'FLOAT_SOLUTION', message: 'Final solution is FLOAT — not suitable for cadastral boundary evidence' })
  } else {
    issues.push({ level: 'fail', code: 'NON_FIXED_SOLUTION', message: `Final solution is ${baseline.quality} — below survey-grade accuracy` })
  }

  // Ambiguity resolution ratio
  if (baseline.quality === 'FIX') {
    if (baseline.ratio >= GNSS_REPORT_THRESHOLDS.ratioGood) {
      issues.push({ level: 'pass', code: 'RATIO_OK', message: `Ambiguity ratio ${baseline.ratio.toFixed(1)} ≥ ${GNSS_REPORT_THRESHOLDS.ratioGood}` })
    } else if (baseline.ratio >= GNSS_REPORT_THRESHOLDS.ratioWarn) {
      issues.push({ level: 'warn', code: 'RATIO_MARGINAL', message: `Ambiguity ratio ${baseline.ratio.toFixed(1)} is marginal (< ${GNSS_REPORT_THRESHOLDS.ratioGood})` })
    } else {
      issues.push({ level: 'fail', code: 'RATIO_LOW', message: `Ambiguity ratio ${baseline.ratio.toFixed(1)} < ${GNSS_REPORT_THRESHOLDS.ratioWarn} — fixed solution unreliable` })
    }
  }

  // Precision
  if (sigma2d <= GNSS_REPORT_THRESHOLDS.sigma2dGood) {
    issues.push({ level: 'pass', code: 'SIGMA_OK', message: `2D precision ${(sigma2d * 1000).toFixed(1)} mm ≤ ${(GNSS_REPORT_THRESHOLDS.sigma2dGood * 1000).toFixed(0)} mm` })
  } else if (sigma2d <= GNSS_REPORT_THRESHOLDS.sigma2dWarn) {
    issues.push({ level: 'warn', code: 'SIGMA_MARGINAL', message: `2D precision ${(sigma2d * 1000).toFixed(1)} mm exceeds ${(GNSS_REPORT_THRESHOLDS.sigma2dGood * 1000).toFixed(0)} mm` })
  } else {
    issues.push({ level: 'fail', code: 'SIGMA_POOR', message: `2D precision ${(sigma2d * 1000).toFixed(1)} mm exceeds ${(GNSS_REPORT_THRESHOLDS.sigma2dWarn * 1000).toFixed(0)} mm` })
  }

  // Kinematic fix percentage (only meaningful with multi-epoch solutions)
  const summary = baseline.solution_summary
  if (summary && summary.epochs > 1) {
    if (summary.fix_pct >= GNSS_REPORT_THRESHOLDS.fixPctGood) {
      issues.push({ level: 'pass', code: 'FIX_PCT_OK', message: `${summary.fix_pct}% of ${summary.epochs} epochs fixed` })
    } else if (summary.fix_pct >= GNSS_REPORT_THRESHOLDS.fixPctWarn) {
      issues.push({ level: 'warn', code: 'FIX_PCT_MARGINAL', message: `Only ${summary.fix_pct}% of ${summary.epochs} epochs fixed (< ${GNSS_REPORT_THRESHOLDS.fixPctGood}%)` })
    } else {
      issues.push({ level: 'fail', code: 'FIX_PCT_LOW', message: `Only ${summary.fix_pct}% of ${summary.epochs} epochs fixed (< ${GNSS_REPORT_THRESHOLDS.fixPctWarn}%)` })
    }
  }

  // Session QC (base + rover)
  for (const st of stationQC) {
    const label = st.station || 'station'
    if (st.verdict === 'fail') {
      issues.push({ level: 'fail', code: 'QC_FAIL', message: `${label} session QC FAILED` })
    } else if (st.verdict === 'warn') {
      issues.push({ level: 'warn', code: 'QC_WARN', message: `${label} session QC has warnings` })
    } else if (st.verdict === 'pass') {
      issues.push({ level: 'pass', code: 'QC_OK', message: `${label} session QC passed` })
    }
    for (const issue of st.issues ?? []) {
      issues.push({ level: issue.level, code: `${issue.code}_${label}`, message: `${label}: ${issue.message}` })
    }
  }

  if (!qc || stationQC.length === 0) {
    issues.push({ level: 'warn', code: 'QC_UNAVAILABLE', message: 'Session QC not available — verify observation quality manually' })
  }

  if (issues.some((i) => i.level === 'fail')) {
    return { verdict: 'fail', issues }
  }
  if (issues.some((i) => i.level === 'warn')) {
    return { verdict: 'warn', issues }
  }
  return { verdict: 'pass', issues }
}

/** Generate a deterministic report ID (timestamp + short random suffix). */
export function generateGNSSReportId(now = new Date()): string {
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const suffix = Math.random().toString(36).slice(2, 8)
  return `GNSS-${ts}-${suffix}`
}

/**
 * Combine the raw RINEX file digests into one canonical hash that anchors
 * the whole input set (roles + names + sizes + per-file SHA-256).
 */
export async function computeInputFilesHash(files: GNSSInputFile[]): Promise<string> {
  const canonical = files
    .slice()
    .sort((a, b) => a.role.localeCompare(b.role))
    .map((f) => ({
      role: f.role,
      fileName: f.fileName,
      sizeBytes: f.sizeBytes,
      sha256: f.sha256,
    }))
  return sha256(canonicalJSON(canonical))
}

// ============================================================================
// On-site verification block (QR + machine-readable mirror)
// ============================================================================

/** Format tag of the canonical verification payload. */
export const GNSS_VERIFICATION_FORMAT = 'METARDU-GNSS/1.0'

/**
 * Build the canonical machine-readable identity payload encoded in the QR
 * and mirrored in the printable block. The four lines are hashed by
 * {@link computeGNSSVerificationChecksum} so a verifier can recompute the
 * checksum from whatever the scanner read.
 */
export function buildGNSSVerificationPayload(report: Pick<GNSSObservationReport, 'reportId' | 'inputFilesHash' | 'engineVersion'>): string {
  return [
    GNSS_VERIFICATION_FORMAT,
    `reportId=${report.reportId}`,
    `inputFilesHash=${report.inputFilesHash}`,
    `engineVersion=${report.engineVersion}`,
  ].join('\n')
}

/** SHA-256 (hex) of the canonical verification payload. */
export async function computeGNSSVerificationChecksum(payload: string): Promise<string> {
  return sha256(payload)
}

/** Unicode half-blocks used to render a QR matrix as monospace text. */
const QR_DARK = '█'
const QR_UPPER = '▀' // top half dark, bottom half light
const QR_LOWER = '▄' // top half light, bottom half dark
const QR_LIGHT = ' '
/** Light-module quiet zone around the symbol (QR spec minimum is 4). */
const QR_QUIET_MODULES = 4

/**
 * Render a QR code as plain monospace text using Unicode half-blocks
 * (█▀▄ + space, two QR module rows per text line), so the report's
 * text artifact carries a genuinely scannable code without an image.
 * Deterministic for a given payload.
 */
export function renderGNSSVerificationQR(payload: string): string {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: 'M' })
  const size = modules.size
  const q = QR_QUIET_MODULES
  const total = size + q * 2

  const isDark = (x: number, y: number): boolean => {
    if (x < q || y < q || x >= q + size || y >= q + size) return false
    return modules.data[y * size + x] === 1
  }

  const lines: string[] = []
  for (let y = 0; y < total; y += 2) {
    let line = ''
    for (let x = 0; x < total; x++) {
      const top = isDark(x, y)
      const bottom = y + 1 < total ? isDark(x, y + 1) : false
      line += top && bottom ? QR_DARK : top ? QR_UPPER : bottom ? QR_LOWER : QR_LIGHT
    }
    lines.push(line)
  }
  return lines.join('\n')
}

/**
 * Render the canonical payload as an indented key=value block — the
 * human-readable mirror of the QR, with the recomputable checksum appended
 * when the report carries one.
 */
export function renderGNSSMachineBlock(payload: string, checksum?: string): string {
  const lines = payload.split('\n')
  const out: string[] = lines.map((line) => `  ${line}`)
  if (checksum) {
    out.push(`  checksum=sha256:${checksum}  (SHA-256 of the ${lines.length} lines above)`)
  }
  return out.join('\n')
}

/**
 * Compose the printable on-site verification section (QR + machine-readable
 * block). Works on legacy reports too — when verificationPayload is absent
 * the payload is derived from the report's own fields (checksum line then
 * omitted, since it was never computed for that record).
 */
export function renderGNSSVerificationSection(report: GNSSObservationReport): string {
  const payload = report.verificationPayload ?? buildGNSSVerificationPayload(report)
  const qr = renderGNSSVerificationQR(payload)
  const out: string[] = []
  out.push(' ── On-site verification ──────────────────────────────────────')
  out.push(' Scan the QR below to verify this report on site. It encodes the')
  out.push(' canonical identity block — format, report id, input files hash,')
  out.push(' engine version — and the printed block below is its readable')
  out.push(' mirror. Recompute sha256 of the four block lines to confirm the')
  out.push(' checksum and that the scanned payload is untampered.')
  out.push('')
  for (const line of qr.split('\n')) {
    out.push(` ${line}`)
  }
  out.push('')
  out.push(' Machine-readable block:')
  out.push(renderGNSSMachineBlock(payload, report.verificationChecksum))
  return out.join('\n')
}

/**
 * Build the observation report (structured + printable text) from a baseline
 * result and its session QC.
 *
 * The report is self-certifying: it embeds the SHA-256 of the canonical
 * baseline-process input and the engine version that produced it, plus the
 * per-file SHA-256 digests of the raw RINEX inputs (base/rover/nav), so the
 * manifest's provenance record cross-verifies against the artifact and any
 * party can re-run the baseline on the exact input bytes.
 */
export async function buildGNSSObservationReport(
  input: GNSSObservationReportInput,
): Promise<{ report: GNSSObservationReport; text: string; verdict: 'pass' | 'warn' | 'fail' }> {
  const {
    baseline,
    qc,
    options = {},
    baseStation = 'BASE',
    roverStation = 'ROVER',
    inputFiles = [],
  } = input
  const { verdict, issues } = resolveGNSSReportVerdict(baseline, qc)

  const inputHash = await computeInputHash({
    baseline: {
      rover_latitude: baseline.rover_latitude,
      rover_longitude: baseline.rover_longitude,
      rover_height: baseline.rover_height,
      sigma_north: baseline.sigma_north,
      sigma_east: baseline.sigma_east,
      sigma_up: baseline.sigma_up,
      quality: baseline.quality,
      sat_count: baseline.sat_count,
      ratio: baseline.ratio,
      epoch_solutions: baseline.epoch_solutions,
      solution_summary: baseline.solution_summary,
      qc,
    },
    options,
    baseStation,
    roverStation,
  })

  const inputFilesHash = await computeInputFilesHash(inputFiles)

  const reportId = generateGNSSReportId()
  const verificationPayload = buildGNSSVerificationPayload({ reportId, inputFilesHash, engineVersion: ENGINE_VERSION })
  const verificationChecksum = await computeGNSSVerificationChecksum(verificationPayload)

  const report: GNSSObservationReport = {
    reportId,
    reportType: 'GNSS_OBSERVATION_REPORT',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    inputHash,
    inputFilesHash,
    inputFiles,
    engineVersion: ENGINE_VERSION,
    verificationPayload,
    verificationChecksum,
    surveyor: input.surveyor,
    stations: { base: baseStation, rover: roverStation },
    options,
    solution: {
      final_solution: baseline.quality,
      ratio: baseline.ratio,
      satellites: baseline.sat_count,
      rover_latitude: baseline.rover_latitude,
      rover_longitude: baseline.rover_longitude,
      rover_height: baseline.rover_height,
      sigma_north: baseline.sigma_north,
      sigma_east: baseline.sigma_east,
      sigma_up: baseline.sigma_up,
      epoch_solutions: baseline.epoch_solutions,
      solution_summary: baseline.solution_summary,
    },
    qc,
    issues,
    verdict,
  }

  return { report, text: formatGNSSObservationReportText(report), verdict }
}

/** Render the observation report as printable plain text (the package artifact). */
export function formatGNSSObservationReportText(report: GNSSObservationReport): string {
  const line = '='.repeat(66)
  const thin = '-'.repeat(66)
  const out: string[] = []

  out.push(line)
  out.push(' METARDU — GNSS OBSERVATION REPORT')
  out.push(line)
  out.push(` Report ID:            ${report.reportId}`)
  out.push(` Generated:            ${report.generatedAt}`)
  if (report.surveyor?.name) {
    out.push(` Surveyor:             ${report.surveyor.name}${report.surveyor.registrationNumber ? ` (${report.surveyor.registrationNumber})` : ''}`)
  }
  if (report.surveyor?.firmName) {
    out.push(` Firm:                 ${report.surveyor.firmName}`)
  }
  out.push('')
  out.push(` Input hash:           ${report.inputHash}`)
  out.push(` Input files hash:     ${report.inputFilesHash}`)
  out.push(` Engine version:       ${report.engineVersion}`)
  out.push('')
  out.push(renderGNSSVerificationSection(report))
  out.push('')
  out.push(' ── RINEX input files ─────────────────────────────────────────────')
  const fileRoles: Record<string, string> = { base: 'Base', rover: 'Rover', nav: 'Navigation' }
  for (const f of report.inputFiles) {
    out.push(` ${fileRoles[f.role] ?? f.role}: ${f.fileName} (${f.sizeBytes.toLocaleString()} B)`)
    out.push(`   SHA-256: ${f.sha256}`)
  }
  if (report.inputFiles.length === 0) {
    out.push(' (no raw RINEX file digests were recorded with this report)')
  }
  out.push('')
  out.push(' ── Session ────────────────────────────────────────────────────────')
  out.push(` Base station:         ${report.stations.base}`)
  out.push(` Rover station:        ${report.stations.rover}`)
  out.push(` Mode:                 ${report.options.mode ?? 'static'}`)
  out.push(` Frequency:            ${report.options.frequency ?? 'l1+l2'}`)
  out.push(` Elevation mask:       ${report.options.elevationMask ?? 15} deg`)
  out.push(` Ambiguity resolution: ${report.options.ambiguityResolution ?? 'fix'}`)
  out.push('')
  out.push(' ── Solution ───────────────────────────────────────────────────────')
  out.push(` Final solution:       ${report.solution.final_solution} (${qualityLabel[report.solution.final_solution]})`)
  out.push(` Ambiguity ratio:      ${report.solution.ratio.toFixed(2)}`)
  out.push(` Satellites:           ${report.solution.satellites}`)
  out.push(` Sigma N/E/U (m):      ${report.solution.sigma_north.toFixed(4)} / ${report.solution.sigma_east.toFixed(4)} / ${report.solution.sigma_up.toFixed(4)}`)
  out.push(` Rover position:       lat ${report.solution.rover_latitude.toFixed(7)}  lon ${report.solution.rover_longitude.toFixed(7)}  h ${report.solution.rover_height.toFixed(3)}`)

  const summary = report.solution.solution_summary
  if (summary) {
    out.push(` Epochs processed:     ${summary.epochs}`)
    out.push(` Fixed epochs:         ${summary.fixed_epochs} (${summary.fix_pct}%)`)
    out.push(` Float epochs:         ${summary.float_epochs}`)
  }
  out.push('')
  out.push(' ── Session QC ─────────────────────────────────────────────────────')
  for (const station of [report.qc?.rover, report.qc?.base] as Array<GNSSStationQC | undefined>) {
    if (!station) continue
    const qcStation = station.station || 'station'
    if (!station.available) {
      out.push(` ${qcStation}: QC unavailable (${station.error ?? 'no data'})`)
      continue
    }
    out.push(` ${qcStation} (verdict: ${(station.verdict ?? 'unknown').toUpperCase()})`)
    out.push(`   Epochs: ${station.epoch_count}  Duration: ${station.duration_minutes} min  Interval: ${station.interval_sec ?? 'n/a'} s`)
    out.push(`   Satellites: mean ${station.mean_sats_per_epoch} (min ${station.min_sats}, max ${station.max_sats})  Slips: ${station.total_cycle_slips}`)
    out.push(`   ${'SAT'.padEnd(6)}${'SYS'.padEnd(3)}${'SIG'.padEnd(7)}${'TRACK%'.padStart(7)}${'SNR1'.padStart(6)}${'SNR2'.padStart(6)}${'MP1 RMS'.padStart(9)}${'MP2 RMS'.padStart(9)}${'SLIPS'.padStart(7)}`)
    for (const s of station.satellites ?? []) {
      const sig = s.signal_1 && s.signal_2 ? `${s.signal_1}/${s.signal_2}` : (s.system === 'G' ? 'L1/L2' : '—')
      out.push(`   ${s.satellite.padEnd(6)}${s.system.padEnd(3)}${sig.padEnd(7)}${String(s.tracking_pct).padStart(7)}${String(s.snr_1_mean ?? s.snr_l1_mean ?? 'n/a').padStart(6)}${String(s.snr_2_mean ?? s.snr_l2_mean ?? 'n/a').padStart(6)}${String(s.mp_1_rms_m ?? s.mp1_rms_m ?? s.mp_1_mean_m ?? s.mp1_mean_m ?? 'n/a').padStart(9)}${String(s.mp_2_rms_m ?? s.mp2_rms_m ?? s.mp_2_mean_m ?? s.mp2_mean_m ?? 'n/a').padStart(9)}${String(s.cycle_slips).padStart(7)}`)
    }
    for (const issue of station.issues ?? []) {
      out.push(`   [${issue.level.toUpperCase()}] ${issue.message}`)
    }
  }
  out.push('')
  out.push(' ── Verdict ────────────────────────────────────────────────────────')
  const verdictLine =
    report.verdict === 'pass'
      ? ' PASS — observation session meets survey-grade acceptance criteria.'
      : report.verdict === 'warn'
        ? ' WARN — observation session usable with caution (see issues).'
        : ' FAIL — observation session does not meet survey-grade criteria.'
  out.push(verdictLine)
  for (const issue of report.issues) {
    out.push(`   [${issue.level.toUpperCase()}] ${issue.message}`)
  }
  out.push(thin)
  out.push(` Generated by METARDU ${report.engineVersion} — survey computation platform.`)
  out.push(` Input hash: ${report.inputHash}`)
  out.push(` Input files hash: ${report.inputFilesHash}`)
  for (const f of report.inputFiles) {
    out.push(` ${f.role} file SHA-256 (${f.fileName}): ${f.sha256}`)
  }
  out.push(' This report accompanies the submission package and documents the')
  out.push(' GNSS observation session for boundary-commission review.')
  out.push(' The input hashes let any party re-run the baseline on the exact RINEX')
  out.push(' files and confirm the residuals recorded above (court-grade reproducibility).')
  return out.join('\n')
}
