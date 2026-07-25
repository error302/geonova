'use client'

import { useEffect, useState } from 'react'
import type { EngineeringMode, EngineeringStandard, RoadDesignData } from '@/types/engineering'
import { KRDM2017, KeRRA, getCarriagewayWidth } from '@/lib/standards/engineering'
import type { EngineeringProject } from '../shared'
import { ROAD_CLASSES } from '../shared'

/**
 * Step 1 — Project Setup.
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 * Same props, same behavior.
 */
export function Step1Setup({
  project,
  data,
  onSave,
  mode,
  onModeChange
}: {
  project: EngineeringProject
  data: RoadDesignData | null
  onSave: (data: Partial<RoadDesignData>) => void
  mode: EngineeringMode
  onModeChange: (mode: EngineeringMode) => void
}) {
  const [roadName, setRoadName] = useState(data?.roadName || '')
  const [startChainage, setStartChainage] = useState(data?.startChainage || 0)
  const [designSpeed, setDesignSpeed] = useState(data?.designSpeed || 60)
  const [roadClass, setRoadClass] = useState<string>(data?.roadClass || 'C')
  const [standard, setStandard] = useState<EngineeringStandard>(data?.standard || 'KRDM2017')
  const [datum, setDatum] = useState(data?.datum || 'Arc 1960')
  const [coordSys, setCoordSys] = useState(data?.coordinateSystem || 'UTM Zone 37S')

  const standardObj = standard === 'KRDM2017' ? KRDM2017 : KeRRA
  const speedRange = standardObj.designSpeeds[roadClass as keyof typeof standardObj.designSpeeds]

  useEffect(() => {
    if (speedRange && (designSpeed < speedRange[0] || designSpeed > speedRange[1])) {
      setDesignSpeed(speedRange[0])
    }
  }, [roadClass, standard, speedRange, designSpeed])

  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    if (!roadName.trim()) {
      setError('Road name is required')
      return
    }
    if (designSpeed <= 0) {
      setError('Design speed must be greater than 0')
      return
    }
    setError(null)
    onSave({
      roadName: roadName.trim(),
      startChainage,
      designSpeed,
      roadClass: roadClass as any,
      standard,
      datum,
      coordinateSystem: coordSys
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Project Setup</h3>
        <p className="text-zinc-400 text-sm">Define road parameters per {standard} standard.</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="border border-zinc-700 rounded-lg p-4">
        <label className="block text-sm text-zinc-400 mb-2">Engineering Mode</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onModeChange('road')}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition ${
              mode === 'road'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            [WIP] Road Design
          </button>
          <button
            type="button"
            onClick={() => onModeChange('drainage')}
            className={`flex-1 py-3 px-4 rounded-lg border text-sm font-medium transition ${
              mode === 'drainage'
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            [Rain] Drainage Survey
          </button>
        </div>
      </div>

      {mode === 'road' && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Road Name</label>
          <input
            type="text"
            value={roadName}
            onChange={e => setRoadName(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            aria-label="e.g. Nairobi-Mombasa Highway" placeholder="e.g. Nairobi-Mombasa Highway"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Start Chainage (m)</label>
          <input aria-label="Start Chainage (m)"
            type="number"
            value={startChainage}
            onChange={e => setStartChainage(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Road Class (per {standard})</label>
          <select
            value={roadClass}
            onChange={e => setRoadClass(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            {ROAD_CLASSES.map((c) => (
              <option key={c} value={c}>Class {c} {standard === 'KRDM2017' ? '- ' + (c === 'A' ? 'Major Arterial' : c === 'D' ? 'Minor Collector' : '') : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Design Speed (km/h)</label>
          <input aria-label="Design Speed (km/h)"
            type="number"
            value={designSpeed}
            onChange={e => setDesignSpeed(Number(e.target.value))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
            min={speedRange?.[0] || 30}
            max={speedRange?.[1] || 120}
          />
          <p className="text-xs text-zinc-500 mt-1">Valid range: {speedRange?.[0] || 30} - {speedRange?.[1] || 120} km/h</p>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Standard</label>
          <select
            value={standard}
            onChange={e => setStandard(e.target.value as EngineeringStandard)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="KRDM2017">KRDM 2017</option>
            <option value="KeRRA">KeRRA (Rural Roads)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Carriageway Width (m)</label>
          <input aria-label="Carriageway Width (m)"
            type="number"
            step="0.1"
            value={getCarriagewayWidth(standard, roadClass as any)}
            disabled
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Datum</label>
          <select
            value={datum}
            onChange={e => setDatum(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="Arc 1960">Arc 1960</option>
            <option value="WGS84">WGS84</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Coordinate System</label>
          <select
            value={coordSys}
            onChange={e => setCoordSys(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white"
          >
            <option value="UTM Zone 37S">UTM Zone 37S</option>
            <option value="UTM Zone 36S">UTM Zone 36S</option>
            <option value="UTM Zone 38S">UTM Zone 38S</option>
          </select>
        </div>
      </div>
      </>
      )}

      <button
        onClick={handleSave}
        className="px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400"
      >
        Save Setup
      </button>
    </div>
  )
}
