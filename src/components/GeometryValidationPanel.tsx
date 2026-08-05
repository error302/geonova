'use client';

import { useState } from 'react'
import DepartureWarning from './DepartureWarning'

interface ValidationResult {
  status: 'GREEN' | 'YELLOW' | 'RED' | 'ERROR' | null
  flags: string[]
  details?: Record<string, unknown>
  road_class?: string
  terrain?: string
}

export default function GeometryValidationPanel() {
  const [roadClass, setRoadClass] = useState('')
  const [terrain, setTerrain] = useState('flat')
  const [designSpeed, setDesignSpeed] = useState(80)
  const [gradient, setGradient] = useState(3)
  const [radius, setRadius] = useState(240)
  const [ssd, setSsd] = useState<number | ''>('')
  const [result, setResult] = useState<ValidationResult>({ status: null, flags: [] })
  const [loading, setLoading] = useState(false)

  const handleValidate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/validate-geometry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          road_class: roadClass || 'DR1',
          terrain,
          design_speed: designSpeed,
          proposed_gradient: gradient,
          proposed_radius: radius,
          proposed_ssd: ssd !== '' ? ssd : undefined,
        }),
      })
      const data = await res.json()
      setResult({ ...data, road_class: roadClass, terrain })
    } catch {
      setResult({ status: 'ERROR', flags: ['Failed to connect to validation service'] })
    } finally {
      setLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    GREEN: 'text-green-400',
    YELLOW: 'text-yellow-400',
    RED: 'text-red-400',
    ERROR: 'text-red-400',
  }
  const statusColor = result.status ? statusColors[result.status] || 'text-gray-400' : 'text-gray-400'

  return (
    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4 space-y-4">
      <h3 className="text-sm font-bold text-[var(--text-primary)]">Road Geometric Validation — RDM 1.3</h3>
      
      {result.status === 'RED' && <DepartureWarning result={result as any} />}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="road-class">Road Class</label>
          <select id="road-class" value={roadClass} onChange={e => setRoadClass(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]">
            <option value="DR1">DR1 — Motorway</option>
            <option value="DR2">DR2 — Arterial</option>
            <option value="DR3">DR3 — Collector</option>
            <option value="DR4">DR4 — Minor Collector</option>
            <option value="DR5">DR5 — Major Local</option>
            <option value="DR6">DR6 — Minor Local</option>
            <option value="DR7">DR7 — Local Access</option>
            <option value="Urban_Arterial">Urban Arterial</option>
            <option value="Urban_Collector">Urban Collector</option>
            <option value="Urban_Local">Urban Local</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="terrain">Terrain</label>
          <select id="terrain" value={terrain} onChange={e => setTerrain(e.target.value)} className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]">
            <option value="flat">Flat</option>
            <option value="rolling">Rolling</option>
            <option value="mountainous">Mountainous</option>
            <option value="escarpment">Escarpment</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="design-speed-km-h">Design Speed (km/h)</label>
          <input id="design-speed-km-h" aria-label="Design Speed (km/h)" type="number" value={designSpeed} onChange={e => setDesignSpeed(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="proposed-gradient">Proposed Gradient (%)</label>
          <input id="proposed-gradient" aria-label="Proposed Gradient (%)" type="number" value={gradient} onChange={e => setGradient(Number(e.target.value))} step="0.1" className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="proposed-radius-m">Proposed Radius (m)</label>
          <input id="proposed-radius-m" aria-label="Proposed Radius (m)" type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-secondary)] mb-1" htmlFor="stop-sight-dist-m-opt">Stop Sight Dist. (m, opt.)</label>
          <input  id="stop-sight-dist-m-opt" aria-label="Stop Sight Dist. (m, opt.)" type="number" value={ssd} onChange={e => setSsd(e.target.value !== '' ? Number(e.target.value) : '')} className="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]" />
        </div>
      </div>

      <button onClick={handleValidate} disabled={loading} className="w-full px-3 py-2 text-xs bg-amber-500 text-black font-bold rounded hover:bg-amber-400 disabled:opacity-50">
        {loading ? 'Validating...' : 'Validate Geometry (RDM 1.3)'}
      </button>

      {result.status && result.status !== 'ERROR' && (
        <div className="text-center">
          <span className={`text-2xl font-bold ${statusColor}`}>{result.status}</span>
        </div>
      )}

      {result.flags.length > 0 && (
        <ul className="space-y-1">
          {result.flags.map((flag, i) => (
            <li key={`${flag}-${i}`} className={`text-xs px-2 py-1 rounded ${result.status === 'RED' ? 'bg-red-900/20 text-red-300' : result.status === 'YELLOW' ? 'bg-yellow-900/20 text-yellow-300' : 'bg-green-900/20 text-green-300'}`}>
              {flag}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
