'use client'

import { useRef, useState } from 'react'
import type { RoadDesignData, StationData } from '@/types/engineering'

/**
 * Step 5 — Stations & Levels (ground levels at chainage intervals).
 *
 * Extracted verbatim from src/app/project/[id]/engineering/page.tsx.
 * Supports manual entry and CSV import (chainage, ground_level columns).
 */
export function Step5Stations({
  data,
  onSave
}: {
  data: RoadDesignData | null
  onSave: (stations: StationData[]) => void
}) {
  const [stations, setStations] = useState<StationData[]>(data?.stations || [])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const addStation = () => {
    const lastCh = stations.length > 0 ? stations[stations.length - 1].chainage : 0
    setStations([...stations, { chainage: lastCh + 20, groundLevel: 0 }])
  }

  const updateStation = (index: number, field: keyof StationData, value: StationData[keyof StationData]) => {
    const updated = [...stations]
    updated[index] = { ...updated[index], [field]: value }
    setStations(updated)
  }

  const removeStation = (index: number) => {
    setStations(stations.filter((_, i) => i !== index))
  }

  const handleSave = () => {
    onSave(stations)
  }

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string
        const lines = text.trim().split(/\r?\n/).filter(l => l.trim())
        if (lines.length < 2) {
          setToast({ message: 'CSV must have a header row and at least one data row', type: 'error' })
          return
        }

        // Parse header — normalize to lowercase, strip spaces
        const headerRaw = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_-]/g, ''))
        const chIdx = headerRaw.findIndex(h => h === 'chainage' || h === 'station' || h === 'chainage(m)')
        const glIdx = headerRaw.findIndex(h => h === 'groundlevel' || h === 'ground_level' || h === 'groundlevel(m)' || h === 'elevation' || h === 'level')

        if (chIdx === -1 || glIdx === -1) {
          setToast({ message: 'CSV must contain "chainage" and "ground_level" (or "groundLevel") columns', type: 'error' })
          return
        }

        const parsed: StationData[] = []
        let skipped = 0

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim())
          const chainage = parseFloat(cols[chIdx])
          const groundLevel = parseFloat(cols[glIdx])

          if (isNaN(chainage) || isNaN(groundLevel)) {
            skipped++
            continue
          }
          parsed.push({ chainage, groundLevel })
        }

        if (parsed.length === 0) {
          setToast({ message: 'No valid rows found — ensure chainage and ground_level are numeric', type: 'error' })
          return
        }

        // Sort by chainage ascending
        parsed.sort((a, b) => a.chainage - b.chainage)
        setStations(parsed)
        setToast({ message: `Imported ${parsed.length} station${parsed.length > 1 ? 's' : ''}${skipped > 0 ? ` (${skipped} skipped)` : ''}`, type: 'success' })
        setTimeout(() => setToast(null), 4000)
      } catch {
        setToast({ message: 'Failed to parse CSV file', type: 'error' })
        setTimeout(() => setToast(null), 4000)
      }
    }
    reader.readAsText(file)

    // Reset the input so re-importing the same file works
    e.target.value = ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Stations & Levels</h3>
        <p className="text-zinc-400 text-sm">Enter ground levels at chainage intervals (default 20m).</p>
      </div>

      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-green-900/90 text-green-300 border border-green-700' : 'bg-red-900/90 text-red-300 border border-red-700'
        }`}>
          {toast.type === 'success' ? ' ' : '[x] '}{toast.message}
        </div>
      )}

      {stations.length === 0 ? (
        <div className="text-center py-8 text-zinc-500">
          <p>No stations defined. Add stations to proceed.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800 text-zinc-400">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-right">Chainage (m)</th>
                <th className="px-3 py-2 text-right">Ground Level (m)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s, idx) => (
                <tr key={`${s}-${idx}`} className="border-t border-zinc-800">
                  <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <input aria-label="Chainage"
                      type="number"
                      value={s.chainage}
                      onChange={e => updateStation(idx, 'chainage', Number(e.target.value))}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input aria-label="Groundlevel"
                      type="number"
                      step="0.001"
                      value={s.groundLevel}
                      onChange={e => updateStation(idx, 'groundLevel', Number(e.target.value))}
                      className="w-24 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeStation(idx)} className="text-red-400 hover:text-red-300">[x]</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-3 items-center">
        <button
          onClick={addStation}
          className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800"
        >
          + Add Station
        </button>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleCSVImport}
          className="hidden"
        />
        <button
          onClick={() => csvInputRef.current?.click()}
          className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-800 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import CSV
        </button>
      </div>

      {stations.length >= 2 && (
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-400"
        >
          Save Stations
        </button>
      )}
    </div>
  )
}
