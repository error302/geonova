'use client';

import { useState, useRef, useCallback } from 'react'
import {
  Upload, X, FileSpreadsheet, AlertCircle, CheckCircle2,
  Loader2, Info
} from 'lucide-react'

interface ImportResult {
  total_rows: number
  created: number
  skipped: number
  errors: string[]
}

export default function CsvImportPanel({ projectId, blockId, blockName, onImportComplete }: {
  projectId: number | string
  blockId: number | string
  blockName: string
  onImportComplete?: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')

  const doImport = async (file: File) => {
    setLoading(true)
    setError('')
    setResult(null)
    setFileName(file.name)

    const formData = new FormData()
    formData.append('project_id', String(projectId))
    formData.append('block_id', String(blockId))
    formData.append('file', file)

    try {
      const res = await fetch('/api/scheme/import', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json() as { error?: string; data?: ImportResult | null }
      if (!res.ok) throw new Error(json.error || 'Import failed')

      setResult(json.data ?? null)
      if ((json.data?.created ?? 0) > 0 && onImportComplete) {
        onImportComplete()
      }
    } catch (err: unknown) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) doImport(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) doImport(file)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  // Sample CSV data for download
  const downloadSample = () => {
    const csv = `parcel_number,lr_number_proposed,area_ha,notes
1,MN/III/1001,0.0625,Northwest corner
2,MN/III/1002,0.1250,Central portion
3,MN/III/1003,0.0875,East boundary
4,MN/III/1004,0.1500,South section
5,MN/III/1005,0.1000,Road reserve
6,MN/III/1006,0.0750,Adjoining river
7,MN/III/1007,0.0500,Corner plot
8,MN/III/1008,0.2000,Large subdivision
9,MN/III/1009,0.1100,Commercial zone
10,MN/III/1010,0.0800,Public utility`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sample_parcels_${blockName}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[var(--bg-card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)]">
        <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-blue-400" />
          Bulk Import Parcels
        </span>
        <button
          onClick={downloadSample}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors flex items-center gap-1"
        >
          <Info className="w-3 h-3" />
          Download Sample CSV
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border-color)] hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
              <p className="text-sm text-[var(--text-secondary)]">Importing {fileName}...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                Drop CSV here or <span className="text-[var(--accent)] underline">browse</span>
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                Required columns: parcel_number | Optional: lr_number_proposed, area_ha, notes
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-2.5 bg-red-900/20 border border-red-500/30 rounded-lg text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-2">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Import complete
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-emerald-300 font-bold">{result.created}</span>
                  <span className="text-[var(--text-muted)]"> created</span>
                </div>
                <div>
                  <span className="text-yellow-300 font-bold">{result.skipped}</span>
                  <span className="text-[var(--text-muted)]"> skipped/updated</span>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">{result.total_rows}</span>
                  <span className="text-[var(--text-muted)]"> total rows</span>
                </div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-[10px] font-medium text-yellow-400 mb-1">
                  {result.errors.length} warning(s):
                </p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {result.errors.map((e, i) => (
                    <p key={`${e}-${i}`} className="text-[10px] text-yellow-300/80">{e}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
