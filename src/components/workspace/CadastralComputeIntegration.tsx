'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { runTraverseComputation, TraverseComputationResult } from '@/lib/compute/traverseRunner';
import { FieldBookRow } from '@/types/fieldbook';

export default function CadastralComputeIntegration({ projectId }: { projectId: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TraverseComputationResult | null>(null);
  const [, setRows] = useState<FieldBookRow[]>([]);

  useEffect(() => {
    async function loadAndCompute() {
      try {
        setLoading(true);
        const res = await fetch(`/api/project/${projectId}/fieldbook`);
        if (!res.ok) throw new Error('Failed to fetch field book data');
        const json = (await res.json()) as { data: Array<{ station?: string; raw_data?: { station?: string; distance?: number; bearing?: number } }> };
        
        if (!json.data || json.data.length === 0) {
          setError('No field book data found. Please complete Step 2 first.');
          setLoading(false);
          return;
        }

        const rawRows = json.data.map((r) => ({
          ...r.raw_data,
          station: r.station || r.raw_data?.station,
          distance: r.raw_data?.distance,
          bearing: r.raw_data?.bearing,
        })) as unknown as FieldBookRow[];
        
        setRows(rawRows);

        // Attempt computation
        try {
          const computation = runTraverseComputation({
            rows: rawRows,
            startPoint: { name: 'ST1', easting: 250000, northing: 9800000 },
            surveyType: 'cadastral',
            method: 'bowditch'
          });
          setResult(computation);

          // Save computation to project boundary_data for the Map
          const { createClient } = await import('@/lib/api-client/client');
          const dbClient = createClient();
          
          const adjustedStations = computation.adjustedStations.legs.map((leg) => ({
            pointName: leg.to,
            originalEasting: leg.adjEasting - leg.correctionE,
            originalNorthing: leg.adjNorthing - leg.correctionN,
            adjustedEasting: leg.adjEasting,
            adjustedNorthing: leg.adjNorthing,
          }));

          // Ensure the start point is included
          adjustedStations.unshift({
             pointName: 'ST1',
             originalEasting: 250000,
             originalNorthing: 9800000,
             adjustedEasting: 250000,
             adjustedNorthing: 9800000,
          });

          await dbClient
            .from('projects')
            .update({ boundary_data: { adjustedStations } })
            .eq('id', projectId);

        } catch (compErr: unknown) {
          setError(compErr instanceof Error ? compErr.message : 'Failed to compute traverse from field book data. Ensure distances and bearings are entered correctly.');
        }

      } catch (err: unknown) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    loadAndCompute();
  }, [projectId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent)] mb-3" />
        <p className="text-sm text-[var(--text-muted)]">Loading Field Book & Running Computations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-500 mb-1">Computation Warning</h3>
            <p className="text-sm text-amber-500/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="text-[10px] text-[var(--text-muted)]">Precision Grade</div>
          <div className="text-sm font-bold text-[var(--text-primary)] uppercase">{result.adjustedStations.precisionGrade}</div>
        </div>
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="text-[10px] text-[var(--text-muted)]">Precision Ratio</div>
          <div className="text-sm font-bold text-[var(--text-primary)]">1 : {Math.round(1 / result.adjustedStations.precisionRatio)}</div>
        </div>
        <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg">
          <div className="text-[10px] text-[var(--text-muted)]">Linear Misclosure</div>
          <div className="text-sm font-bold text-[var(--text-primary)]">{result.linearMisclosure.toFixed(4)} m</div>
        </div>
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="text-[10px] text-emerald-400">Computed Area</div>
          <div className="text-sm font-bold text-emerald-400">{(result.adjustedAreaM2 / 10000).toFixed(6)} ha</div>
        </div>
      </div>

      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-card)]">
        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Table 1 — Bowditch Adjusted Coordinates</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="px-3 py-2">Station</th>
                <th className="px-3 py-2 text-right">Raw Easting (m)</th>
                <th className="px-3 py-2 text-right">Raw Northing (m)</th>
                <th className="px-3 py-2 text-right">Adj Easting (m)</th>
                <th className="px-3 py-2 text-right">Adj Northing (m)</th>
              </tr>
            </thead>
            <tbody>
              {result.adjustedStations.legs.map((c, i) => (
                <tr key={`${c}-${i}`} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-secondary)]">
                  <td className="px-3 py-2 font-mono text-[var(--accent)]">{c.to}</td>
                  <td className="px-3 py-2 font-mono text-right text-[var(--text-muted)]">{(c.adjEasting - c.correctionE).toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-right text-[var(--text-muted)]">{(c.adjNorthing - c.correctionN).toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-right font-semibold">{c.adjEasting.toFixed(4)}</td>
                  <td className="px-3 py-2 font-mono text-right font-semibold">{c.adjNorthing.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
        <CheckCircle2 className="w-4 h-4" />
        Traverse automatically computed from Step 2 (Field Book). Area updated.
      </div>
    </div>
  );
}
