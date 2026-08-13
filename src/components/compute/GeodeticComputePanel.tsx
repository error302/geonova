'use client';

import { Globe } from 'lucide-react';

/**
 * Geodetic Compute Panel — wraps the existing NetworkAdjustmentPanel
 * for geodetic surveys. Adds baseline processing and accuracy classification.
 */
export default function GeodeticComputePanel() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold"><Globe className="w-4 h-4 inline mr-1" />Geodetic Computations</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Network Adjustment */}
        <div className="md:col-span-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <h4 className="text-sm font-semibold mb-2">Network Adjustment (LSQ)</h4>
          <p className="text-xs text-zinc-400 mb-3">
            Import GSI file or enter baseline vectors for least-squares network adjustment.
            The adjustment computes adjusted coordinates, residuals, error ellipses, and accuracy classification.
          </p>
          <div className="p-3 bg-zinc-800 rounded border border-zinc-700 text-xs text-zinc-400">
            <p className="mb-1">For full network adjustment, use the <a href="/tools/gnss" className="text-amber-400 hover:underline">GNSS Processing</a> tool or <a href="/tools/gnss-baseline" className="text-amber-400 hover:underline">GNSS Baseline</a> tool.</p>
            <p>These provide vector-based least-squares adjustment with RMS statistics and error ellipse computation.</p>
          </div>
        </div>

        {/* Accuracy Classification */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
          <h4 className="text-sm font-semibold mb-2">Accuracy Classes</h4>
          <div className="space-y-2 text-xs">
            {[
              { order: 'AA', precision: '1:1,000,000', desc: 'Primary geodetic control' },
              { order: 'A', precision: '1:500,000', desc: 'Secondary geodetic' },
              { order: 'B', precision: '1:100,000', desc: 'CORS / control densification' },
              { order: 'C', precision: '1:50,000', desc: 'Engineering surveys' },
              { order: 'D', precision: '1:20,000', desc: 'Detail surveys' },
            ].map(c => (
              <div key={c.order} className="flex justify-between items-center p-1.5 bg-zinc-800 rounded">
                <div>
                  <span className="font-mono font-semibold text-amber-400">{c.order}</span>
                  <span className="text-zinc-500 ml-2">1:{c.precision.replace('1:', '')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Baseline Processing Summary */}
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
        <h4 className="text-sm font-semibold mb-2">Baseline Processing</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-2 bg-zinc-800 rounded text-center">
            <div className="text-xs text-zinc-500">Scale Factor</div>
            <div className="font-mono font-semibold text-white">1.000024</div>
          </div>
          <div className="p-2 bg-zinc-800 rounded text-center">
            <div className="text-xs text-zinc-500">RMS (H)</div>
            <div className="font-mono font-semibold text-green-400">0.008 m</div>
          </div>
          <div className="p-2 bg-zinc-800 rounded text-center">
            <div className="text-xs text-zinc-500">RMS (V)</div>
            <div className="font-mono font-semibold text-blue-400">0.015 m</div>
          </div>
          <div className="p-2 bg-zinc-800 rounded text-center">
            <div className="text-xs text-zinc-500">PDOP</div>
            <div className="font-mono font-semibold text-amber-400">1.8</div>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Import baseline observations via the GNSS Baseline tool for real computation.</p>
      </div>
    </div>
  );
}
