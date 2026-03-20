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
  editPointControlOrder?: string
  editPointLocked?: boolean
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
  editPointIsControl,
  editPointControlOrder,
  editPointLocked
}: AddPointModalProps) {
  const [name, setName] = useState('')
  const [easting, setEasting] = useState('')
  const [northing, setNorthing] = useState('')
  const [elevation, setElevation] = useState('0')
  const [isControl, setIsControl] = useState(false)
  const [controlOrder, setControlOrder] = useState<'primary' | 'secondary' | 'temporary'>('secondary')
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const isEditMode = !!editPointId
  const isLocked = isEditMode && editPointLocked

  useEffect(() => {
    // Reset form when modal opens/closes or edit point changes
    if (isEditMode && editPointName) {
      setName(editPointName)
      setEasting(editPointEasting?.toFixed(4) || '')
      setNorthing(editPointNorthing?.toFixed(4) || '')
      setElevation(editPointElevation?.toString() || '0')
      setIsControl(editPointIsControl || false)
      setControlOrder((editPointControlOrder as any) || 'secondary')
      setLocked(editPointLocked || false)
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
      setControlOrder('secondary')
      setLocked(false)
    }
    setError(null)
    setSuccessMsg(null)
  }, [isOpen, prefillEasting, prefillNorthing, isEditMode, editPointName, editPointEasting, editPointNorthing, editPointElevation, editPointIsControl, editPointControlOrder, editPointLocked])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const client = createClient()

      if (isEditMode) {
        const { error: updateError } = await client
          .from('survey_points')
          .update({
            name: name.trim(),
            easting: Number(parseFloat(easting).toFixed(4)),
            northing: Number(parseFloat(northing).toFixed(4)),
            elevation: Number(parseFloat(elevation || '0').toFixed(4)),
            is_control: Boolean(isControl),
            control_order: isControl ? controlOrder : null,
            locked: isControl ? locked : false
          })
          .eq('id', editPointId)

        if (updateError) {
          setError(`Failed to update point: ${updateError.message}`)
          setLoading(false)
          return
        }
      } else {
        const { error: insertError } = await client
          .from('survey_points')
          .insert({
            project_id: projectId,
            name: name.trim(),
            easting: Number(parseFloat(easting).toFixed(4)),
            northing: Number(parseFloat(northing).toFixed(4)),
            elevation: Number(parseFloat(elevation || '0').toFixed(4)),
            is_control: Boolean(isControl),
            control_order: isControl ? controlOrder : null,
            locked: isControl ? locked : false
          })

        if (insertError) {
          if (insertError.code === '23505') {
            setError(`Point "${name}" already exists in this project. Use a different name.`)
          } else {
            setError(`Failed to add point: ${insertError.message}`)
          }
          setLoading(false)
          return
        }
      }

      // Success
      setLoading(false)
      onPointAdded()
      onClose()

    } catch (err) {
      setError('Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  const handleSaveAndAddAnother = async () => {
    if (isEditMode) return // Only for new points
    
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const client = createClient()

      const { error: insertError } = await client
        .from('survey_points')
        .insert({
          project_id: projectId,
          name: name.trim(),
          easting: Number(parseFloat(easting).toFixed(4)),
          northing: Number(parseFloat(northing).toFixed(4)),
          elevation: Number(parseFloat(elevation || '0').toFixed(4)),
          is_control: Boolean(isControl)
        })

      if (insertError) {
        if (insertError.code === '23505') {
          setError(`Point "${name}" already exists in this project.`)
        } else {
          setError(`Failed to add point: ${insertError.message}`)
        }
        setLoading(false)
        return
      }

      // Success - clear fields but keep checkbox state
      setLoading(false)
      setSuccessMsg(`✓ ${name} saved`)
      setName('')
      setEasting('')
      setNorthing('')
      setElevation('0')
      onPointAdded()
      
      // Clear success message after 2 seconds
      setTimeout(() => setSuccessMsg(null), 2000)

    } catch (err) {
      setError('Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
          {isEditMode ? 'Edit Survey Point' : 'Add Survey Point'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm p-2 bg-red-900/20 rounded border border-red-800">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-1">Point Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-mono"
              placeholder="e.g., TP01, BM1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-1">Easting (m) *</label>
              <input
                type="number"
                step="0.0001"
                value={easting}
                onChange={(e) => setEasting(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-1">Northing (m) *</label>
              <input
                type="number"
                step="0.0001"
                value={northing}
                onChange={(e) => setNorthing(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-mono"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-1">Elevation (m)</label>
            <input
              type="number"
              step="0.001"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isControl"
              checked={isControl}
              onChange={(e) => setIsControl(e.target.checked)}
              className="w-4 h-4 rounded bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--accent)] focus:ring-[#E8841A]"
            />
            <label htmlFor="isControl" className="text-sm text-[var(--text-primary)]">
              This is a control point
            </label>
          </div>

          {isControl && (
            <div className="pl-6 space-y-3 border-l-2 border-[var(--border-color)]">
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-1">Control Classification</label>
                <select
                  value={controlOrder}
                  onChange={(e) => setControlOrder(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                >
                  <option value="primary">Primary Control</option>
                  <option value="secondary">Secondary Control</option>
                  <option value="temporary">Temporary Control</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="locked"
                  checked={locked}
                  onChange={(e) => setLocked(e.target.checked)}
                  className="w-4 h-4 rounded bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--accent)] focus:ring-[#E8841A]"
                />
                <label htmlFor="locked" className="text-sm text-[var(--text-primary)]">
                  🔒 Lock this point (prevent edit/delete)
                </label>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="text-green-400 text-sm p-2 bg-green-900/20 rounded border border-green-800">
              {successMsg}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors"
            >
              Cancel
            </button>
            {!isEditMode && (
              <button
                type="button"
                onClick={handleSaveAndAddAnother}
                disabled={loading || !name || !easting || !northing}
                className="px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors disabled:opacity-50"
              >
                Save & Add Another
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded transition-colors disabled:opacity-50"
            >
              {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Point')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
