/**
 * Hydrographic reductions (Wells-style tide correction basics).
 * GeoNova uses these helpers inside field notes/workflows; display formatting lives in UI.
 */

export function applyTideCorrection(depth: number, tideCorrection: number): number {
  // Convention: correctedDepth = observedDepth + tideCorrection
  // (positive tideCorrection increases depth; negative reduces depth)
  return depth + tideCorrection
}

