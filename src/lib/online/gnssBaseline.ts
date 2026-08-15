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
