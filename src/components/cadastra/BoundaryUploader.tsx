'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import type { BoundaryPolygon } from '@/types/cadastra'

interface BoundaryUploaderProps {
  onUpload: (boundary: BoundaryPolygon) => void
  loading?: boolean
}

export default function BoundaryUploader({ onUpload, loading }: BoundaryUploaderProps) {
  const [mode, setMode] = useState<'csv' | 'json'>('csv')
  
  const handleFileUpload = async (file: File) => {
    const text = await file.text()
    let boundary: BoundaryPolygon
    
    if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
      const data = JSON.parse(text)
      boundary = data.features ? data.features[0].geometry : data
    } else {
      const lines = text.trim().split('\n')
      const points = lines.map((line: any) => {
        const [easting, northing] = line.split(',').map(Number)
        return { easting, northing }
      }).filter((p: any) => !isNaN(p.easting) && !isNaN(p.northing))
      boundary = { points }
    }
    
    onUpload(boundary)
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">CadastraAI Validator</h2>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setMode('csv')}
          className={`px-4 py-2 rounded-lg ${mode === 'csv' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          CSV Upload
        </button>
        <button
          onClick={() => setMode('json')}
          className={`px-4 py-2 rounded-lg ${mode === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          JSON/GeoJSON
        </button>
      </div>
      
      <label className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 w-fit">
        <Upload className="h-5 w-5" />
        Upload Boundary File
        <input
          type="file"
          accept={mode === 'csv' ? '.csv' : '.json,.geojson'}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
          disabled={loading}
        />
      </label>
      
      {loading && (
        <div className="mt-4 flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Validating boundary...</span>
        </div>
      )}
      
      <p className="mt-4 text-sm text-gray-500">
        CSV format: easting,northing (one point per line)
      </p>
    </div>
  )
}