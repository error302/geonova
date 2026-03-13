'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { bowditchAdjustment } from '@/lib/engine/traverse'
import { dmsToDecimal, decimalToDMS } from '@/lib/engine/angles'
import { distanceBearing } from '@/lib/engine/distance'

interface TraverseModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onTraverseComplete: () => void
  onTraverseResult?: (result: any) => void
}

interface ControlPoint {
  id: string
  name: string
  easting: number
  northing: number
}

interface TraverseLeg {
  id: number
  stationName: string
  distance: string
  bearingDeg: string
  bearingMin: string
  bearingSec: string
}

export default function TraverseModal({
  isOpen,
  onClose,
  projectId,
  onTraverseComplete,
  onTraverseResult
}: TraverseModalProps) {
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'results'>('input')
  
  // Opening control
  const [openingUseExisting, setOpeningUseExisting] = useState(true)
  const [openingPointId, setOpeningPointId] = useState('')
  const [openingName, setOpeningName] = useState('')
  const [openingEasting, setOpeningEasting] = useState('')
  const [openingNorthing, setOpeningNorthing] = useState('')
  
  // Traverse legs
  const [legs, setLegs] = useState<TraverseLeg[]>([
    { id: 1, stationName: '', distance: '', bearingDeg: '', bearingMin: '', bearingSec: '' },
    { id: 2, stationName: '', distance: '', bearingDeg: '', bearingMin: '', bearingSec: '' }
  ])
  
  // Closing control
  const [closingUseExisting, setClosingUseExisting] = useState(true)
  const [closingPointId, setClosingPointId] = useState('')
  const [closingName, setClosingName] = useState('')
  const [closingEasting, setClosingEasting] = useState('')
  const [closingNorthing, setClosingNorthing] = useState('')
  const [hasClosingControl, setHasClosingControl] = useState(false)
  
  // Results
  const [results, setResults] = useState<any>(null)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [error, setError] = useState('')
  
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      fetchControlPoints()
      setStep('input')
      setResults(null)
      setSaveMessage(null)
    }
  }, [isOpen])

  const fetchControlPoints = async () => {
    const { data } = await supabase
      .from('survey_points')
      .select('id, name, easting, northing')
      .eq('project_id', projectId)
      .eq('is_control', true)
      .order('name')
    
    if (data) {
      setControlPoints(data)
      if (data.length > 0) {
        setOpeningPointId(data[0].id)
        setClosingPointId(data[0].id)
      }
    }
  }

  const addLeg = () => {
    const newId = legs.length > 0 ? Math.max(...legs.map(l => l.id)) + 1 : 1
    setLegs([...legs, { id: newId, stationName: '', distance: '', bearingDeg: '', bearingMin: '', bearingSec: '' }])
  }

  const removeLeg = (id: number) => {
    if (legs.length > 2) {
      setLegs(legs.filter(l => l.id !== id))
    }
  }

  const updateLeg = (id: number, field: keyof TraverseLeg, value: string) => {
    setLegs(legs.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const handleCalculate = async () => {
    setError('')
    setLoading(true)

    try {
      // Get opening point coordinates
      let openingE: number, openingN: number, openingPtName: string
      
      if (openingUseExisting && openingPointId) {
        const pt = controlPoints.find(p => p.id === openingPointId)
        if (!pt) throw new Error('Select opening control point')
        openingE = pt.easting
        openingN = pt.northing
        openingPtName = pt.name
      } else {
        if (!openingEasting || !openingNorthing || !openingName) {
          throw new Error('Enter opening point coordinates')
        }
        openingE = parseFloat(openingEasting)
        openingN = parseFloat(openingNorthing)
        openingPtName = openingName
      }

      // Build traverse points - each leg's bearing is from previous point to this leg's point
      const points: { name: string; easting: number; northing: number }[] = [
        { name: openingPtName, easting: openingE, northing: openingN }
      ]
      const distances: number[] = []
      const bearings: number[] = []

      let currentE = openingE
      let currentN = openingN

      for (const leg of legs) {
        if (!leg.distance || !leg.bearingDeg) continue
        
        const dist = parseFloat(leg.distance)
        const bearing = dmsToDecimal({
          degrees: parseInt(leg.bearingDeg) || 0,
          minutes: parseInt(leg.bearingMin) || 0,
          seconds: parseFloat(leg.bearingSec) || 0,
          direction: 'N'
        })
        
        distances.push(dist)
        bearings.push(bearing)
        
        // DEBUG: Verify bearing calculation
        console.log('Leg test:', {
          bearing: bearing,
          distance: dist,
          deltaE: dist * Math.sin(bearing * Math.PI / 180),
          deltaN: dist * Math.cos(bearing * Math.PI / 180)
        })
        
        // Calculate next point position using this leg's bearing
        const rad = bearing * Math.PI / 180
        currentE = currentE + dist * Math.sin(rad)
        currentN = currentN + dist * Math.cos(rad)
        
        points.push({
          name: leg.stationName || `P${points.length}`,
          easting: currentE,
          northing: currentN
        })
      }

      // Add closing control if provided
      if (hasClosingControl) {
        let closingE: number, closingN: number
        
        if (closingUseExisting && closingPointId) {
          const pt = controlPoints.find(p => p.id === closingPointId)
          if (!pt) throw new Error('Select closing control point')
          closingE = pt.easting
          closingN = pt.northing
        } else {
          if (!closingEasting || !closingNorthing) {
            throw new Error('Enter closing point coordinates')
          }
          closingE = parseFloat(closingEasting)
          closingN = parseFloat(closingNorthing)
        }
        
        points.push({ name: closingName || 'Closing', easting: closingE, northing: closingN })
      }

      // Run Bowditch adjustment
      const traverseInput = {
        points,
        distances,
        bearings: bearings.slice(0, -1) // Last bearing is to closing point
      }

      const traverseResult = bowditchAdjustment(traverseInput)
      setResults(traverseResult)
      if (onTraverseResult) {
        onTraverseResult(traverseResult)
      }

      setStep('results')
    } catch (err: any) {
      setError(err.message || 'Calculation failed')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setLegs([
      { id: 1, stationName: '', distance: '', bearingDeg: '', bearingMin: '', bearingSec: '' },
      { id: 2, stationName: '', distance: '', bearingDeg: '', bearingMin: '', bearingSec: '' }
    ])
    setResults(null)
    setError('')
    setSaveMessage(null)
    onClose()
  }

  const handleSaveAndClose = async () => {
    if (!results) return

    // Check precision grade - don't save if POOR
    if (results.precisionGrade === 'poor') {
      setSaveMessage({ 
        type: 'error', 
        text: 'Precision is too low to save. Check your measurements and recalculate.' 
      })
      return
    }

    setLoading(true)

    try {
      // Delete existing non-control traverse stations first
      await supabase
        .from('survey_points')
        .delete()
        .eq('project_id', projectId)
        .eq('is_control', false)

      // Get the adjusted points from results
      // Results legs have: from, to, adjEasting, adjNorthing
      const adjustedPoints = results.legs.map((leg: any) => ({
        name: leg.to,
        easting: leg.adjEasting,
        northing: leg.adjNorthing
      }))

      // Insert fresh adjusted points (skip opening point as it's the control)
      if (adjustedPoints.length > 0) {
        const pointsToInsert = adjustedPoints
          .filter((p: any) => p.name)
          .map((p: any) => ({
            project_id: projectId,
            name: p.name,
            easting: Number(p.easting.toFixed(4)),
            northing: Number(p.northing.toFixed(4)),
            elevation: 0,
            is_control: false
          }))

        const { error: insertError } = await supabase
          .from('survey_points')
          .insert(pointsToInsert)

        if (insertError) {
          setSaveMessage({ type: 'error', text: `Error saving: ${insertError.message}` })
          setLoading(false)
          return
        }

        setSaveMessage({ 
          type: 'success', 
          text: `${pointsToInsert.length} points saved to project` 
        })
      }

      setLoading(false)
      setTimeout(() => {
        onTraverseComplete()
        handleClose()
      }, 1500)
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: `Error: ${err.message}` })
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose}></div>
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-100 mb-4">Run Traverse</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-6">
            {/* Section 1: Opening Control Point */}
            <div className="border border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-100 mb-3">Opening Control Point</h3>
              
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    checked={openingUseExisting}
                    onChange={() => setOpeningUseExisting(true)}
                    className="text-[#E8841A]"
                  />
                  Select from project
                </label>
                <label className="flex items-center gap-2 text-gray-300">
                  <input
                    type="radio"
                    checked={!openingUseExisting}
                    onChange={() => setOpeningUseExisting(false)}
                    className="text-[#E8841A]"
                  />
                  Manual entry
                </label>
              </div>

              {openingUseExisting ? (
                <select
                  value={openingPointId}
                  onChange={(e) => setOpeningPointId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100"
                >
                  {controlPoints.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (E: {p.easting.toFixed(4)}, N: {p.northing.toFixed(4)})</option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Point Name"
                    value={openingName}
                    onChange={(e) => setOpeningName(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Easting"
                    value={openingEasting}
                    onChange={(e) => setOpeningEasting(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Northing"
                    value={openingNorthing}
                    onChange={(e) => setOpeningNorthing(e.target.value)}
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                  />
                </div>
              )}

            </div>

            {/* Section 2: Traverse Legs */}
            <div className="border border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-100 mb-3">Traverse Legs</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-2 py-2 text-left text-gray-300">Station</th>
                      <th className="px-2 py-2 text-left text-gray-300">Distance (m)</th>
                      <th className="px-2 py-2 text-left text-gray-300" colSpan={3}>Bearing (DMS)</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map((leg) => (
                      <tr key={leg.id} className="border-b border-gray-700/50">
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={leg.stationName}
                            onChange={(e) => updateLeg(leg.id, 'stationName', e.target.value)}
                            placeholder="TP01"
                            className="w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.001"
                            value={leg.distance}
                            onChange={(e) => updateLeg(leg.id, 'distance', e.target.value)}
                            className="w-28 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="D"
                            value={leg.bearingDeg}
                            onChange={(e) => updateLeg(leg.id, 'bearingDeg', e.target.value)}
                            className="w-14 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="M"
                            value={leg.bearingMin}
                            onChange={(e) => updateLeg(leg.id, 'bearingMin', e.target.value)}
                            className="w-12 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="S"
                            value={leg.bearingSec}
                            onChange={(e) => updateLeg(leg.id, 'bearingSec', e.target.value)}
                            className="w-14 px-1 py-1 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                          />
                        </td>
                        <td className="px-2 py-2">
                          {legs.length > 2 && (
                            <button
                              onClick={() => removeLeg(leg.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button
                onClick={addLeg}
                className="mt-3 px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
              >
                + Add Row
              </button>
            </div>

            {/* Section 3: Closing Control */}
            <div className="border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={hasClosingControl}
                  onChange={(e) => setHasClosingControl(e.target.checked)}
                  className="w-4 h-4 text-[#E8841A]"
                />
                <h3 className="text-lg font-semibold text-gray-100">Closing Control Point</h3>
              </div>
              
              {hasClosingControl && (
                <>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 text-gray-300">
                      <input
                        type="radio"
                        checked={closingUseExisting}
                        onChange={() => setClosingUseExisting(true)}
                        className="text-[#E8841A]"
                      />
                      Select from project
                    </label>
                    <label className="flex items-center gap-2 text-gray-300">
                      <input
                        type="radio"
                        checked={!closingUseExisting}
                        onChange={() => setClosingUseExisting(false)}
                        className="text-[#E8841A]"
                      />
                      Manual entry
                    </label>
                  </div>

                  {closingUseExisting ? (
                    <select
                      value={closingPointId}
                      onChange={(e) => setClosingPointId(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100"
                    >
                      {controlPoints.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Point Name"
                        value={closingName}
                        onChange={(e) => setClosingName(e.target.value)}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Easting"
                        value={closingEasting}
                        onChange={(e) => setClosingEasting(e.target.value)}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Northing"
                        value={closingNorthing}
                        onChange={(e) => setClosingNorthing(e.target.value)}
                        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono"
                      />
                    </div>
                  )}
                </>
              )}

              {!hasClosingControl && (
                <p className="text-gray-500 text-sm">Leave blank for loop traverse</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="flex-1 px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded disabled:opacity-50"
              >
                {loading ? 'Calculating...' : 'Calculate'}
              </button>
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded p-3">
                <p className="text-gray-400 text-xs">Closing Error E</p>
                <p className="text-xl font-mono text-gray-100">{results.closingErrorE.toFixed(4)} m</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <p className="text-gray-400 text-xs">Closing Error N</p>
                <p className="text-xl font-mono text-gray-100">{results.closingErrorN.toFixed(4)} m</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <p className="text-gray-400 text-xs">Linear Misclosure</p>
                <p className="text-xl font-mono text-gray-100">{results.linearError.toFixed(4)} m</p>
              </div>
              <div className="bg-gray-800/50 rounded p-3">
                <p className="text-gray-400 text-xs">Precision</p>
                <p className="text-xl font-mono text-gray-100">1 : {Math.round(1 / results.precisionRatio)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-300">Grade:</span>
              <span className={`px-2 py-1 rounded text-sm font-semibold ${
                results.precisionGrade === 'excellent' ? 'bg-green-900/50 text-green-400' :
                results.precisionGrade === 'good' ? 'bg-blue-900/50 text-blue-400' :
                results.precisionGrade === 'acceptable' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {results.precisionGrade.toUpperCase()}
              </span>
            </div>

            {saveMessage && (
              <div className={`p-3 rounded text-sm ${
                saveMessage.type === 'success' 
                  ? 'bg-green-900/30 border border-green-600 text-green-400' 
                  : 'bg-red-900/30 border border-red-600 text-red-400'
              }`}>
                {saveMessage.text}
              </div>
            )}

            {/* Gale's Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 bg-gray-800/50">
                    <th className="px-2 py-2 text-left text-gray-300">Line</th>
                    <th className="px-2 py-2 text-right text-gray-300">Distance</th>
                    <th className="px-2 py-2 text-left text-gray-300">Bearing</th>
                    <th className="px-2 py-2 text-right text-gray-300">Lat(+N)</th>
                    <th className="px-2 py-2 text-right text-gray-300">Lat(-S)</th>
                    <th className="px-2 py-2 text-right text-gray-300">Dep(+E)</th>
                    <th className="px-2 py-2 text-right text-gray-300">Dep(-W)</th>
                    <th className="px-2 py-2 text-right text-gray-300">Adj Lat</th>
                    <th className="px-2 py-2 text-right text-gray-300">Adj Dep</th>
                  </tr>
                </thead>
                <tbody>
                  {results.legs.map((leg: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-700/50">
                      <td className="px-2 py-2 font-mono text-gray-100">{leg.from} → {leg.to}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{leg.distance.toFixed(3)}</td>
                      <td className="px-2 py-2 font-mono text-gray-300">{leg.bearingDMS}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{leg.rawDeltaN > 0 ? leg.rawDeltaN.toFixed(4) : '-'}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{leg.rawDeltaN < 0 ? Math.abs(leg.rawDeltaN).toFixed(4) : '-'}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{leg.rawDeltaE > 0 ? leg.rawDeltaE.toFixed(4) : '-'}</td>
                      <td className="px-2 py-2 text-right font-mono text-gray-300">{leg.rawDeltaE < 0 ? Math.abs(leg.rawDeltaE).toFixed(4) : '-'}</td>
                      <td className="px-2 py-2 text-right font-mono text-[#E8841A]">{leg.adjDeltaN.toFixed(4)}</td>
                      <td className="px-2 py-2 text-right font-mono text-[#E8841A]">{leg.adjDeltaE.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input')
                  setSaveMessage(null)
                }}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded"
              >
                Back
              </button>
              <button
                onClick={handleSaveAndClose}
                className="flex-1 px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded"
              >
                Save & Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
