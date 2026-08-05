'use client';

import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { generateCertificate, CERTIFICATION_ITEMS, generateDefectSchedule } from '@/lib/generators/roadCompletionCertificate'
import type { RoadCompletionData, DefectItem } from '@/lib/generators/roadCompletionCertificate'
// XSS guard (2026-08-03): certificate fields are user-entered and interpolated
// into the print-window HTML — escape before document.write().
import { escapeXml } from '@/lib/xml/escape'

interface RoadCompletionCertificatePanelProps {
  projectId?: string
  roadClass?: string
  surveyorName?: string
  surveyorRegistration?: string
  surveyorFirm?: string
}

const CERTIFICATION_FIELD_BY_KEY: Record<(typeof CERTIFICATION_ITEMS)[number]['key'], keyof RoadCompletionData> = {
  earthworks: 'earthworksCertified',
  pavement: 'pavementCertified',
  drainage: 'drainageCertified',
  signage: 'signageCertified',
  roadFurniture: 'roadFurnitureCertified',
}

export default function RoadCompletionCertificatePanel({
  roadClass = 'B', surveyorName = '', surveyorRegistration = '', surveyorFirm = '',
}: RoadCompletionCertificatePanelProps) {
  const [data, setData] = useState<RoadCompletionData>({
    projectName: '', roadName: '', roadClass, roadNumber: '',
    chainageStart: 0, chainageEnd: 1000, totalLength: 1000,
    county: '', subCounty: '',
    designSpeed: 80, carriagewayWidth: 7.0, shoulderWidth: 2.0, designStandard: 'KRDM2017',
    contractorName: '', clientName: 'KeNHA', completionDate: new Date().toISOString().split('T')[0],
    surveyorName, surveyorRegistration, surveyorFirm,
    asBuiltPassRate: 98.5, asBuiltTotalPoints: 150, asBuiltPassPoints: 148, maxDeviation: 18.2, rmsError: 8.4,
    pavementLayers: [],
    earthworksCertified: true, pavementCertified: true, drainageCertified: false,
    signageCertified: true, roadFurnitureCertified: false,
    defectsNoted: [], reservations: [],
  })
  const [certificate, setCertificate] = useState<ReturnType<typeof generateCertificate> | null>(null)
  const [defects, setDefects] = useState<DefectItem[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [surveyMethod, setSurveyMethod] = useState('RTK GNSS / Total Station')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const certificateRef = useRef<HTMLDivElement>(null)

  const update = (field: keyof RoadCompletionData, value: unknown) => setData({ ...data, [field]: value })

  // ─── FIX #2: Sync defects → data.defectsNoted via useEffect (not during render) ──
  useEffect(() => {
    if (defects.length > 0) {
      setData(prev => ({
        ...prev,
        defectsNoted: defects.map(d => `[${d.severity}] CH${d.chainage}: ${d.description}`),
      }))
    } else {
      setData(prev => ({ ...prev, defectsNoted: [] }))
    }
  }, [defects])

  // ─── FIX #4: Validation ────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: string[] = []
    if (!data.projectName.trim()) errors.push('Project Name is required')
    if (!data.roadName.trim()) errors.push('Road Name is required')
    if (!data.surveyorName.trim()) errors.push('Surveyor Name is required')
    setValidationErrors(errors)
    return errors.length === 0
  }

  // ─── FIX #6: Certificate number = Date.now() + random 4-digit suffix ──────────
  const generateCertificateNumber = (): string => {
    const suffix = Math.floor(1000 + Math.random() * 9000)
    return `RCC-${Date.now()}-${suffix}`
  }

  // ─── FIX #5: Survey method substitution ────────────────────────────────────────
  const substituteDeclaration = (declaration: string, method: string): string => {
    return declaration.replace('[instrument/method]', method || 'RTK GNSS / Total Station')
  }

  const handleGenerate = () => {
    if (!validate()) return
    const cert = generateCertificate(data)
    // Override certificate number (FIX #6)
    cert.certificateNumber = generateCertificateNumber()
    // Substitute survey method placeholder (FIX #5)
    cert.declaration = substituteDeclaration(cert.declaration, surveyMethod)
    setCertificate(cert)
    setShowPreview(true)
    setValidationErrors([])
  }

  // ─── FIX #3: Print Certificate — opens new window with print-friendly HTML ─────
  const handlePrintCertificate = () => {
    if (!certificate) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Please allow pop-ups to print the certificate.')
      return
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Road Completion Certificate — ${escapeXml(certificate.certificateNumber)}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      color: #000;
      background: #fff;
      padding: 20px;
      line-height: 1.5;
      font-size: 12px;
    }
    .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 16px; margin-bottom: 20px; }
    .header h1 { font-size: 16px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 4px; }
    .header h2 { font-size: 22px; font-weight: bold; margin-bottom: 6px; }
    .header .meta { font-size: 10px; color: #555; }
    .status { text-align: center; padding: 10px; margin: 16px 0; border-radius: 4px; font-weight: bold; }
    .status.pass { background: #e8f5e9; color: #2e7d32; }
    .status.pending { background: #fff8e1; color: #f57f17; }
    .section-title {
      font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;
      border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 18px 0 10px; color: #333;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    td { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 11px; vertical-align: top; }
    td.label { width: 35%; color: #555; }
    td.value { font-weight: 500; color: #000; }
    .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .check-item { font-size: 11px; padding: 2px 0; }
    .check-item.certified { color: #2e7d32; }
    .check-item.not-certified { color: #c62828; }
    .compliance-notes { background: #fffde7; border: 1px solid #fdd835; border-radius: 4px; padding: 10px; margin: 12px 0; }
    .compliance-notes h4 { font-size: 11px; font-weight: bold; color: #f57f17; margin-bottom: 6px; text-transform: uppercase; }
    .compliance-notes p { font-size: 11px; color: #e65100; margin: 2px 0; }
    .declaration { margin-top: 20px; font-size: 11px; line-height: 1.7; color: #222; white-space: pre-line; }
    .signature-block { margin-top: 30px; border-top: 1px solid #000; padding-top: 16px; }
    .signature-line { border-bottom: 1px solid #000; width: 200px; margin-bottom: 8px; }
    .signature-info { font-size: 11px; color: #333; }
    .signature-info .name { font-weight: bold; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:16px;">
    <button onclick="window.print()" style="padding:10px 28px;font-size:14px;cursor:pointer;border:1px solid #999;border-radius:4px;background:#1e40af;color:#fff;"> Print Certificate</button>
  </div>

  <div class="header">
    <h1>Republic of Kenya</h1>
    <h2>${escapeXml(certificate.title)}</h2>
    <div class="meta">Kenya Roads Act, Cap 407 &bull; RDM 1.3 &bull; Survey Act Cap 299</div>
    <div class="meta">Certificate No: <strong>${escapeXml(certificate.certificateNumber)}</strong> &bull; Date: ${escapeXml(certificate.issueDate)}</div>
  </div>

  <div class="status ${certificate.isComplete ? 'pass' : 'pending'}">
    ${certificate.isComplete ? '&#10003; CERTIFIED &mdash; COMPLIANT' : '&#9888; PENDING &mdash; RESERVATIONS NOTED'}
  </div>

  ${certificate.sections.map(section => `
    <div class="section-title">${escapeXml(section.title)}</div>
    <table>
      ${section.rows.map(row => `<tr><td class="label">${escapeXml(row.label)}</td><td class="value">${escapeXml(row.value)}</td></tr>`).join('')}
    </table>
  `).join('')}

  <div class="section-title">Certification Checklist</div>
  <div class="checklist">
    ${certificate.certificationChecklist.map(item => `
      <div class="check-item ${item.certified ? 'certified' : 'not-certified'}">
        ${item.certified ? '&#10003;' : '&#10007;'} ${escapeXml(item.item)}
      </div>
    `).join('')}
  </div>

  ${certificate.complianceNotes.length > 0 ? `
    <div class="compliance-notes">
      <h4>Compliance Notes</h4>
      ${certificate.complianceNotes.map(note => `<p>&bull; ${escapeXml(note)}</p>`).join('')}
    </div>
  ` : ''}

  <div class="section-title">Declaration</div>
  <div class="declaration">${escapeXml(certificate.declaration)}</div>

  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-info">
      <div class="name">${escapeXml(certificate.signatureBlock.surveyorName)}</div>
      <div>${escapeXml(certificate.signatureBlock.surveyorRegistration)}</div>
      <div>${escapeXml(certificate.signatureBlock.surveyorFirm)}</div>
      <div>License: ${escapeXml(certificate.signatureBlock.licenseNumber)}</div>
      <div>Date: ${escapeXml(certificate.signatureBlock.date)}</div>
    </div>
  </div>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6">
        <h3 className="text-lg font-semibold text-white">Road Completion Certificate</h3>
        <p className="text-sm text-zinc-400 mt-1">Kenya Roads Act — formal certification of road construction completion</p>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-950/60 border border-red-800 rounded-xl p-4">
          <h4 className="text-sm font-semibold text-red-400 mb-2">&#9888; Validation Errors</h4>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={`${err}-${i}`} className="text-xs text-red-300">&#8226; {err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Form ─── */}
        <div className="space-y-4">
          {/* Project Details */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Project Details</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'projectName' as const, label: 'Project Name', required: true },
                { key: 'roadName' as const, label: 'Road Name', required: true },
                { key: 'roadNumber' as const, label: 'Road Number', required: false },
                { key: 'county' as const, label: 'County', required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-zinc-400 mb-1">
                    {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input aria-label="Certificate field" type="text"
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      f.required && validationErrors.some(e => e.includes(f.label))
                        ? 'border-red-500'
                        : 'border-zinc-600'
                    }`}
                    value={data[f.key] as string} onChange={e => update(f.key, e.target.value)} />
                </div>
              ))}
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="chainage-start">Chainage Start</label>
                <input id="chainage-start" aria-label="Chainagestart" type="number" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.chainageStart} onChange={e => update('chainageStart', parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="chainage-end">Chainage End</label>
                <input id="chainage-end" aria-label="Chainageend" type="number" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.chainageEnd} onChange={e => update('chainageEnd', parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Construction */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Construction Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="contractor">Contractor</label>
                <input id="contractor" aria-label="Contractorname" type="text" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.contractorName} onChange={e => update('contractorName', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="client">Client</label>
                <input id="client" aria-label="Clientname" type="text" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.clientName} onChange={e => update('clientName', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="completion-date">Completion Date</label>
                <input id="completion-date" aria-label="Completiondate" type="date" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.completionDate} onChange={e => update('completionDate', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="design-speed-km-h">Design Speed (km/h)</label>
                <input id="design-speed-km-h" aria-label="Designspeed" type="number" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.designSpeed} onChange={e => update('designSpeed', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* Surveyor */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Surveyor Details</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="name">
                  Name<span className="text-red-400 ml-0.5">*</span>
                </label>
                <input id="name" type="text"
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validationErrors.some(e => e.includes('Surveyor')) ? 'border-red-500' : 'border-zinc-600'
                  }`}
                  value={data.surveyorName} onChange={e => update('surveyorName', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="isk-registration">ISK Registration</label>
                <input id="isk-registration" type="text" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.surveyorRegistration} onChange={e => update('surveyorRegistration', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="firm">Firm</label>
                <input id="firm" type="text" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={data.surveyorFirm} onChange={e => update('surveyorFirm', e.target.value)} />
              </div>
              {/* FIX #5: Survey Method input */}
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1" htmlFor="survey-method-instrument">Survey Method / Instrument</label>
                <input id="survey-method-instrument" type="text" className="w-full border border-zinc-600 rounded-lg px-3 py-1.5 text-sm bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={surveyMethod} onChange={e => setSurveyMethod(e.target.value)}
 placeholder="e.g. RTK GNSS, Total Station, LiDAR Scanner" />
              </div>
            </div>
          </div>

          {/* Certification Checklist */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Certification Checklist</h4>
            <div className="space-y-2">
              {CERTIFICATION_ITEMS.map(item => (
                <label key={item.key} className="flex items-start gap-3 cursor-pointer">
                  <input aria-label="Certification checkbox" type="checkbox" className="mt-0.5 rounded accent-blue-600" checked={data[CERTIFICATION_FIELD_BY_KEY[item.key]] as boolean}
                    onChange={e => update(CERTIFICATION_FIELD_BY_KEY[item.key], e.target.checked)} />
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-xs text-zinc-400">{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Defects */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Defects ({defects.length})</h4>
            {defects.map((d, i) => (
              <div key={`${d}-${i}`} className="flex gap-2 mb-2 items-center">
                <select className="border border-zinc-600 rounded px-2 py-1 text-xs bg-zinc-800 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={d.severity}
                  onChange={e => { const nd = [...defects]; nd[i] = { ...d, severity: e.target.value as 'minor' | 'major' | 'critical' }; setDefects(nd) }}>
                  <option value="minor">Minor</option><option value="major">Major</option><option value="critical">Critical</option>
                </select>
                <input type="number" className="w-20 border border-zinc-600 rounded px-2 py-1 text-xs bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Chainage" placeholder="e.g. 1+250"
                  value={d.chainage} onChange={e => { const nd = [...defects]; nd[i] = { ...d, chainage: parseFloat(e.target.value) || 0 }; setDefects(nd) }} />
                <input type="text" className="flex-1 border border-zinc-600 rounded px-2 py-1 text-xs bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Description" placeholder="e.g. Pavement crack"
                  value={d.description} onChange={e => { const nd = [...defects]; nd[i] = { ...d, description: e.target.value }; setDefects(nd) }} />
                <button onClick={() => setDefects(defects.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300 text-xs">[x]</button>
              </div>
            ))}
            <button onClick={() => setDefects([...defects, { chainage: 0, description: '', severity: 'minor' }])}
              className="text-xs text-blue-400 hover:text-blue-300">+ Add Defect</button>
          </div>

          {/* Reservations */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-4">
            <h4 className="font-medium text-white text-sm mb-3">Reservations</h4>
            <textarea className="w-full border border-zinc-600 rounded-lg px-3 py-2 text-sm h-16 bg-zinc-800 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Any reservations or conditions..."
              onChange={e => update('reservations', e.target.value.split('\n').filter(Boolean))} />
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Generate Certificate
          </button>
        </div>

        {/* ─── Preview ─── */}
        <div>
          {certificate && showPreview ? (
            <div className="space-y-4">
              {/* FIX #3: Print Certificate Button */}
              <button onClick={handlePrintCertificate}
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-600 text-zinc-300 rounded-lg font-medium hover:bg-zinc-700 hover:text-white transition-colors flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Certificate
              </button>
              <div ref={certificateRef} className="bg-zinc-900 rounded-xl border-2 border-zinc-600 p-8 shadow-lg">
                <CertificatePreview certificate={certificate} />
              </div>
            </div>
          ) : (
            <div className="bg-zinc-800/50 rounded-xl border-2 border-dashed border-zinc-700 p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <p className="text-zinc-500">Fill in the form and click &quot;Generate Certificate&quot;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── CERTIFICATE PREVIEW ──────────────────────────────────────────────────────

function CertificatePreview({ certificate }: { certificate: ReturnType<typeof generateCertificate> }) {
  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="text-center border-b-2 border-zinc-500 pb-4">
        <h2 className="text-lg font-bold text-white tracking-wider">REPUBLIC OF KENYA</h2>
        <h3 className="text-2xl font-bold mt-1 text-white">{certificate.title}</h3>
        <p className="text-xs text-zinc-400 mt-1">Kenya Roads Act, Cap 407 &bull; RDM 1.3 &bull; Survey Act Cap 299</p>
        <p className="text-xs text-zinc-400 mt-1">Certificate No: <span className="font-mono font-bold text-white">{certificate.certificateNumber}</span> &bull; Date: {certificate.issueDate}</p>
      </div>

      {/* Status Badge */}
      <div className={`text-center py-2 rounded-lg ${certificate.isComplete ? 'bg-green-900/50 text-green-400' : 'bg-amber-900/50 text-amber-400'}`}>
        <span className="font-bold flex items-center justify-center gap-1.5">
          {certificate.isComplete
            ? 'CERTIFIED — COMPLIANT'
            : <><AlertTriangle className="w-3.5 h-3.5 inline shrink-0" /> PENDING — RESERVATIONS NOTED</>
          }
        </span>
      </div>

      {/* Sections */}
      {certificate.sections.map((section, i) => (
        <div key={section.title}>
          <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 pb-1 mb-2">{section.title}</h4>
          <table className="w-full text-xs">
            <tbody>
              {section.rows.map((row, j) => (
                <tr key={j}>
                  <td className="py-1 text-zinc-400 w-1/3 border-b border-zinc-800">{row.label}</td>
                  <td className="py-1 font-medium text-white border-b border-zinc-800">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {/* Certification Checklist */}
      <div>
        <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-700 pb-1 mb-2">CERTIFICATION CHECKLIST</h4>
        <div className="grid grid-cols-2 gap-1">
          {certificate.certificationChecklist.map((item, i) => (
            <div key={`${item}-${i}`} className={`flex items-center gap-2 text-xs py-1 ${item.certified ? 'text-green-400' : 'text-red-400'}`}>
              {item.certified ? '' : '[x]'} {item.item}
            </div>
          ))}
        </div>
      </div>

      {/* Compliance Notes */}
      {certificate.complianceNotes.length > 0 && (
        <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-3">
          <h4 className="font-bold text-xs text-amber-400 mb-1">COMPLIANCE NOTES</h4>
          {certificate.complianceNotes.map((note, i) => (
            <p key={`${note}-${i}`} className="text-xs text-amber-500">&#8226; {note}</p>
          ))}
        </div>
      )}

      {/* Declaration */}
      <div className="border-t border-zinc-700 pt-4">
        <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider mb-2">DECLARATION</h4>
        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{certificate.declaration}</p>
      </div>

      {/* Signature Block */}
      <div className="border-t border-zinc-700 pt-6 mt-6">
        <div className="border-b border-zinc-500 w-48 mb-2" />
        <div className="text-xs">
          <div className="font-bold text-white">{certificate.signatureBlock.surveyorName}</div>
          <div className="text-zinc-400">{certificate.signatureBlock.surveyorRegistration}</div>
          <div className="text-zinc-400">{certificate.signatureBlock.surveyorFirm}</div>
          <div className="text-zinc-400">License: {certificate.signatureBlock.licenseNumber}</div>
          <div className="text-zinc-400">Date: {certificate.signatureBlock.date}</div>
        </div>
      </div>
    </div>
  )
}
