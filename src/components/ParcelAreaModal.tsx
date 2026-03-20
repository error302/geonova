'use client'

import { useState } from 'react'
import { coordinateArea } from '@/lib/engine/area'
import { distanceBearing } from '@/lib/engine/distance'
import { SurveyPoint } from './ProjectMap'

interface ParcelAreaModalProps {
  isOpen: boolean
  onClose: () => void
  points: SurveyPoint[]
  onAreaResult?: (result: { squareMeters: number; hectares: number; acres: number; perimeter: number }) => void
}

export default function ParcelAreaModal({ isOpen, onClose, points, onAreaResult }: ParcelAreaModalProps) {
  const [selectedPoints, setSelectedPoints] = useState<SurveyPoint[]>([])
  const [result, setResult] = useState<{
    areaSqm: number
    areaHa: number
    areaAcres: number
    perimeter: number
  } | null>(null)

  const handlePointClick = (point: SurveyPoint) => {
    // Check if clicking first point to close
    if (selectedPoints.length >= 3 && selectedPoints[0].id === point.id) {
      calculateArea()
      return
    }
    
    // Add point if not already selected
    if (!selectedPoints.some(p => p.id === point.id)) {
      setSelectedPoints([...selectedPoints, point])
    }
  }

  const calculateArea = () => {
    if (selectedPoints.length < 3) return

    const coords = selectedPoints.map(p => ({
      easting: p.easting,
      northing: p.northing
    }))

    const areaResult = coordinateArea(coords)
    setResult(areaResult)
    if (onAreaResult) {
      onAreaResult({
        squareMeters: areaResult.areaSqm,
        hectares: areaResult.areaHa,
        acres: areaResult.areaAcres,
        perimeter: areaResult.perimeter
      })
    }
  }

  const clearSelection = () => {
    setSelectedPoints([])
    setResult(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Compute Parcel Area</h2>

        <p className="text-[var(--text-secondary)] text-sm mb-4">
          Click points on the map in boundary order. Click the first point again to close the polygon.
        </p>

        {/* Selected points list */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[var(--text-primary)]">Selected Points ({selectedPoints.length})</span>
            <button
              onClick={clearSelection}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPoints.map((p, i) => (
              <span
                key={p.id}
                className="px-2 py-1 bg-[var(--bg-tertiary)] rounded text-xs font-mono text-[var(--text-primary)]"
              >
                {i + 1}. {p.name}
              </span>
            ))}
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="mb-4 p-4 bg-[var(--bg-tertiary)]/50 rounded-lg border border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[#E8841A] mb-3">Parcel Area</h3>
            <div className="space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Area:</span>
                <span className="text-[var(--text-primary)]">{result.areaSqm.toFixed(4)} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Hectares:</span>
                <span className="text-[var(--text-primary)]">{result.areaHa.toFixed(6)} ha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">Acres:</span>
                <span className="text-[var(--text-primary)]">{result.areaAcres.toFixed(6)} acres</span>
              </div>
              <div className="border-t border-[var(--border-color)] pt-2 mt-2 flex justify-between">
                <span className="text-[var(--text-secondary)]">Perimeter:</span>
                <span className="text-[#E8841A] font-semibold">{result.perimeter.toFixed(4)} m</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded"
          >
            Close
          </button>
          {selectedPoints.length >= 3 && !result && (
            <button
              onClick={calculateArea}
              className="flex-1 px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded"
            >
              Calculate Area
            </button>
          )}
          {result && (
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
