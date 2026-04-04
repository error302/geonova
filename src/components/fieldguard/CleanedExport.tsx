'use client'

import { useState } from 'react'
import { FileJson, FileSpreadsheet, FileText, Save, Loader2 } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CleanDataResponse } from '@/types/fieldguard'
import { createCleanedDataset } from '@/lib/supabase/cleanedDatasets'

interface CleanedExportProps {
  cleanedData: CleanDataResponse
  projectId: string
}

export default function CleanedExport({ cleanedData, projectId }: CleanedExportProps) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  const exportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: cleanedData.cleaned_points
        .filter((p: any) => p.cleaned)
        .map((p: any) => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.easting, p.northing, p.elevation]
          },
          properties: {
            code: p.code,
            classification: p.classification,
            confidence: p.confidence
          }
        }))
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cleaned_survey.geojson'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const exportCSV = () => {
    const rows = cleanedData.cleaned_points.map((p, i) => ({
      point_id: i,
      easting: p.easting,
      northing: p.northing,
      elevation: p.elevation || '',
      code: p.code || '',
      cleaned: p.cleaned,
      classification: p.classification || '',
      confidence: p.confidence
    }))
    const csv = ['point_id,easting,northing,elevation,code,cleaned,classification,confidence']
      .concat(rows.map((r: any) => Object.values(r).join(',')))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cleaned_survey.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const exportPDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text('FieldGuard AI - Data Cleaning Report', 14, 20)
    
    doc.setFontSize(11)
    doc.text(`Project: ${projectId}`, 14, 30)
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 36)
    
    doc.text('Summary', 14, 48)
    autoTable(doc, {
      startY: 52,
      head: [['Metric', 'Value']],
      body: [
        ['Total Points', String(cleanedData.summary.total_points)],
        ['Outliers Removed', String(cleanedData.summary.outliers_removed)],
        ['Duplicates Removed', String(cleanedData.summary.duplicates_removed || 0)],
        ['Classified Points', String(cleanedData.summary.classified_count)],
        ['Average Confidence', (cleanedData.summary.confidence_avg * 100).toFixed(1) + '%']
      ]
    })
    
    if (cleanedData.anomalies.length > 0) {
      const anomalyData = cleanedData.anomalies.map((a: any) => [
        a.point_id,
        a.type,
        a.severity,
        a.description
      ])
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [['Point ID', 'Type', 'Severity', 'Description']],
        body: anomalyData
      })
    }
    
    doc.save('fieldguard-report.pdf')
  }
  
  const handleSaveToDB = async () => {
    setSaving(true)
    try {
      await createCleanedDataset({
        project_id: projectId,
        user_id: 'current-user',
        raw_data: [],
        cleaned_data: cleanedData.cleaned_points,
        anomalies: cleanedData.anomalies,
        confidence_scores: cleanedData.confidence_scores,
        data_type: 'gnss'
      })
      setSaved(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Export Cleaned Data</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={exportGeoJSON}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <FileJson className="h-5 w-5" />
          GeoJSON
        </button>
        
        <button
          onClick={exportCSV}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <FileSpreadsheet className="h-5 w-5" />
          CSV
        </button>
        
        <button
          onClick={exportPDF}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          <FileText className="h-5 w-5" />
          PDF Report
        </button>
        
        <button
          onClick={handleSaveToDB}
          disabled={saving || saved}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to DB'}
        </button>
      </div>
    </div>
  )
}