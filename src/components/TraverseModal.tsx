'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { bowditchAdjustment } from '@/lib/engine/traverse'
import { dmsToDecimal, decimalToDMS } from '@/lib/engine/angles'
import { distanceBearing } from '@/lib/engine/distance'
import { useCountry } from '@/lib/country'
import { getTraverseValidation } from '@/lib/engine/country-math'

interface BlunderResult {
  legName: string
  correction: string
  contribution: string
  isBlunder: boolean
  distanceMismatch: boolean
  warning: string | null
}

function detectBlunders(legs: any[], totalDistance: number): BlunderResult[] {
  const corrections = legs.map(l => Math.sqrt(l.correctionE ** 2 + l.correctionN ** 2))
  const avgCorrection = corrections.reduce((a, b) => a + b, 0) / corrections.length

  return legs.map((leg, i) => {
    const correction = Math.sqrt(leg.correctionE ** 2 + leg.correctionN ** 2)
    const contribution = (correction / totalDistance) * 100
    const isBlunder = avgCorrection > 0 && correction > avgCorrection * 3

    const computedDist = Math.sqrt(leg.rawDeltaE ** 2 + leg.rawDeltaN ** 2)
    const distanceMismatch = Math.abs(computedDist - leg.distance) > 1.0

    let bearingJumpWarning = false
    if (i > 0) {
      const prevBearing = legs[i - 1].bearing
      const currBearing = leg.bearing
      const diff = Math.abs(currBearing - prevBearing)
      bearingJumpWarning = diff > 150 && diff < 210
    }

    let warning: string | null = null
    if (isBlunder) {
      warning = `Correction ${correction.toFixed(3)}m is ${(correction / avgCorrection).toFixed(1)}× average — check bearing and distance`
    } else if (distanceMismatch) {
      warning = `Computed distance ${computedDist.toFixed(3)}m differs by ${Math.abs(computedDist - leg.distance).toFixed(3)}m`
    } else if (bearingJumpWarning) {
      warning = `Large bearing change of ${Math.abs(legs[i-1].bearing - leg.bearing).toFixed(1)}° — verify field reading`
    }

    return {
      legName: `${leg.from} → ${leg.to}`,
      correction: correction.toFixed(4),
      contribution: contribution.toFixed(1),
      isBlunder,
      distanceMismatch,
      warning
    }
  })
}

interface NamedPoint2D {
  name: string
  easting: number
  northing: number
}

function TraverseDiagram({ stations, closingError }: {
  stations: NamedPoint2D[]
  closingError: { e: number, n: number }
}) {
  const width = 500
  const height = 400
  const padding = 50

  const eastings = stations.map(s => s.easting)
  const northings = stations.map(s => s.northing)
  const minE = Math.min(...eastings)
  const maxE = Math.max(...eastings)
  const minN = Math.min(...northings)
  const maxN = Math.max(...northings)

  const scaleE = (width - padding * 2) / (maxE - minE || 1)
  const scaleN = (height - padding * 2) / (maxN - minN || 1)
  const scale = Math.min(scaleE, scaleN)

  function toScreen(e: number, n: number) {
    return {
      x: padding + (e - minE) * scale,
      y: height - padding - (n - minN) * scale
    }
  }

  const points = stations.map(s => ({
    ...s,
    ...toScreen(s.easting, s.northing)
  }))

  return (
    <svg width={width} height={height} className="bg-[var(--bg-secondary)] rounded border border-amber-500/30 w-full">
      {points.slice(0, -1).map((p, i) => (
        <line
          key={i}
          x1={p.x} y1={p.y}
          x2={points[i+1].x} y2={points[i+1].y}
          stroke="#E8841A"
          strokeWidth={2}
        />
      ))}

      {(() => {
        const last = points[points.length - 1]
        const first = points[0]
        return (
          <line
            x1={last.x} y1={last.y}
            x2={first.x} y2={first.y}
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5,5"
          />
        )
      })()}

      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x} cy={p.y} r={6}
            fill={i === 0 ? '#ef4444' : '#E8841A'}
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={p.x + 10} y={p.y - 8}
            fill="white"
            fontSize={11}
            fontFamily="monospace"
          >
            {p.name}
          </text>
        </g>
      ))}

      <g transform={`translate(${width - 30}, 30)`}>
        <line x1={0} y1={20} x2={0} y2={0} stroke="white" strokeWidth={2}/>
        <polygon points="0,-5 -4,5 4,5" fill="white"/>
        <text x={-4} y={30} fill="white" fontSize={10}>N</text>
      </g>

      <text x={10} y={height - 10} fill="#ef4444" fontSize={9} fontFamily="monospace">
        Misclosure vector (dashed red)
      </text>
    </svg>
  )
}

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

