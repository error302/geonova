'use client';

import { useState, useRef, useEffect } from 'react'
import type { SurveyPlanData, PlanOptions } from '@/lib/reports/surveyPlan/types'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'
import { FormNo4Renderer } from '@/lib/reports/surveyPlan/formNo4Renderer'
import { SurveyPlanDataSchema } from '@/lib/validation/surveySchema'
import ComplianceChecklistModal from '@/components/ComplianceChecklistModal'
import { AlertCircle, FileCheck } from 'lucide-react'
import { sanitizeHtml } from '@/lib/security/sanitize'
import { logger } from '@/lib/logger'

interface SurveyPlanViewerProps {
  data: SurveyPlanData
  options?: PlanOptions
  className?: string
  submissionNumber?: string // For Form No. 4
}

const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 4.0]

export default function SurveyPlanViewer({ data, options, className = '', submissionNumber }: SurveyPlanViewerProps) {
  const [scale, setScale] = useState(1.0)
  const [currentSheet, setCurrentSheet] = useState(0)
  const [svgContent, setSvgContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCompliance, setShowCompliance] = useState(false)
  const [useFormNo4, setUseFormNo4] = useState(true) // Default to Form No. 4 for Kenya
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<SurveyPlanRenderer | FormNo4Renderer | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    try {
      // Quality Hardening: Validate data before rendering
      const validation = SurveyPlanDataSchema.safeParse(data)
      if (!validation.success) {
        logger.error('Survey plan data validation failed:', { error: validation.error })
        setError(validation.error.errors[0].message)
        return
      }

      let renderer: SurveyPlanRenderer | FormNo4Renderer
      let content: string

      // Choose renderer based on toggle and data availability
      const hasFormNo4Data = data.project.folioNumber || data.project.registerNumber || data.project.lrNumber
      
      if (useFormNo4 && hasFormNo4Data) {
        // Use Kenya Form No. 4 standard
        renderer = new FormNo4Renderer(data, { ...options, submissionNumber })
        content = (renderer as FormNo4Renderer).renderFormNo4()
      } else {
        // Use standard renderer
        renderer = new SurveyPlanRenderer(data, options)
        content = renderer.render()
      }
      
      rendererRef.current = renderer
      setSvgContent(content)
    } catch (e) {
      logger.error('Survey plan render error:', { error: e })
      setError(e instanceof Error ? e.message : 'Unknown rendering error')
      setSvgContent('')
    } finally {
      setLoading(false)
    }
  }, [data, options, useFormNo4, submissionNumber])

  const zoomIn = () => {
    const idx = ZOOM_LEVELS.findIndex(z => z > scale)
    if (idx !== -1) setScale(ZOOM_LEVELS[idx])
  }
  const zoomOut = () => {
    const idx = ZOOM_LEVELS.findLastIndex(z => z < scale)
    if (idx !== -1) setScale(ZOOM_LEVELS[idx])
  }
  const fitToWidth = () => setScale(1.0)

  const handleDownloadCSV = () => {
    if (!rendererRef.current) return
    const csv = rendererRef.current.exportToCSV()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(data.project.name || 'survey-plan').replace(/\s+/g, '_')}-bearing-schedule.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDownloadSVG = () => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const suffix = useFormNo4 ? '_FormNo4' : '_Plan'
    link.download = `${data.project.name.replace(/\s+/g, '_')}${suffix}.svg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => window.print()

  // Check if Form No. 4 data is available
  const hasFormNo4Data = data.project.folioNumber || data.project.registerNumber || data.project.lrNumber

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-secondary)] no-print">
        <button onClick={zoomOut} disabled={scale <= ZOOM_LEVELS[0]}
          className="px-2 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">−</button>
        <span className="text-xs font-mono min-w-[48px] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} disabled={scale >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}
          className="px-2 py-1 text-sm rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">+</button>
        <button onClick={fitToWidth}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--bg-tertiary)] border border-[var(--border)]">Fit</button>
        
        <div className="w-px h-6 bg-[var(--border)] mx-2" />
        
        {/* Form No. 4 Toggle */}
        {hasFormNo4Data && (
          <button
            onClick={() => setUseFormNo4(!useFormNo4)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
              useFormNo4 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
            }`}
            title={useFormNo4 ? 'Using Kenya Form No. 4 standard' : 'Using standard plan format'}
          >
            <FileCheck className="w-3.5 h-3.5" />
            {useFormNo4 ? 'Form No. 4 (Kenya)' : 'Standard Plan'}
          </button>
        )}
        
        <div className="flex-1" />
        
        {svgContent && (
          <button onClick={handleDownloadSVG}
            className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-medium hover:opacity-80">
            Download SVG
          </button>
        )}
        <button onClick={handlePrint}
          className="px-3 py-1 text-xs rounded bg-gray-600 text-white hover:opacity-80">
          Print
        </button>
        <button onClick={handleDownloadCSV}
          className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:opacity-80">
          Download CSV
        </button>
        <button onClick={() => setShowCompliance(true)}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] text-black font-semibold hover:opacity-80">
          Export Plan
        </button>
      </div>
      
      {/* Info banner for Form No. 4 */}
      {useFormNo4 && hasFormNo4Data && (
        <div className="px-3 py-1.5 bg-green-50 border-b border-green-200 flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-700">
            Kenya Form No. 4 Survey Plan — Compliant with Survey Act Cap. 299 and Survey Regulations 1994
          </span>
          {submissionNumber && (
            <span className="ml-auto text-xs font-mono text-green-600">
              Submission: {submissionNumber}
            </span>
          )}
        </div>
      )}
      
      {svgContent && svgContent.includes('Sheet ') && (
        (() => {
          const match = svgContent.match(/Sheet \d+ of (\d+)/)
          const total = match ? parseInt(match[1], 10) : 1
          return (
            <div className="flex items-center justify-center gap-2 px-3 py-1 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
              <span className="text-xs font-mono text-[var(--text-secondary)]">Sheet {currentSheet + 1} of {total}</span>
              <button onClick={() => setCurrentSheet(Math.max(0, currentSheet - 1))} disabled={currentSheet === 0}
                className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30 border border-[var(--border)]">&lt;</button>
              <button onClick={() => setCurrentSheet(Math.min(total - 1, currentSheet + 1))} disabled={currentSheet >= total - 1}
                className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30 border border-[var(--border)]">&gt;</button>
            </div>
          )
        })()
      )}
      
      <div ref={containerRef} className="flex-1 overflow-auto bg-[#e8e8e8] p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)] gap-3">
            <div role="status" aria-label="Loading" className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <div className="font-mono text-xs uppercase tracking-widest">
              {useFormNo4 ? 'Generating Form No. 4 plan...' : 'Generating plan...'}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center gap-4">
            <div className="p-4 rounded-full bg-red-500/10 text-red-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-500 uppercase tracking-tight">Render Failed</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
            </div>
            <button
              onClick={() => {
                setUseFormNo4(false)
                setError(null)
              }}
              className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-xs font-semibold hover:bg-[var(--bg-tertiary)]"
            >
              Try Standard Format
            </button>
          </div>
        ) : svgContent ? (
          svgContent.includes('Sheet ') ? (
            <div
              className="shadow-lg mx-auto"
              style={{
                width: '1587px',
                height: '1123px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  transform: `translate(${-currentSheet * 1587 * scale}px, 0) scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(svgContent) }}
              />
            </div>
          ) : (
            <div className="shadow-lg mx-auto" style={{ transform: `scale(${scale})`, transformOrigin: 'top center', width: 'fit-content' }}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(svgContent) }} />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">No plan data available</div>
        )}
      </div>

      <ComplianceChecklistModal
        isOpen={showCompliance}
        onClose={() => setShowCompliance(false)}
        data={data}
        onExport={handlePrint}
      />
    </div>
  )
}
