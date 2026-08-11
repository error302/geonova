'use client';
/**
 * Shapefile Export Component
 * Downloads complete GIS package with .shp, .shx, .dbf, .prj files
 */


import { useState } from 'react'
import { generateShapefileZip } from '@/lib/export/shapefile'
import type { ShapefileData } from '@/types/submission'
import { logger } from '@/lib/logger'

interface ShapefileExportProps {
  data: ShapefileData
  projectName: string
  disabled?: boolean
}

export default function ShapefileExport({ data, projectName, disabled }: ShapefileExportProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)
      const blob = await generateShapefileZip(data)
      
      // Download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${projectName.replace(/\s+/g, '_')}_GIS_Package.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('Shapefile export failed:', { error: error })
      alert('Failed to generate shapefile. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={disabled || isExporting}
      className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black font-semibold rounded-lg text-sm hover:bg-[var(--accent-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isExporting ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Generating...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 01-.806-.999L21 6m0 13V7m-9 0h6"/>
          </svg>
          Export Shapefile (GIS)
        </>
      )}
    </button>
  )
}