type TraverseType = 'closed' | 'link' | 'open' | 'radial'

interface RadialObservation {
  id: number
  pointName: string
  bearingDeg: string
  bearingMin: string
  bearingSec: string
  distance: string
}

function CountryPrecisionBadge({ country, totalDistance, linearError }: {
  country: string; totalDistance: number; linearError: number
}) {
  const { getTraverseOrder } = useCountry()
  const order = getTraverseOrder('default')
  if (!order || totalDistance === 0) return null
  const achieved = linearError > 0 ? totalDistance / linearError : Infinity
  const passes = achieved >= order.minPrecision
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${passes ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
      {passes ? '✓' : '✗'} Req 1:{order.minPrecision.toLocaleString()}
    </span>
  )
}

export default function TraverseModal({
  isOpen,
  onClose,
  projectId,
  onTraverseComplete,
  onTraverseResult
}: TraverseModalProps) {
  const { country, standard, getTraverseOrder } = useCountry()
  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'results'>('input')
  
  // Traverse type selector
  const [traverseType, setTraverseType] = useState<TraverseType>('closed')
  
  // Radial observations
  const [radialStationId, setRadialStationId] = useState('')
  const [radialObservations, setRadialObservations] = useState<RadialObservation[]>([
    { id: 1, pointName: '', bearingDeg: '', bearingMin: '', bearingSec: '', distance: '' }
  ])
  
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
  const [blunderResults, setBlunderResults] = useState<BlunderResult[]>([])
  const [diagramStations, setDiagramStations] = useState<NamedPoint2D[]>([])
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
      // Handle Radial Survey
      if (traverseType === 'radial') {
        if (!radialStationId) {
          throw new Error('Select instrument station')
        }
        
        const station = controlPoints.find(p => p.id === radialStationId)
        if (!station) throw new Error('Instrument station not found')
        
        const computedPoints = []
        let cumulativeDist = 0
        
        for (const obs of radialObservations) {
          if (!obs.pointName || !obs.distance || !obs.bearingDeg) continue
          
          const dist = parseFloat(obs.distance)
          const bearing = dmsToDecimal({
            degrees: parseInt(obs.bearingDeg) || 0,
            minutes: parseInt(obs.bearingMin) || 0,
            seconds: parseFloat(obs.bearingSec) || 0,
            direction: 'N'
          })
          
          const rad = bearing * Math.PI / 180
          const easting = station.easting + dist * Math.sin(rad)
          const northing = station.northing + dist * Math.cos(rad)
          cumulativeDist += dist
          
          computedPoints.push({
            name: obs.pointName,
            easting,
            northing,
            distance: dist,
            bearing,
            cumulativeDist
          })
        }
        
        setResults({
          type: 'radial',
          station,
          points: computedPoints,
          totalDistance: cumulativeDist,
          closingErrorE: 0,
          closingErrorN: 0,
          linearError: 0,
          precisionRatio: 0,
          precisionGrade: 'N/A',
          isClosed: false
        })
        
        setStep('results')
        setLoading(false)
        return
      }
      
      // Handle Open Traverse (no closing control)
      if (traverseType === 'open') {
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
        
        const computedStations = []
        let currentE = openingE
        let currentN = openingN
        let cumulativeDist = 0
        
        computedStations.push({
          name: openingPtName,
          easting: currentE,
          northing: currentN,
          distance: 0,
          bearing: null,
          bearingDMS: '—',
          cumulativeDist: 0
        })
        
        for (const leg of legs) {
          if (!leg.distance || !leg.bearingDeg) continue
          
          const dist = parseFloat(leg.distance)
          const bearing = dmsToDecimal({
            degrees: parseInt(leg.bearingDeg) || 0,
            minutes: parseInt(leg.bearingMin) || 0,
            seconds: parseFloat(leg.bearingSec) || 0,
            direction: 'N'
          })
          
          cumulativeDist += dist
          const rad = bearing * Math.PI / 180
          currentE = currentE + dist * Math.sin(rad)
          currentN = currentN + dist * Math.cos(rad)
          
          computedStations.push({
            name: leg.stationName || `T${computedStations.length}`,
            easting: currentE,
            northing: currentN,
            distance: dist,
            bearing,
            bearingDMS: decimalToDMS(bearing, false),
            cumulativeDist
          })
        }
        
        setResults({
          type: 'open',
          stations: computedStations,
          openingPoint: { name: openingPtName, easting: openingE, northing: openingN },
          closingErrorE: 0,
          closingErrorN: 0,
          linearError: 0,
          precisionRatio: 0,
          precisionGrade: 'N/A',
          totalDistance: cumulativeDist,
          isClosed: false
        })
        
        setStep('results')
        setLoading(false)
        return
      }
      
      // Existing closed/link traverse logic...
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

      let closingPoint: { easting: number; northing: number } | undefined

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
        
        // Use known closing control as a constraint (do not append as an extra computed station)
        // Bowditch will distribute the misclosure across the measured legs.
        closingPoint = { easting: closingE, northing: closingN }
      }

      // Run Bowditch adjustment
      const traverseInput = {
        points,
        distances,
        bearings,
        closingPoint,
      }

      const traverseResult = bowditchAdjustment(traverseInput)
      setResults(traverseResult)
      if (onTraverseResult) {
        onTraverseResult(traverseResult)
      }

      // Run blunder detection
      const blunders = detectBlunders(traverseResult.legs, traverseResult.totalDistance)
      setBlunderResults(blunders)

      // Build diagram stations
      const diagramPts: NamedPoint2D[] = points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing
      }))
      setDiagramStations(diagramPts)

      setStep('results')
    } catch (err: any) {
      setError(err.message || 'Calculation failed')
    }

    setLoading(false)
  }

  const loadTestData = () => {
    setOpeningUseExisting(true)
    // Will need to find CP1 from controlPoints
    setTimeout(() => {
      const cp1 = controlPoints.find(p => p.name === 'CP1')
      if (cp1) {
        setOpeningPointId(cp1.id)
      }
    }, 100)
    setLegs([
      { id: 1, stationName: 'P1', distance: '100', bearingDeg: '0', bearingMin: '0', bearingSec: '0' },
      { id: 2, stationName: 'P2', distance: '100', bearingDeg: '90', bearingMin: '0', bearingSec: '0' },
      { id: 3, stationName: 'P3', distance: '100', bearingDeg: '180', bearingMin: '0', bearingSec: '0' },
      { id: 4, stationName: 'P4', distance: '100', bearingDeg: '270', bearingMin: '0', bearingSec: '0' },
      { id: 5, stationName: 'P5', distance: '100', bearingDeg: '0', bearingMin: '0', bearingSec: '0' },
    ])
    setHasClosingControl(false)
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
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Run Traverse</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'input' && (
          <div className="space-y-6">
            {/* Traverse Type Selector */}
            <div className="border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Traverse Type</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => setTraverseType('closed')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    traverseType === 'closed' 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border-color)] hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)]">Closed Loop</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTraverseType('link')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    traverseType === 'link' 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border-color)] hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)]">Link</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTraverseType('open')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    traverseType === 'open' 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border-color)] hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)]">Open</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTraverseType('radial')}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    traverseType === 'radial' 
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
                      : 'border-[var(--border-color)] hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-[var(--text-primary)]">Radial</div>
                </button>
              </div>
              
              <div className="text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)]/50 rounded p-3">
                {traverseType === 'closed' && 'Closed Loop: Starts and ends at same control point. Misclosure computed and adjusted.'}
                {traverseType === 'link' && 'Link Traverse: Connects two known control points. Precision checked against closing control.'}
                {traverseType === 'open' && 'Open Traverse: Starts at known control, no closing control. Used for roads/pipelines. Running coordinates computed.'}
                {traverseType === 'radial' && 'Radial Survey: One instrument station observing multiple detail points. Compute coordinates for each ray.'}
              </div>
            </div>

            {/* Radial Survey Input */}
            {traverseType === 'radial' && (
              <div className="border border-[var(--border-color)] rounded-lg p-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Radial Survey</h3>
                
                <div className="mb-4">
                  <label className="block text-sm text-[var(--text-secondary)] mb-2">Instrument Station</label>
                  <select
                    value={radialStationId}
                    onChange={(e) => setRadialStationId(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  >
                    <option value="">Select station...</option>
                    {controlPoints.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-3">
                  {radialObservations.map((obs, idx) => (
                    <div key={obs.id} className="grid grid-cols-5 gap-2 items-end">
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Point</label>
                        <input
                          type="text"
                          value={obs.pointName}
                          onChange={(e) => {
                            const updated = [...radialObservations]
                            updated[idx].pointName = e.target.value
                            setRadialObservations(updated)
                          }}
                          className="w-full px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                          placeholder="P1"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Deg</label>
                        <input
                          type="number"
                          value={obs.bearingDeg}
                          onChange={(e) => {
                            const updated = [...radialObservations]
                            updated[idx].bearingDeg = e.target.value
                            setRadialObservations(updated)
                          }}
                          className="w-full px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                          placeholder="000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Min</label>
                        <input
                          type="number"
                          value={obs.bearingMin}
                          onChange={(e) => {
                            const updated = [...radialObservations]
                            updated[idx].bearingMin = e.target.value
                            setRadialObservations(updated)
                          }}
                          className="w-full px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Sec</label>
                        <input
                          type="number"
                          value={obs.bearingSec}
                          onChange={(e) => {
                            const updated = [...radialObservations]
                            updated[idx].bearingSec = e.target.value
                            setRadialObservations(updated)
                          }}
                          className="w-full px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                          placeholder="00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Dist (m)</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={obs.distance}
                            onChange={(e) => {
                              const updated = [...radialObservations]
                              updated[idx].distance = e.target.value
                              setRadialObservations(updated)
                            }}
                            className="flex-1 px-2 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm"
                            placeholder="0.000"
                          />
                          {radialObservations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setRadialObservations(radialObservations.filter((_, i) => i !== idx))}
                              className="px-2 py-2 bg-red-900/50 hover:bg-red-900 text-red-400 rounded text-sm"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  onClick={() => setRadialObservations([...radialObservations, { 
                    id: radialObservations.length + 1, 
                    pointName: '', 
                    bearingDeg: '', 
                    bearingMin: '', 
                    bearingSec: '', 
                    distance: '' 
                  }])}
                  className="mt-3 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded text-sm"
                >
                  + Add Point
                </button>
              </div>
            )}

            {/* Section 1: Opening Control Point */}
            {traverseType !== 'radial' && (
            <div className="border border-[var(--border-color)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Opening Control Point</h3>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    type="button"
                    onClick={loadTestData}
                    className="text-xs text-[var(--text-muted)] underline hover:text-[var(--text-secondary)]"
                  >
                    Load test data
                  </button>
                )}
              </div>
              
              <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2 text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={openingUseExisting}
                    onChange={() => setOpeningUseExisting(true)}
                    className="text-[var(--accent)]"
                  />
                  Select from project
                </label>
                <label className="flex items-center gap-2 text-[var(--text-primary)]">
                  <input
                    type="radio"
                    checked={!openingUseExisting}
                    onChange={() => setOpeningUseExisting(false)}
                    className="text-[var(--accent)]"
                  />
                  Manual entry
                </label>
              </div>

              {openingUseExisting ? (
                <select
                  value={openingPointId}
                  onChange={(e) => setOpeningPointId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
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
                    className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Easting"
                    value={openingEasting}
                    onChange={(e) => setOpeningEasting(e.target.value)}
                    className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                  />
                  <input
                    type="number"
                    placeholder="Northing"
                    value={openingNorthing}
                    onChange={(e) => setOpeningNorthing(e.target.value)}
                    className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                  />
                </div>
              )}

            </div>
            )}

            {/* Section 2: Traverse Legs */}
            <div className="border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Traverse Legs</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-color)]">
                      <th className="px-2 py-2 text-left text-[var(--text-primary)]">Station</th>
                      <th className="px-2 py-2 text-left text-[var(--text-primary)]">Distance (m)</th>
                      <th className="px-2 py-2 text-left text-[var(--text-primary)]" colSpan={3}>Bearing (DMS)</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {legs.map((leg) => (
                      <tr key={leg.id} className="border-b border-[var(--border-color)]/50">
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            value={leg.stationName}
                            onChange={(e) => updateLeg(leg.id, 'stationName', e.target.value)}
                            placeholder="TP01"
                            className="w-full px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.001"
                            value={leg.distance}
                            onChange={(e) => updateLeg(leg.id, 'distance', e.target.value)}
                            className="w-28 px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="D"
                            value={leg.bearingDeg}
                            onChange={(e) => updateLeg(leg.id, 'bearingDeg', e.target.value)}
                            className="w-14 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="M"
                            value={leg.bearingMin}
                            onChange={(e) => updateLeg(leg.id, 'bearingMin', e.target.value)}
                            className="w-12 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="number"
                            placeholder="S"
                            value={leg.bearingSec}
                            onChange={(e) => updateLeg(leg.id, 'bearingSec', e.target.value)}
                            className="w-14 px-1 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
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
                className="mt-3 px-3 py-1 text-sm bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded"
              >
                + Add Row
              </button>
            </div>

            {/* Section 3: Closing Control - only for closed/link */}
            {(traverseType === 'closed' || traverseType === 'link') && (
            <div className="border border-[var(--border-color)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  checked={hasClosingControl}
                  onChange={(e) => setHasClosingControl(e.target.checked)}
                  className="w-4 h-4 text-[var(--accent)]"
                />
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Closing Control Point</h3>
              </div>
              
              {hasClosingControl && (
                <>
                  <div className="flex gap-4 mb-4">
                    <label className="flex items-center gap-2 text-[var(--text-primary)]">
                      <input
                        type="radio"
                        checked={closingUseExisting}
                        onChange={() => setClosingUseExisting(true)}
                        className="text-[var(--accent)]"
                      />
                      Select from project
                    </label>
                    <label className="flex items-center gap-2 text-[var(--text-primary)]">
                      <input
                        type="radio"
                        checked={!closingUseExisting}
                        onChange={() => setClosingUseExisting(false)}
                        className="text-[var(--accent)]"
                      />
                      Manual entry
                    </label>
                  </div>

                  {closingUseExisting ? (
                    <select
                      value={closingPointId}
                      onChange={(e) => setClosingPointId(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
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
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Easting"
                        value={closingEasting}
                        onChange={(e) => setClosingEasting(e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Northing"
                        value={closingNorthing}
                        onChange={(e) => setClosingNorthing(e.target.value)}
                        className="px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] font-mono"
                      />
                    </div>
                  )}
                </>
              )}

              {!hasClosingControl && (
                <p className="text-[var(--text-muted)] text-sm">Leave blank for loop traverse</p>
              )}
            </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCalculate}
                disabled={loading}
                className="flex-1 px-6 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded disabled:opacity-50"
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
              <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
                <p className="text-[var(--text-secondary)] text-xs">Closing Error E</p>
                <p className="text-xl font-mono text-[var(--text-primary)]">{results.closingErrorE.toFixed(4)} m</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
                <p className="text-[var(--text-secondary)] text-xs">Closing Error N</p>
                <p className="text-xl font-mono text-[var(--text-primary)]">{results.closingErrorN.toFixed(4)} m</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
                <p className="text-[var(--text-secondary)] text-xs">Linear Misclosure</p>
                <p className="text-xl font-mono text-[var(--text-primary)]">{results.linearError.toFixed(4)} m</p>
              </div>
              <div className="bg-[var(--bg-tertiary)]/50 rounded p-3">
                <p className="text-[var(--text-secondary)] text-xs">Precision</p>
                <p className="text-xl font-mono text-[var(--text-primary)]">1 : {Math.round(1 / results.precisionRatio).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--text-primary)]">Grade:</span>
              <span className={`px-2 py-1 rounded text-sm font-semibold ${
                results.precisionGrade === 'excellent' ? 'bg-green-900/50 text-green-400' :
                results.precisionGrade === 'good' ? 'bg-blue-900/50 text-blue-400' :
                results.precisionGrade === 'acceptable' ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-red-900/50 text-red-400'
              }`}>
                {results.precisionGrade.toUpperCase()}
              </span>
              <span className="px-2 py-1 rounded text-xs bg-blue-900/50 text-blue-400">
                {standard.isoCode} · {standard.name}
              </span>
              <CountryPrecisionBadge country={country} totalDistance={results.totalDistance} linearError={results.linearError} />
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
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/50">
                    <th className="px-2 py-2 text-left text-[var(--text-primary)]">Line</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Distance</th>
                    <th className="px-2 py-2 text-left text-[var(--text-primary)]">Bearing</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Lat(+N)</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Lat(-S)</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Dep(+E)</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Dep(-W)</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Adj Lat</th>
                    <th className="px-2 py-2 text-right text-[var(--text-primary)]">Adj Dep</th>
                  </tr>
                </thead>
                <tbody>
                  {results.legs.map((leg: any, idx: number) => {
                    const blunder = blunderResults[idx]
                    const isBlunderRow = blunder?.isBlunder || blunder?.distanceMismatch
                    return (
                      <tr key={idx} className={`border-b border-[var(--border-color)]/50 ${isBlunderRow ? 'bg-red-900/30' : ''}`}>
                        <td className={`px-2 py-2 font-mono ${isBlunderRow ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                          {leg.from} → {leg.to}
                          {isBlunderRow && <span className="ml-2 text-red-400">⚠</span>}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">{leg.distance.toFixed(3)}</td>
                        <td className="px-2 py-2 font-mono text-[var(--text-primary)]">{leg.bearingDMS}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">{leg.rawDeltaN > 0 ? leg.rawDeltaN.toFixed(4) : '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">{leg.rawDeltaN < 0 ? Math.abs(leg.rawDeltaN).toFixed(4) : '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">{leg.rawDeltaE > 0 ? leg.rawDeltaE.toFixed(4) : '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--text-primary)]">{leg.rawDeltaE < 0 ? Math.abs(leg.rawDeltaE).toFixed(4) : '-'}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--accent)]">{leg.adjDeltaN.toFixed(4)}</td>
                        <td className="px-2 py-2 text-right font-mono text-[var(--accent)]">{leg.adjDeltaE.toFixed(4)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Traverse Diagram */}
            {diagramStations.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Traverse Diagram</h3>
                <div className="flex justify-center">
                  <TraverseDiagram 
                    stations={diagramStations} 
                    closingError={{ e: results.closingErrorE, n: results.closingErrorN }} 
                  />
                </div>
              </div>
            )}

            {/* Blunder Analysis */}
            {blunderResults.length > 0 && (
              <div className="mt-4 p-3 bg-[var(--bg-tertiary)]/50 rounded border border-[var(--border-color)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Blunder Detection Analysis</h3>
                <div className="space-y-2">
                  {blunderResults.map((b, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs ${b.isBlunder || b.distanceMismatch ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                      <span className="font-mono">{b.legName}</span>
                      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded overflow-hidden">
                        <div 
                          className={`h-full ${b.isBlunder ? 'bg-red-500' : 'bg-green-600'}`} 
                          style={{ width: `${Math.min(parseFloat(b.contribution), 100)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right">{b.contribution}%</span>
                      {b.isBlunder && <span className="text-red-400">⚠ CHECK</span>}
                      {!b.isBlunder && !b.distanceMismatch && <span className="text-green-400">✓ OK</span>}
                    </div>
                  ))}
                </div>
                {blunderResults.some(b => b.warning) && (
                  <div className="mt-3 pt-2 border-t border-[var(--border-color)]">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Warnings:</p>
                    {blunderResults.filter(b => b.warning).map((b, i) => (
                      <p key={i} className="text-xs text-red-400">• {b.warning}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input')
                  setSaveMessage(null)
                }}
                className="px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded"
              >
                Back
              </button>
              <button
                onClick={handleSaveAndClose}
                className="flex-1 px-6 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded"
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
