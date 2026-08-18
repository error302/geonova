// The browser holds raw points in memory only; heavy surface computation
// (TIN/contours/volume) for clouds >= SURFACE_WORKER_HEAVY_THRESHOLD runs in
// the Python sidecar, so the importer cap can sit at 1M points.
export const MAX_POINTS = 1_000_000;

export const SLOPE_CLASS_LABELS: Record<string, { label: string; range: string; color: string }> = {
  flat: { label: 'Flat', range: '0–2%', color: '#22c55e' },
  gentle: { label: 'Gentle', range: '2–5%', color: '#86efac' },
  moderate: { label: 'Moderate', range: '5–15%', color: '#eab308' },
  steep: { label: 'Steep', range: '15–35%', color: '#f97316' },
  very_steep: { label: 'Very Steep', range: '35–60%', color: '#ef4444' },
  cliff: { label: 'Cliff', range: '>60%', color: '#7f1d1d' },
};
