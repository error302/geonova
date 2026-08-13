'use client';

import { useState, useRef } from 'react'
import { createClient } from '@/lib/api-client/client'
import { parseDelimitedFile, validatePoints } from '@/lib/engine/parser'

interface CSVUploadModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onUploadComplete: () => void
}

interface ParsedPoint {
  name: string
  easting: number
  northing: number
  elevation: number
}

export default function CSVUploadModal({
  isOpen,
  onClose,
  projectId,
  onUploadComplete
}: CSVUploadModalProps) {
  const [parsedPoints, setParsedPoints] = useState<ParsedPoint[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dbClient = createClient()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setLoading(true)

    try {
      const content = await file.text()
      const result = parseDelimitedFile(content, ',')
      
      if (result.points.length === 0) {
        setError('No valid points found in file')
        setLoading(false)
        return
      }

      const validationWarnings = validatePoints(result.points)
      setParsedPoints(result.points.map((p) => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation || 0
      })))
      setWarnings([...result.warnings, ...validationWarnings])
      setStep('preview')
    } catch (err) {
      // AUDIT FIX (M15, 2026-07-02): Actionable error message.
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Could not parse the file. ${msg}. Check that the file is a valid CSV with columns: name, easting, northing, elevation (or N, E, Z). If the file uses a different delimiter (tab, semicolon), try converting to comma-separated first.`)
    }

    setLoading(false)
  }

  const handleImport = async () => {
    setStep('importing')
    setLoading(true)

    try {
      const pointsToInsert = parsedPoints.map((p) => ({
        project_id: projectId,
        point_name: p.name,  // T1.5d FIX: was 'name' (column doesn't exist)
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
        is_control: false
      }))

      const { error } = await dbClient.from('survey_points').insert(pointsToInsert)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      onUploadComplete()
      handleClose()
    } catch {
      setError('Failed to import points')
    }

    setLoading(false)
  }

  const handleClose = () => {
    setParsedPoints([])
    setWarnings([])
    setError('')
    setStep('upload')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={handleClose}></div>
      <div className="relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Upload CSV</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-[var(--text-secondary)] text-sm">
              Upload a CSV file with columns: Point Name, Easting, Northing, Elevation (optional)
            </p>
            <div className="border-2 border-dashed border-[var(--border-color)] rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded transition-colors"
              >
                {loading ? 'Parsing...' : 'Choose File'}
              </label>
              <p className="text-[var(--text-muted)] text-sm mt-2">or drag and drop</p>
            </div>
            <div className="text-xs text-[var(--text-muted)]">
              <p className="font-semibold text-[var(--text-secondary)] mb-1">Expected format:</p>
              <code className="block bg-[var(--bg-tertiary)] p-2 rounded">
                POINT,EASTING,NORTHING,ELEVATION<br />
                TP01,123456.7890,9876543.210,100.5<br />
                TP02,123478.9012,9876565.432,101.2
              </code>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-[var(--text-primary)]">
                Found <span className="text-[var(--accent)] font-bold">{parsedPoints.length}</span> points
              </p>
              <button
                onClick={handleClose}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 max-h-24 overflow-y-auto">
                <p className="text-yellow-400 text-sm font-semibold mb-1">Warnings:</p>
                {warnings.slice(0, 5).map((w, i) => (
                  <p key={`${w}-${i}`} className="text-yellow-300 text-xs">{w}</p>
                ))}
                {warnings.length > 5 && (
                  <p className="text-yellow-300 text-xs">...and {warnings.length - 5} more</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto border border-[var(--border-color)] rounded">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-tertiary)] sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-[var(--text-primary)] font-semibold">Point</th>
                    <th className="px-3 py-2 text-left text-[var(--text-primary)] font-semibold">Easting</th>
                    <th className="px-3 py-2 text-left text-[var(--text-primary)] font-semibold">Northing</th>
                    <th className="px-3 py-2 text-left text-[var(--text-primary)] font-semibold">Elevation</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPoints.slice(0, 50).map((point) => (
                    <tr key={point.name} className="border-t border-[var(--border-color)]">
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{point.name}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{point.easting.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{point.northing.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-[var(--text-primary)]">{point.elevation.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedPoints.length > 50 && (
                <p className="text-center text-[var(--text-muted)] py-2 text-sm">
                  ...and {parsedPoints.length - 50} more points
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded transition-colors disabled:opacity-50"
              >
                Import {parsedPoints.length} Points
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-[var(--text-primary)]">Importing points...</p>
          </div>
        )}
      </div>
    </div>
  )
}
