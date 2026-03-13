'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { geographicToUTM } from '@/lib/engine/coordinates'

interface AddPointModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  utmZone: number
  hemisphere: 'N' | 'S'
  prefillEasting?: number
  prefillNorthing?: number
  onPointAdded: () => void
  editPointId?: string
  editPointName?: string
  editPointEasting?: number
  editPointNorthing?: number
  editPointElevation?: number
  editPointIsControl?: boolean
}

export default function AddPointModal({
  isOpen,
  onClose,
  projectId,
  utmZone,
  hemisphere,
  prefillEasting,
  prefillNorthing,
  onPointAdded,
  editPointId,
  editPointName,
  editPointEasting,
  editPointNorthing,
  editPointElevation,
  editPointIsControl
}: AddPointModalProps) {
  const [name, setName] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [elevation, setElevation] = useState('0')
  const [isControl, setIsControl] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const isEditMode = !!editPointId

  useEffect(() => {
    if (isEditMode && editPointName) {
      setName(editPointName)
      setEasting(editPointEasting?.toFixed(4) || '')
      setNorthing(editPointNorthing?.toFixed(4) || '')
      setElevation(editPointElevation?.toString() || '0')
      setIsControl(editPointIsControl || false)
    } else if (prefillEasting !== undefined) {
      setEasting(prefillEasting.toFixed(4))
    }
    if (prefillNorthing !== undefined) {
      setNorthing(prefillNorthing.toFixed(4))
    }
    if (!isEditMode) {
      setName('')
      setElevation('0')
      setIsControl(false)
    }
  }, [prefillEasting, prefillNorthing, isEditMode, editPointName, editPointEasting, editPointNorthing, editPointElevation, editPointIsControl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Check for duplicate point name (only for new points)
    if (!isEditMode) {
      const { data: existing } = await supabase
        .from('survey_points')
        .select('name')
        .eq('project_id', projectId)
        .eq('name', name)
        .single()

      if (existing) {
        setError('Point name already exists in this project.')
        setLoading(false)
        return
      }
    }

    let error
    try {
      if (isEditMode) {
        ({ error } = await supabase.from('survey_points').update({
          name,
          easting: parseFloat(easting),
          northing: parseFloat(northing),
          elevation: parseFloat(elevation) || 0,
          is_control: isControl
        }).eq('id', editPointId))
      } else {
        ({ error } = await supabase.from('survey_points').insert({
          project_id: projectId,
          name,
          easting: parseFloat(easting),
          northing: parseFloat(northing),
          elevation: parseFloat(elevation) || 0,
          is_control: isControl
        }))
      }
    } catch (err) {
      setError('Failed to save point. Please try again.')
      setLoading(false)
      return
    }

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setName('')
      setEasting('')
      setNorthing('')
      setElevation('0')
      setIsControl(false)
      onPointAdded()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-gray-100 mb-4">
          {isEditMode ? 'Edit Survey Point' : 'Add Survey Point'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-1">Point Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100 font-mono"
              placeholder="e.g., TP01, BM1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Easting (m) *</label>
              <input
                type="number"
                step="0.0001"
                value={easting}
                onChange={(e) => setEasting(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100 font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Northing (m) *</label>
              <input
                type="number"
                step="0.0001"
                value={northing}
                onChange={(e) => setNorthing(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100 font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Elevation (m)</label>
            <input
              type="number"
              step="0.001"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded focus:border-[#E8841A] focus:outline-none text-gray-100 font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isControl"
              checked={isControl}
              onChange={(e) => setIsControl(e.target.checked)}
              className="w-4 h-4 rounded bg-gray-800 border-gray-700 text-[#E8841A] focus:ring-[#E8841A]"
            />
            <label htmlFor="isControl" className="text-sm text-gray-300">
              This is a control point
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors disabled:opacity-50"
            >
              {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Point')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
