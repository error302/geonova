/**
 * @deprecated P1-5 phase 2 (2026-08-23): types-only re-export shim.
 *
 * The live coordinate-difference adjustment now lives in
 * `@/lib/survey/coordinateDiffLsa.ts` (a thin adapter over the canonical
 * `@/lib/engine/networkAdjustment`). Import `adjustNetwork` from there.
 *
 * This shim exists only so existing type-only importers —
 * `ErrorEllipseCanvas`, `ExportToolbar`, `regulatoryCompliance.ts` — keep
 * compiling. New code must not import from this module.
 */

export type {
  Station,
  Observation,
  AdjustedStation,
  AdjustmentResult,
} from './coordinateDiffLsa'

export { StationSchema, ObservationSchema } from './coordinateDiffLsa'
