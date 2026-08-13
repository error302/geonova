'use client';

import { useState, useEffect } from 'react'

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
  editPointUpdatedAt?: string
}

export default function AddPointModal({
  isOpen,
  onClose,
  projectId,
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
  editPointLocked,
  editPointUpdatedAt,
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

  useEffect(() => {
    // Reset form when modal opens/closes or edit point changes
    if (isEditMode && editPointName) {
      setName(editPointName)
      setEasting(editPointEasting?.toFixed(4) || '')
      setNorthing(editPointNorthing?.toFixed(4) || '')
      setElevation(editPointElevation?.toString() || '0')
      setIsControl(editPointIsControl || false)
      setControlOrder((editPointControlOrder as 'primary' | 'secondary' | 'temporary') || 'secondary')
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
      // T1.5g FIX (2026-07-10): Use the REST API instead of direct Supabase client.
      // Previously this bypassed the API layer (no auth, no audit, no optimistic locking).
      // Now uses POST /api/survey-points (create) and PATCH /api/survey-points/[id] (update).

      const pointData = {
        point_name: name.trim(),
        easting: Number(parseFloat(easting).toFixed(4)),
        northing: Number(parseFloat(northing).toFixed(4)),
        elevation: Number(parseFloat(elevation || '0').toFixed(4)),
        is_control: Boolean(isControl),
      }

      if (isEditMode) {
        // PATCH requires updated_at for optimistic locking.
        // T1.5i FIX (2026-07-10): If editPointUpdatedAt is not provided by the
        // caller, omit it from the request. The API will skip the optimistic
        // lock guard (treat it as an unconditional update). This prevents the
        // 409 Conflict that occurred when the fallback used new Date().toISOString().
        const patchBody: Record<string, unknown> = { ...pointData }
        if (editPointUpdatedAt) {
          patchBody.updated_at = editPointUpdatedAt
        }
        const res = await fetch(`/api/survey-points/${editPointId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
          throw new Error(err.error || `Failed to update point (${res.status})`)
        }
      } else {
        // POST to create
        const res = await fetch('/api/survey-points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: projectId,
            ...pointData,
          }),
        })
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
          if (res.status === 409 && err.error?.includes('already exists')) {
            throw new Error(`Point "${name}" already exists in this project. Use a different name.`)
          }
          throw new Error(err.error || `Failed to add point (${res.status})`)
        }
      }

      // Success
      setLoading(false)
      onPointAdded()
      onClose()

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  const handleSaveAndAddAnother = async () => {
    if (isEditMode) return // Only for new points

    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    try {
      const res = await fetch('/api/survey-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          point_name: name.trim(),
          easting: Number(parseFloat(easting).toFixed(4)),
          northing: Number(parseFloat(northing).toFixed(4)),
          elevation: Number(parseFloat(elevation || '0').toFixed(4)),
          is_control: Boolean(isControl),
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string }
        throw new Error(err.error || `Failed to add point (${res.status})`)
      }

      // Success - clear fields but keep checkbox state
      setLoading(false)
      setSuccessMsg(` ${name} saved`)
      setName('')
      setEasting('')
      setNorthing('')
      setElevation('0')
      onPointAdded()
      
      // Clear success message after 2 seconds
      setTimeout(() => setSuccessMsg(null), 2000)

    } catch {
      setError('Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
      <button type="button" aria-label="Close dialog" tabIndex={-1} className="absolute inset-0 bg-black/70 cursor-pointer border-0 p-0" onClick={onClose}></button>
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-md" role="dialog" aria-modal="true" aria-label={isEditMode ? 'Edit Survey Point' : 'Add Survey Point'}>
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
            <label className="block text-sm text-[var(--text-primary)] mb-1" htmlFor="point-name">Point Name *</label>
            <input
              id="point-name"
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
              <label className="block text-sm text-[var(--text-primary)] mb-1" htmlFor="point-easting">Easting (m) *</label>
              <input id="point-easting"
                type="number"
                step="0.0001"
                value={easting}
                onChange={(e) => setEasting(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-1" htmlFor="point-northing">Northing (m) *</label>
              <input id="point-northing"
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
            <label className="block text-sm text-[var(--text-primary)] mb-1" htmlFor="point-elevation">Elevation (m)</label>
            <input id="point-elevation"
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
              className="w-4 h-4 rounded bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--accent)] focus:ring-[#D17B47]"
            />
            <label htmlFor="isControl" className="text-sm text-[var(--text-primary)]">
              This is a control point
            </label>
          </div>

          {isControl && (
            <div className="pl-6 space-y-3 border-l-2 border-[var(--border-color)]">
              <div>
                <label className="block text-sm text-[var(--text-primary)] mb-1" htmlFor="control-classification">Control Classification</label>
                <select id="control-classification"
                  value={controlOrder}
                  onChange={(e) => setControlOrder(e.target.value as 'primary' | 'secondary' | 'temporary')}
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
                  className="w-4 h-4 rounded bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--accent)] focus:ring-[#D17B47]"
                />
                <label htmlFor="locked" className="text-sm text-[var(--text-primary)]">
                  [Lock] Lock this point (prevent edit/delete)
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
