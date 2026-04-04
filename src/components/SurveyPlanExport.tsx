'use client'

import { useState } from 'react'
import type { SurveyPlanData, PlanOptions } from '@/lib/reports/surveyPlan/types'
import { SurveyPlanRenderer } from '@/lib/reports/surveyPlan/renderer'
import QRCode from 'qrcode'
import type { PlanId } from '@/lib/subscription/catalog'

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

      const [{ default: Svg2Pdf }, { jsPDF }] = await Promise.all([
        import('svg2pdf.js'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' }) as any
      await (pdf as any).addSvg(svgEl, 0, 0, { width: 420, height: 297 })

      const date = new Date().toISOString().slice(0, 10)
      const filename = `${data.project.name.replace(/\s+/g, '_')}_Survey_Plan_${date}.pdf`
      pdf.save(filename)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('Failed to export PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleSignAndExport = async () => {
    if (!projectId) { alert('Project ID missing'); return }
    setSigning(true)
    try {
      let svgString = buildSvgString()
      
      // Hash SVG
      const encoder = new TextEncoder()
      const dataBuf = encoder.encode(svgString)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuf)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hashHex = hashArray.map((b: any) => b.toString(16).padStart(2, '0')).join('')

      // Create signature record
      const res = await fetch('/api/sign-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, hash: hashHex })
      })
      const sigData = await res.json()
      if (!res.ok) throw new Error(sigData.error || 'Failed to sign plan')

      const verifyUrl = `https://metardu.com/verify/${sigData.id}`
      const qrSvg = await QRCode.toString(verifyUrl, { type: 'svg', margin: 0, color: { dark: '#000000', light: '#ffffff' } })

      // Inject QR code and Digital Signature block into SVG
      const qrBlock = `
        <g transform="translate(1005, 785)">
          <rect x="0" y="0" width="160" height="40" fill="white" stroke="black" stroke-width="0.5"/>
          <text x="5" y="10" font-family="Share Tech Mono, Courier New" font-size="6" font-weight="bold" fill="black">DIGITAL SIGNATURE</text>
          <text x="5" y="18" font-family="Share Tech Mono, Courier New" font-size="5" fill="#333">Signed by: ${sigData.signerName}</text>
          <text x="5" y="24" font-family="Share Tech Mono, Courier New" font-size="5" fill="#333">LS: LS/${sigData.iskNumber}</text>
          <text x="5" y="30" font-family="Share Tech Mono, Courier New" font-size="5" fill="#333">Date: ${new Date(sigData.signedAt).toLocaleDateString()}</text>
          <text x="5" y="36" font-family="Share Tech Mono, Courier New" font-size="4" fill="#666">Verify: ${verifyUrl.replace('https://', '')}</text>
          <g transform="translate(120, 2) scale(0.9)">
            ${qrSvg.replace(/<\/?svg[^>]*>/g, '')}
          </g>
        </g>
      `
      
      svgString = svgString.replace('</svg>', qrBlock + '</svg>')

      const container = document.createElement('div')
      container.innerHTML = svgString
      const svgEl = container.querySelector('svg')
      if (!svgEl) throw new Error('SVG element not found')

      const [{ default: Svg2Pdf }, { jsPDF }] = await Promise.all([
        import('svg2pdf.js'),
        import('jspdf'),
      ])

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' }) as any
      await (pdf as any).addSvg(svgEl, 0, 0, { width: 420, height: 297 })

      const date = new Date().toISOString().slice(0, 10)
      const filename = `${data.project.name.replace(/\s+/g, '_')}_Signed_Plan_${date}.pdf`
      pdf.save(filename)
    } catch (err: any) {
      console.error('Signing error:', err)
      alert(err.message || 'Failed to sign and export PDF. Please try again.')
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
