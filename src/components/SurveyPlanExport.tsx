'use client';

import { useState } from 'react'
import type { SurveyPlanData, PlanOptions } from '@/lib/reports/surveyPlan/types'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'
import type { PlanId } from '@/lib/subscription/catalog'

type JsPdf = import('jspdf').jsPDF

interface JsPdfWithSvg extends JsPdf {
  addSvg(element: SVGElement, x: number, y: number, options: { width: number; height: number }): Promise<void>
}

interface SurveyPlanExportProps {
  data: SurveyPlanData
  options?: PlanOptions
  projectId?: string
  plan?: PlanId
}

export default function SurveyPlanExport({ data, options, projectId, plan = 'free' }: SurveyPlanExportProps) {
  const [exporting, setExporting] = useState(false)
  const [signing, setSigning] = useState(false)

  const buildSvgString = () => {
    const renderer = new SurveyPlanRenderer(data, { ...options, watermarkPlan: plan })
    return renderer.render()
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const svgString = buildSvgString()

      const container = document.createElement('div')
      container.innerHTML = svgString
      const svgEl = container.querySelector('svg')
      if (!svgEl) throw new Error('SVG element not found')

      const [, { jsPDF }] = await Promise.all([
        import('svg2pdf.js'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' }) as JsPdfWithSvg
      await pdf.addSvg(svgEl, 0, 0, { width: 420, height: 297 })

      const date = new Date().toISOString().slice(0, 10)
      const filename = `${data.project.name.replace(/\s+/g, '_')}_Survey_Plan_${date}.pdf`
      pdf.save(filename)
    } catch (err) {
      // AUDIT FIX (M15, 2026-07-02): Actionable error message.
      // eslint-disable-next-line no-console -- client error surface, no server logger here
      console.error('PDF export error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Could not export the survey plan as PDF. ${msg}. Common causes: the SVG element is not rendered yet (wait for the page to load), the browser blocked the download (check popup blocker settings), or the PDF library ran out of memory on very large plans. Try refreshing the page and exporting again.`)
    } finally {
      setExporting(false)
    }
  }

  const handleSignAndExport = async () => {
    if (!projectId) { alert('Project ID missing'); return }
    setSigning(true)
    try {
      const svgString = buildSvgString()
      
      // Hash SVG
      const encoder = new TextEncoder()
      const dataBuf = encoder.encode(svgString)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')

      // Create signature record
      const res = await fetch('/api/sign-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, hash: hashHex, verificationUrlBase: window.location.origin })
      })
      if (!res.ok) {
        const errData = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(errData?.error ?? 'Failed to sign plan')
      }

      // The route returns the signed PDF (signature block embedded server-side)
      // with the verification token in a header — download it directly.
      const blob = await res.blob()
      const date = new Date().toISOString().slice(0, 10)
      const filename = `${data.project.name.replace(/\s+/g, '_')}_Signed_Plan_${date}.pdf`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      // eslint-disable-next-line no-console -- client error surface, no server logger here
      console.error('Signing error:', err)
      alert((err as Error).message || 'Failed to sign and export PDF. Please try again.')
    } finally {
      setSigning(false)
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handleExport} disabled={exporting || signing}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50 transition-colors">
        {exporting ? (
          <><span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />Generating...</>
        ) : (
          <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Unsigned PDF</>
        )}
      </button>

      {projectId && (
        <button onClick={handleSignAndExport} disabled={exporting || signing}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-black rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-colors">
          {signing ? (
            <><span className="animate-spin inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full" />Signing...</>
          ) : (
            <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Sign This Plan</>
          )}
        </button>
      )}
    </div>
  )
}
