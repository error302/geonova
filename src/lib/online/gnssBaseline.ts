/**
 * GNSS Baseline Processing Service
 *
 * AUDIT FIX (C9, 2026-07-02): Previously this module was a regex parser
 * that searched for "REFERENCE POINT" / "ROVER POINT" strings in
 * pre-processed ASCII files — it did NOT compute baselines from raw
 * RINEX. Now it calls the real RTKLIB-based processing endpoint
 * (/api/gnss/baseline-process) which dispatches to the Python worker.
 *
 * P2-6 (2026-08-15): The regex stub functions (parseRINEXBaseline,
 * parseProprietaryBaseline, processBaselineFile, computeCoordinatesFromBaseline,
 * detectGNSSFormat) were REMOVED. They silently produced fabricated/placeholder
 * results (hardcoded pdop=1.5, rms=0.02, random processing time) instead of
 * real double-difference processing. The real path is processBaseline() below.
 */

export interface BaselineProcessOptions {
  mode?: 'static' | 'kinematic'
  frequency?: 'l1' | 'l2' | 'l1+l2'
  elevationMask?: number
  ambiguityResolution?: 'fix' | 'float' | 'off'
  /**
   * Session-QC signal model: 'auto' detects from the RINEX version,
   * 'rinex3_multignss' forces the multi-GNSS model (G/E/C/R),
   * 'legacy' restricts to the GPS L1/L2 pair.
   */
  qcMode?: 'auto' | 'rinex3_multignss' | 'legacy'
}

export interface BaselineProcessResult {
  rover_latitude: number
  rover_longitude: number
  rover_height: number
  sigma_north: number
  sigma_east: number
  sigma_up: number
  quality: 'FIX' | 'FLOAT' | 'SBAS' | 'DGPS' | 'SINGLE' | 'PPP' | 'UNKNOWN'
  sat_count: number
  ratio: number
  raw_output: string
  /** Epoch-level fixed-vs-float breakdown from the RTKLIB .pos file. */
  epoch_solutions?: GNSSEpochSolutions
  /** Summary of the fixed-vs-float session statistics. */
  solution_summary?: GNSSSolutionSummary
  /** Session quality control (multipath / cycle slips / SNR / tracking). */
  qc?: GNSSSessionQC
}

/** Per-solution-type epoch counts from the RTKLIB .pos file. */
export interface GNSSEpochSolutions {
  FIX: number
  FLOAT: number
  SBAS: number
  DGPS: number
  SINGLE: number
  PPP: number
  UNKNOWN: number
}

/** Fixed-vs-float session statistics for the observation report. */
export interface GNSSSolutionSummary {
  final_solution: 'FIX' | 'FLOAT' | 'SBAS' | 'DGPS' | 'SINGLE' | 'PPP' | 'UNKNOWN'
  epochs: number
  fixed_epochs: number
  float_epochs: number
  fix_pct: number
  ratio: number
}

/** Quality-control results for a single GNSS station (base or rover). */
export interface GNSSStationQC {
  station: string
  available: boolean
  error?: string
  epoch_count?: number
  start_utc?: string
  end_utc?: string
  duration_minutes?: number
  interval_sec?: number | null
  mean_sats_per_epoch?: number
  min_sats?: number
  max_sats?: number
  systems?: Record<string, number>
  total_cycle_slips?: number
  slip_ratio?: number
  satellites?: GNSSSatelliteQC[]
  issues?: GNSSQCIssue[]
  verdict?: 'pass' | 'warn' | 'fail'
}

/** Quality-control results for one satellite within a station. */
export interface GNSSSatelliteQC {
  satellite: string
  system: string
  tracked_epochs: number
  tracking_pct: number
  /** Signal labels for the generic pair (e.g. 'E1', 'E5a', 'B1I', 'B3I', 'G1', 'G2'). */
  signal_1?: string
  signal_2?: string
  /** Generic multi-GNSS SNR / multipath on the constellation's own signals. */
  snr_1_mean?: number | null
  snr_2_mean?: number | null
  /**
   * Multipath after per-arc de-meaning (TEQC convention): the mean carries
   * the unknown integer-ambiguity constant, so RMS is the meaningful metric.
   */
  mp_1_mean_m?: number | null
  mp_1_std_m?: number | null
  mp_1_rms_m?: number | null
  mp_2_mean_m?: number | null
  mp_2_std_m?: number | null
  mp_2_rms_m?: number | null
  /** Legacy GPS L1/L2 aliases (backward compatible). */
  snr_l1_mean: number | null
  snr_l1_max: number | null
  snr_l2_mean: number | null
  mp1_mean_m: number | null
  mp1_std_m: number | null
  mp1_rms_m?: number | null
  mp2_mean_m: number | null
  mp2_std_m: number | null
  mp2_rms_m?: number | null
  cycle_slips: number
  slip_method: string
}

/** A single QC issue flagging a satellite or session condition. */
export interface GNSSQCIssue {
  level: 'warn' | 'fail'
  code: string
  message: string
}

/** Session QC for a baseline: base + rover station reports. */
export interface GNSSSessionQC {
  error?: string
  base: GNSSStationQC
  rover: GNSSStationQC
}

/**
 * Process a GNSS baseline from raw RINEX files using RTKLIB.
 *
 * This is the REAL baseline processing function — it sends base + rover
 * observation files and a navigation file to the Python worker, which
 * runs RTKLIB's rnx2rtkp and returns the adjusted rover position with
 * precision estimates.
 *
 * Usage:
 *   const result = await processBaseline({
 *     baseRinex: baseFileContent,
 *     roverRinex: roverFileContent,
 *     navRinex: navFileContent,
 *     options: { mode: 'static', frequency: 'l1+l2' }
 *   })
 *
 * @throws {Error} if the worker is unavailable, RTKLIB is not installed,
 *                 or processing fails.
 */
export async function processBaseline(input: {
  baseRinex: string
  roverRinex: string
  navRinex: string
  options?: BaselineProcessOptions
}): Promise<BaselineProcessResult> {
  const response = await fetch('/api/gnss/baseline-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseRinex: input.baseRinex,
      roverRinex: input.roverRinex,
      navRinex: input.navRinex,
      options: input.options ?? {},
    }),
    credentials: 'include',
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(
      error.error || `Baseline processing failed (HTTP ${response.status}). ` +
      'Ensure the Python worker is running and RTKLIB is installed.'
    )
  }

  const data = await response.json() as { baseline: BaselineProcessResult }
  return data.baseline as BaselineProcessResult
}
