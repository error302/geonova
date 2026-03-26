// src/app/minetwin/page.tsx

'use client'

import { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import Papa from 'papaparse'
import MineViewer3D from '@/components/minetwin/MineViewer3D'
import VolumePanel from '@/components/minetwin/VolumePanel'
import ConvergencePanel from '@/components/minetwin/ConvergencePanel'
import { processMineTwin } from '@/lib/compute/mineTwin'
import type { SurveyPoint3D, ProcessTwinResponse } from '@/types/minetwin'

export default function MineTwinPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ProcessTwinResponse | null>(null)
  const projectId = 'default-project'
  
  const handleUpload = async (file: File) => {
    const text = await file.text()
    let points: SurveyPoint3D[]
    
    if (file.name.endsWith('.json')) {
      points = JSON.parse(text)
    } else {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
      points = parsed.data.map((row: any, i: number) => ({
        id: row.id || row.code || String(i),
        easting: parseFloat(row.easting || row.X || 0),
        northing: parseFloat(row.northing || row.Y || 0),
        elevation: parseFloat(row.elevation || row.RL || row.Z || 0),
        code: row.code || ''
      })).filter((p: any) => !isNaN(p.easting) && !isNaN(p.northing))
    }
    
    setLoading(true)
    try {
      const res = await processMineTwin(projectId, points)
      setResult(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">MineTwin 3D</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Upload Survey Data</h2>
        
        <label className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 w-fit">
          <Upload className="h-5 w-5" />
          Upload Points
          <input
            type="file"
            accept=".csv,.json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            disabled={loading}
          />
        </label>
        
        {loading && (
          <div className="mt-4 flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Processing 3D model...</span>
          </div>
        )}
      </div>
      
      {result && (
        <div className="space-y-6">
          <MineViewer3D mesh={result.mesh} riskZones={result.risk_zones} />
          
          {result.volumes && <VolumePanel volumes={result.volumes} />}
          
          {result.convergence && result.convergence.length > 0 && (
            <ConvergencePanel convergence={result.convergence} />
          )}
        </div>
      )}
    </div>
  )
}
