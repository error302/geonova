'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Upload, Loader2, X } from 'lucide-react'
import Papa from 'papaparse'

const BathymetryMap = dynamic(() => import('@/components/hydrolive/BathymetryMap'), { ssr: false })
const VolumeDelta = dynamic(() => import('@/components/hydrolive/VolumeDelta'), { ssr: false })
const HazardAlert = dynamic(() => import('@/components/hydrolive/HazardAlert'), { ssr: false })

import { processBathymetry } from '@/lib/compute/bathymetry'
import type { SoundingPoint, ProcessBathymetryResponse } from '@/types/bathymetry'

interface CSVRow {
  id?: string
  easting?: string
  X?: string
  northing?: string
  Y?: string
  depth?: string
  Z?: string
  Depth?: string
}

function isValidSoundingPoint(item: unknown): item is SoundingPoint {
  if (typeof item !== 'object' || item === null) return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj.id === 'string' &&
    typeof obj.easting === 'number' &&
    typeof obj.northing === 'number' &&
    typeof obj.depth === 'number'
  )
}

export default function HydroLivePage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProcessBathymetryResponse | null>(null)
  const [soundings, setSoundings] = useState<SoundingPoint[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const projectId = 'default-project'
  
  const reset = () => {
    setResult(null)
    setSoundings([])
    setError(null)
    setFileName(null)
  }
  
  const handleUpload = async (file: File) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 10MB.')
      return
    }

    setError(null)
    const text = await file.text()
    let parsedSoundings: SoundingPoint[]
    
    if (file.name.endsWith('.json')) {
      try {
        const json = JSON.parse(text)
        if (!Array.isArray(json)) {
          setError('JSON must be an array of sounding points')
          return
        }
        parsedSoundings = json.filter(isValidSoundingPoint)
      } catch {
        setError('Invalid JSON file')
        return
      }
    } else {
      const parsed = Papa.parse<CSVRow>(text, { header: true, skipEmptyLines: true })
      if (parsed.errors.length > 0) {
        setError('Error parsing CSV file')
        return
      }
      parsedSoundings = parsed.data.map((row, i) => ({
        id: row.id || String(i),
        easting: parseFloat(row.easting || row.X || '0'),
        northing: parseFloat(row.northing || row.Y || '0'),
        depth: parseFloat(row.depth || row.Z || row.Depth || '0')
      })).filter((s) => !isNaN(s.depth) && s.depth > 0)
    }
    
    if (parsedSoundings.length === 0) {
      setError('No valid soundings found in file')
      return
    }
    
    setFileName(file.name)
    setSoundings(parsedSoundings)
    setLoading(true)
    try {
      const res = await processBathymetry(projectId, parsedSoundings, {
        contour_interval: 1.0,
        detect_hazards: true,
        compare_previous: true
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process bathymetry')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">HydroLive Mapper</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Soundings</h2>
        
        <div className="flex items-center gap-4 flex-wrap">
          <label className={`flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 w-fit ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Upload className="h-5 w-5" />
            Upload Depth Data
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              aria-label="Upload depth data file"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              disabled={loading}
            />
          </label>
          
          {fileName && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <span>Loaded: {fileName}</span>
              <button
                onClick={reset}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                aria-label="Clear uploaded data"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}
        
        {loading && (
          <div className="mt-4 flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing bathymetry...</span>
          </div>
        )}
      </div>
      
      {result && (
        <div className="space-y-6">
          <BathymetryMap soundings={soundings} />
          
          {result.volume_delta && <VolumeDelta volumeDelta={result.volume_delta} />}
          
          {result.hazards.length > 0 && (
            <div className="space-y-2">
              {result.hazards.map((hazard: any) => (
                <HazardAlert key={hazard.id} hazard={hazard} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
