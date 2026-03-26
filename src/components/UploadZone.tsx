'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'

interface UploadZoneProps {
  onUploadComplete?: (result: UploadResult) => void
  accept?: string
  maxSize?: number
}

interface UploadResult {
  success: boolean
  type: string
  confidence: number
  hasBuilding: boolean
  hasBoq: boolean
  errors: string[]
  warnings: string[]
  building?: {
    floors: number
    walls: number
    rooms: number
    doors: number
    windows: number
  }
  boq?: {
    items: number
    total: number
  }
}

export default function UploadZone({ 
  onUploadComplete,
  accept = '.dxf,.dwg,.ifc,.pdf,.jpg,.jpeg,.png,.webp,.glb,.gltf,.obj,.xlsx,.xls,.csv',
  maxSize = 100 * 1024 * 1024
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (file.size > maxSize) {
      setError(`File too large. Max size is ${maxSize / 1024 / 1024}MB`)
      return
    }

    setUploading(true)
    setError(null)
    setResult(null)
    setProgress('Reading file...')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('enhanceWithAI', 'true')

      setProgress('Parsing...')
      
      const response = await fetch('/api/parsers/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setResult(data)
      onUploadComplete?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress('')
    }
  }, [maxSize, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    const colors: Record<string, string> = {
      dxf: 'text-blue-400',
      dwg: 'text-blue-500',
      ifc: 'text-purple-400',
      pdf: 'text-red-400',
      jpg: 'text-green-400',
      jpeg: 'text-green-400',
      png: 'text-green-400',
      webp: 'text-green-400',
      glb: 'text-amber-400',
      gltf: 'text-amber-400',
      obj: 'text-amber-500',
      xlsx: 'text-emerald-400',
      xls: 'text-emerald-500',
      csv: 'text-emerald-600',
    }
    return colors[ext || ''] || 'text-gray-400'
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragging 
            ? 'border-[var(--accent)] bg-[var(--accent)]/10' 
            : 'border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--bg-secondary)]/50'}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
              <p className="text-sm text-[var(--text-secondary)]">{progress || 'Processing...'}</p>
            </>
          ) : (
            <>
              <Upload className={`w-10 h-10 ${isDragging ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`} />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Drop file here or click to upload
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  DXF, DWG, IFC, PDF, Images, 3D Models, BOQ (max 100MB)
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-700/40">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-400" />
            )}
            <span className="font-medium text-[var(--text-primary)]">
              {result.success ? 'Parse Complete' : 'Parse with Issues'}
            </span>
            <span className="ml-auto text-sm text-[var(--text-muted)]">
              {result.type}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
              <div className="text-[var(--text-muted)] text-xs">Confidence</div>
              <div className="font-medium text-[var(--text-primary)]">
                {Math.round(result.confidence * 100)}%
              </div>
            </div>
            {result.building && (
              <>
                <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
                  <div className="text-[var(--text-muted)] text-xs">Walls</div>
                  <div className="font-medium text-[var(--text-primary)]">{result.building.walls}</div>
                </div>
                <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
                  <div className="text-[var(--text-muted)] text-xs">Rooms</div>
                  <div className="font-medium text-[var(--text-primary)]">{result.building.rooms}</div>
                </div>
                <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
                  <div className="text-[var(--text-muted)] text-xs">Floors</div>
                  <div className="font-medium text-[var(--text-primary)]">{result.building.floors}</div>
                </div>
              </>
            )}
            {result.boq && (
              <>
                <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
                  <div className="text-[var(--text-muted)] text-xs">BOQ Items</div>
                  <div className="font-medium text-[var(--text-primary)]">{result.boq.items}</div>
                </div>
                <div className="bg-[var(--bg-tertiary)]/50 rounded p-2">
                  <div className="text-[var(--text-muted)] text-xs">Total</div>
                  <div className="font-medium text-[var(--text-primary)]">{result.boq.total.toLocaleString()}</div>
                </div>
              </>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="text-xs text-[var(--text-muted)]">
              <span className="font-medium">Warnings:</span> {result.warnings.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}