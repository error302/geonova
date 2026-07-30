'use client'

import { useState, useEffect } from 'react'
import { Scale, Wrench, FileCheck, Map, Award, Download, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function RegulatoryChecklistPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Instrument check
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [requiredOrder, setRequiredOrder] = useState('Second Order Class II')
  const [instrumentResult, setInstrumentResult] = useState<any>(null)

  // Scale check
  const [areaHa, setAreaHa] = useState('')
  const [scaleResult, setScaleResult] = useState<any>(null)

  // Certificate
  const [surveyorName, setSurveyorName] = useState('')
  const [surveyorLicense, setSurveyorLicense] = useState('')
  const [surveyType, setSurveyType] = useState('cadastral')
  const [locality, setLocality] = useState('')
  const [certResult, setCertResult] = useState('')

  // Elective check
  const [electiveId, setElectiveId] = useState('setting_out')
  const [electiveArea, setElectiveArea] = useState('')
  const [electiveUnits, setElectiveUnits] = useState('')
  const [electiveLinear, setElectiveLinear] = useState('')
  const [electiveResult, setElectiveResult] = useState<any>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/regulations')
      if (res.ok) { const d = await res.json(); setData(d.data) }
    } catch {} finally { setLoading(false) }
  }

  const checkInstrument = async () => {
    const res = await fetch('/api/regulations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_type: 'instrument', brand, model, requiredOrder }),
    })
    if (res.ok) { const d = await res.json(); setInstrumentResult(d.data) }
  }

  const checkScale = async () => {
    const res = await fetch('/api/regulations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check_type: 'scale', areaHa: parseFloat(areaHa) }),
    })
    if (res.ok) { const d = await res.json(); setScaleResult(d.data) }
  }

  const generateCert = async () => {
    const res = await fetch('/api/regulations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        check_type: 'certificate', surveyorName, surveyorLicense,
        surveyType, locality, areaHa: parseFloat(areaHa) || 0, scale: scaleResult?.label || '1:1250',
      }),
    })
    if (res.ok) { const d = await res.json(); setCertResult(d.data) }
  }

  const checkElective = async () => {
    const body: any = { check_type: 'elective', electiveId }
    if (electiveArea) body.areaHa = parseFloat(electiveArea)
    if (electiveUnits) body.unitCount = parseInt(electiveUnits)
    if (electiveLinear) body.linearLengthKm = parseFloat(electiveLinear)
    const res = await fetch('/api/regulations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (res.ok) { const d = await res.json(); setElectiveResult(d.data) }
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-muted)]">Loading...</div>

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Regulatory Checklist</h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">Survey Regulations 1994 — instrument approval, field notes, scales, areas, certificates, and elective survey types</p>

      {/* Instrument Approval (Reg 55) */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Wrench className="w-4 h-4" /> Reg 55(2): Instrument Approval</h2>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input value={brand} onChange={e => setBrand(e.target.value)} className={inputCls} placeholder="Brand (e.g. Leica)" />
          <input value={model} onChange={e => setModel(e.target.value)} className={inputCls} placeholder="Model (e.g. TS16)" />
          <select value={requiredOrder} onChange={e => setRequiredOrder(e.target.value)} className={inputCls}>
            <option>First Order Class I</option><option>First Order Class II</option>
            <option>Second Order Class I</option><option>Second Order Class II</option>
            <option>Third Order</option><option>Fourth Order</option>
          </select>
        </div>
        <button onClick={checkInstrument} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Check Approval</button>
        {instrumentResult && (
          <div className={`mt-2 p-2 rounded text-xs ${instrumentResult.approved ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
            {instrumentResult.approved ? '✓' : '✗'} {instrumentResult.message}
          </div>
        )}
        {data?.instruments && (
          <div className="mt-3 text-[10px] text-[var(--text-muted)]">
            <div className="font-semibold mb-1">Approved Instruments ({data.instruments.length}):</div>
            <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
              {data.instruments.map((inst: any, i: number) => (
                <div key={i} className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">
                  {inst.brand} {inst.model} <span className="opacity-50">({inst.type})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Standard Scales (Reg 89) */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Scale className="w-4 h-4" /> Reg 89: Standard Plotting Scale</h2>
        <div className="flex gap-2 items-end mb-2">
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Area (ha)</label><input value={areaHa} onChange={e => setAreaHa(e.target.value)} className={inputCls + ' w-32'} placeholder="0.5" /></div>
          <button onClick={checkScale} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Select Scale</button>
        </div>
        {scaleResult && (
          <div className="mt-2 p-2 rounded text-xs text-green-400 bg-green-500/10">
            ✓ Recommended scale: <span className="font-bold">{scaleResult.label}</span> — {scaleResult.useCase}
          </div>
        )}
        <div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-[var(--text-muted)]">
          {data?.standardScales?.map((s: any) => (
            <div key={s.scale} className="px-2 py-0.5 rounded bg-[var(--bg-tertiary)]">{s.label} — ≤{s.maxAreaHa}ha</div>
          ))}
        </div>
      </div>

      {/* Surveyor Certificate (Reg 97) */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileCheck className="w-4 h-4" /> Reg 97: Surveyor Certificate</h2>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={surveyorName} onChange={e => setSurveyorName(e.target.value)} className={inputCls} placeholder="Surveyor Name" />
          <input value={surveyorLicense} onChange={e => setSurveyorLicense(e.target.value)} className={inputCls} placeholder="ISK License No." />
          <input value={locality} onChange={e => setLocality(e.target.value)} className={inputCls} placeholder="Locality" />
          <select value={surveyType} onChange={e => setSurveyType(e.target.value)} className={inputCls}>
            <option value="cadastral">Cadastral</option><option value="topographic">Topographic</option>
            <option value="engineering">Engineering</option><option value="control">Control</option>
            <option value="sectional">Sectional Property</option><option value="perimeter">Perimeter/Farm</option>
          </select>
        </div>
        <button onClick={generateCert} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Generate Certificate</button>
        {certResult && (
          <div className="mt-2">
            <pre className="text-[9px] text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-tertiary)] p-3 rounded-lg max-h-60 overflow-y-auto">{certResult}</pre>
            <button onClick={() => { const blob = new Blob([certResult], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'survey_certificate.txt'; a.click(); URL.revokeObjectURL(url) }} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-semibold rounded-lg">
              <Download className="w-3 h-3" /> Download Certificate
            </button>
          </div>
        )}
      </div>

      {/* Elective Survey Types (License Application) */}
      <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Award className="w-4 h-4" /> License Elective Survey Types</h2>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select value={electiveId} onChange={e => setElectiveId(e.target.value)} className={inputCls}>
            {data?.electives?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <div className="grid grid-cols-3 gap-1">
            <input value={electiveArea} onChange={e => setElectiveArea(e.target.value)} className={inputCls} placeholder="Area (ha)" />
            <input value={electiveUnits} onChange={e => setElectiveUnits(e.target.value)} className={inputCls} placeholder="Units" />
            <input value={electiveLinear} onChange={e => setElectiveLinear(e.target.value)} className={inputCls} placeholder="Linear (km)" />
          </div>
        </div>
        <button onClick={checkElective} className="px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Check Requirement</button>
        {electiveResult && (
          <div className="mt-2 space-y-2">
            <div className={`p-2 rounded text-xs ${electiveResult.check.met ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
              {electiveResult.check.met ? '✓' : '✗'} {electiveResult.check.details}
            </div>
            {electiveResult.elective && (
              <div className="text-[10px] text-[var(--text-muted)]">
                <div className="font-semibold">{electiveResult.elective.description}</div>
                <div className="mt-1"><span className="opacity-60">Required:</span> {electiveResult.elective.minimumRequirement}</div>
                <div className="mt-1"><span className="opacity-60">Deliverables:</span></div>
                {electiveResult.elective.deliverables.map((d: string, i: number) => <div key={i} className="ml-3">• {d}</div>)}
                <div className="mt-1"><span className="opacity-60">Regulations:</span></div>
                {electiveResult.elective.regulations.map((r: string, i: number) => <div key={i} className="ml-3">• {r}</div>)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
