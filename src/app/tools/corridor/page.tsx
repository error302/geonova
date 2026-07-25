'use client'

import { useState, useCallback } from 'react'
import { Route, AlertCircle, Map as MapIcon } from 'lucide-react'
import { buildAlignment, enToChainageOffset, organizeShotsByChainage, formatChainage, type PIPoint, type FieldShot, type CrossSectionGroup } from '@/lib/survey/corridorEngine'

export default function CorridorPage() {
  const [piInput, setPiInput] = useState('')
  const [shotsInput, setShotsInput] = useState('')
  const [interval, setInterval] = useState('20')
  const [crossSections, setCrossSections] = useState<CrossSectionGroup[]>([])
  const [alignmentLength, setAlignmentLength] = useState(0)
  const [error, setError] = useState('')

  const handleOrganize = useCallback(() => {
    setError(''); setCrossSections([]); setAlignmentLength(0)
    try {
      // Parse PI points: id,easting,northing
      const pis: PIPoint[] = piInput.trim().split('\n').map(line => {
        const cols = line.split(',').map(c => c.trim())
        return { id: cols[0], e: parseFloat(cols[1]), n: parseFloat(cols[2]) }
      }).filter(p => p.id && !isNaN(p.e) && !isNaN(p.n))

      if (pis.length < 2) { setError('Need at least 2 PI points (format: id,easting,northing)'); return }

      // Parse field shots: easting,northing,rl
      const shots: FieldShot[] = shotsInput.trim().split('\n').map(line => {
        const cols = line.split(',').map(c => parseFloat(c.trim()))
        return { e: cols[0], n: cols[1], rl: cols[2] }
      }).filter(s => !isNaN(s.e) && !isNaN(s.n) && !isNaN(s.rl))

      if (shots.length < 3) { setError('Need at least 3 field shots (format: easting,northing,rl)'); return }

      const alignment = buildAlignment(pis)
      const groups = organizeShotsByChainage(shots, alignment, parseFloat(interval))
      setCrossSections(groups)
      setAlignmentLength(alignment.totalLength)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
  }, [piInput, shotsInput, interval])

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Corridor / Chainage Mode</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Define an alignment from PI points → auto-organize field shots into cross-sections by chainage station. Designed for KeNHA road corridors.</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Route className="w-4 h-4" /> PI Points (id,easting,northing)</h2>
          <textarea value={piInput} onChange={e => setPiInput(e.target.value)} className={inputCls + ' h-40 font-mono'} placeholder="PI1,264000,9861000&#10;PI2,264100,9861100&#10;PI3,264200,9861200" />
        </div>
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><MapIcon className="w-4 h-4" /> Field Shots (easting,northing,rl)</h2>
          <textarea value={shotsInput} onChange={e => setShotsInput(e.target.value)} className={inputCls + ' h-40 font-mono'} placeholder="264000,9861000,1500&#10;264010,9861000,1500.1&#10;263990,9861000,1499.9" />
        </div>
      </div>

      <div className="flex gap-4 items-end mb-4">
        <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Cross-section interval (m)</label><input value={interval} onChange={e => setInterval(e.target.value)} className={inputCls + ' w-32'} /></div>
        <button onClick={handleOrganize} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Organize by Chainage</button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4 text-xs text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {crossSections.length > 0 && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-sm font-semibold">Cross-Sections ({crossSections.length} stations)</h2>
            <span className="text-[10px] text-[var(--text-muted)]">Alignment length: {alignmentLength.toFixed(1)} m</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <th className="text-left py-2 px-1">Chainage</th><th className="text-right">Shots</th><th className="text-right">Left (m)</th><th className="text-right">Right (m)</th><th className="text-right">CL RL</th>
              </tr></thead>
              <tbody>
                {crossSections.map(cs => (
                  <tr key={cs.chainage} className="border-b border-[var(--border-color)]/30 text-[var(--text-secondary)]">
                    <td className="py-1.5 px-1 font-mono font-bold text-[var(--accent)]">{cs.label}</td>
                    <td className="text-right font-mono">{cs.shots.length}</td>
                    <td className="text-right font-mono">{cs.leftOffset.toFixed(1)}</td>
                    <td className="text-right font-mono">{cs.rightOffset.toFixed(1)}</td>
                    <td className="text-right font-mono">{cs.centrelineRL !== null ? cs.centrelineRL.toFixed(3) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-[10px] text-[var(--text-muted)]">
            {crossSections.reduce((sum, cs) => sum + cs.shots.length, 0)} total shots organized into {crossSections.length} cross-sections
          </div>
        </div>
      )}
    </div>
  )
}
