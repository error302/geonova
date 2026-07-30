'use client';

/**
 * 3D Terrain Viewer
 *
 * Uses Three.js to render TIN surfaces and point clouds in 3D.
 * Critical for engineering and drone surveys where terrain shape matters.
 */

import { useState, useCallback } from 'react'
import { PageHeader } from '@/components/shared/PageHeader'
import { TIN3DViewer } from '@/components/visualization/TIN3DViewer'
import { buildTINSurface, type SpotHeight, type TINSurface } from '@/lib/engine/contours'
import { Upload, Box, Mountain } from 'lucide-react'

// Local demo data generator (replaces missing generateDemoData export).
// Generates a Gaussian hill centered on (500, 500) with a 50m peak.
function generateDemoData(): SpotHeight[] {
  const pts: SpotHeight[] = []
  const cx = 500, cy = 500, peakH = 50, sigma = 150
  for (let i = 0; i < 80; i++) {
    // Pseudo-random on a 1000x1000 plane
    const x = (i * 137.5) % 1000
    const y = (i * 271.3) % 1000
    const dx = x - cx, dy = y - cy
    const h = peakH * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    pts.push({ name: `PT${i + 1}`, easting: x, northing: y, elevation: h })
  }
  return pts
}

export default function ThreeDViewerPage() {
  const [points, setPoints] = useState<SpotHeight[]>([])
  const [surface, setSurface] = useState<TINSurface | null>(null)

  const loadDemo = useCallback(() => {
    const demoPoints = generateDemoData()
    setPoints(demoPoints)
    const tin = buildTINSurface(demoPoints)
    setSurface(tin)
  }, [])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader
        title="3D Terrain Viewer"
        subtitle="Visualize TIN surfaces and point clouds in 3D with Three.js"
        reference="Three.js WebGL renderer | Delaunay TIN"
      />

      <div className="mb-6 flex gap-3">
        <button
          onClick={loadDemo}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold hover:bg-[var(--accent-dim)]"
        >
          <Mountain className="w-4 h-4" /> Load Demo Terrain
        </button>
        {surface && (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Box className="w-4 h-4" />
            {surface.triangles.length} triangles · {points.length} points
          </div>
        )}
      </div>

      {surface || points.length > 0 ? (
        <TIN3DViewer surface={surface} points={points} width={900} height={600} />
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-12 text-center">
          <Box className="w-12 h-12 text-[var(--text-muted)] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No terrain data loaded</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Load demo terrain to see the 3D viewer in action, or generate a TIN
            from your survey data using the contour generator.
          </p>
          <button
            onClick={loadDemo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold"
          >
            <Upload className="w-4 h-4" /> Load Demo
          </button>
        </div>
      )}

      {surface && (
        <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/15">
          <h4 className="text-sm font-semibold text-blue-400 mb-1">3D Viewer Controls</h4>
          <ul className="text-xs text-[var(--text-muted)] space-y-1">
            <li>• <strong>Left drag:</strong> Rotate the terrain (orbit camera)</li>
            <li>• <strong>Scroll wheel:</strong> Zoom in/out</li>
            <li>• <strong>Right drag:</strong> Pan the camera</li>
            <li>• Colors are elevation-coded: <span className="text-blue-400">blue</span> (low) → <span className="text-green-400">green</span> → <span className="text-yellow-400">yellow</span> → <span className="text-red-400">red</span> (high)</li>
            <li>• The wireframe overlay shows the TIN triangulation structure</li>
          </ul>
        </div>
      )}
    </div>
  )
}
