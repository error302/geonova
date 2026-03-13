'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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
  const supabase = createClient()

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
      setParsedPoints(result.points.map(p => ({
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation || 0
      })))
      setWarnings([...result.warnings, ...validationWarnings])
      setStep('preview')
    } catch (err) {
      setError('Failed to parse file')
    }
    
    setLoading(false)
  }

  const handleImport = async () => {
    setStep('importing')
    setLoading(true)

    try {
      const pointsToInsert = parsedPoints.map(p => ({
        project_id: projectId,
        name: p.name,
        easting: p.easting,
        northing: p.northing,
        elevation: p.elevation,
        is_control: false
      }))

      const { error } = await supabase.from('points').insert(pointsToInsert)

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      onUploadComplete()
      handleClose()
    } catch (err) {
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
      <div className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-xl font-bold text-gray-100 mb-4">Upload CSV</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Upload a CSV file with columns: Point Name, Easting, Northing, Elevation (optional)
            </p>
            <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
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
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors"
              >
                {loading ? 'Parsing...' : 'Choose File'}
              </label>
              <p className="text-gray-500 text-sm mt-2">or drag and drop</p>
            </div>
            <div className="text-xs text-gray-500">
              <p className="font-semibold text-gray-400 mb-1">Expected format:</p>
              <code className="block bg-gray-800 p-2 rounded">
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
              <p className="text-gray-300">
                Found <span className="text-[#E8841A] font-bold">{parsedPoints.length}</span> points
              </p>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-200"
              >
                ×
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded p-3 max-h-24 overflow-y-auto">
                <p className="text-yellow-400 text-sm font-semibold mb-1">Warnings:</p>
                {warnings.slice(0, 5).map((w, i) => (
                  <p key={i} className="text-yellow-300 text-xs">{w}</p>
                ))}
                {warnings.length > 5 && (
                  <p className="text-yellow-300 text-xs">...and {warnings.length - 5} more</p>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto border border-gray-700 rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-300 font-semibold">Point</th>
                    <th className="px-3 py-2 text-left text-gray-300 font-semibold">Easting</th>
                    <th className="px-3 py-2 text-left text-gray-300 font-semibold">Northing</th>
                    <th className="px-3 py-2 text-left text-gray-300 font-semibold">Elevation</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPoints.slice(0, 50).map((point, idx) => (
                    <tr key={idx} className="border-t border-gray-700">
                      <td className="px-3 py-2 font-mono text-gray-100">{point.name}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{point.easting.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{point.northing.toFixed(4)}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{point.elevation.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedPoints.length > 50 && (
                <p className="text-center text-gray-500 py-2 text-sm">
                  ...and {parsedPoints.length - 50} more points
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors disabled:opacity-50"
              >
                Import {parsedPoints.length} Points
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#E8841A] border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-300">Importing points...</p>
          </div>
        )}
      </div>
    </div>
  )
}
