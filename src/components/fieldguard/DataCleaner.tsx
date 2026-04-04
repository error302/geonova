'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, Loader2, AlertTriangle } from 'lucide-react'
import Papa from 'papaparse'
import { cleanSurveyData } from '@/lib/compute/dataCleaner'
import AnomalyHeatmap from './AnomalyHeatmap'
import CleanedExport from './CleanedExport'
import type { RawSurveyPoint, CleanDataResponse } from '@/types/fieldguard'

export default function DataCleaner({ projectId }: { projectId: string }) {
  const [rawPoints, setRawPoints] = useState<RawSurveyPoint[]>([])
  const [cleanedData, setCleanedData] = useState<CleanDataResponse | null>(null)
  const [dataType, setDataType] = useState<'gnss' | 'totalstation' | 'lidar'>('gnss')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleFileUpload = useCallback(async (file: File) => {
    if (file.name.endsWith('.csv')) {
      const text = await file.text()
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      const points: RawSurveyPoint[] = parsed.data.map((row: any, idx: number) => ({
        id: row.id || row.code || String(idx),
        easting: parseFloat(row.easting || row.Easting || row.X || 0),
        northing: parseFloat(row.northing || row.Northing || row.Y || 0),
        elevation: parseFloat(row.elevation || row.RL || row.Z),
        code: row.code || row.Code || ''
      })).filter((p: any) => !isNaN(p.easting) && !isNaN(p.northing))
      setRawPoints(points)
    } else if (file.name.endsWith('.json')) {
      const text = await file.text()
      setRawPoints(JSON.parse(text))
    }
  }, [])
  
  const handleClean = async () => {
    if (rawPoints.length === 0) return
    setLoading(true)
    setError(null)
    
    try {
      const result = await cleanSurveyData(rawPoints, dataType)
      setCleanedData(result)
    } catch (err: any) {
      setError(err.message || 'Failed to clean data')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">FieldGuard AI - Data Cleaner</h2>
        
        <div className="flex gap-4 mb-4">
          <select
            value={dataType}
            onChange={(e) => setDataType(e.target.value as any)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700"
          >
            <option value="gnss">GNSS/GPS Points</option>
            <option value="totalstation">Total Station</option>
            <option value="lidar">LiDAR Point Cloud</option>
          </select>
          
          <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">
            <Upload className="h-4 w-4" />
            Upload File
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
        </div>
        
        {rawPoints.length > 0 && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-green-700 dark:text-green-400">
              Loaded {rawPoints.length} points
            </p>
          </div>
        )}
        
        <button
          onClick={handleClean}
          disabled={rawPoints.length === 0 || loading}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {loading ? 'Cleaning...' : 'Clean Data'}
        </button>
        
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
      
      {cleanedData && (
        <>
          <AnomalyHeatmap points={cleanedData.cleaned_points} anomalies={cleanedData.anomalies} />
          <CleanedExport cleanedData={cleanedData} projectId={projectId} />
        </>
      )}
    </div>
  )
}