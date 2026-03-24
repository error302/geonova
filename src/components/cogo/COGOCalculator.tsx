'use client'

import { useState } from 'react'
import { inverseComputation, polarComputation, intersectionComputation, resectionComputation, areaComputation, joinComputation, type InverseStep } from '@/lib/computations/cogoEngine'

type Tab = 'inverse' | 'polar' | 'intersection' | 'resection' | 'area' | 'join'

interface Props {
  compact?: boolean
}

function DMSField({ label, deg, min, sec, onChange }: { label: string; deg: string; min: string; sec: string; onChange: (f: 'd' | 'm' | 's', v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      <div className="flex gap-1">
        <input value={deg} onChange={e => onChange('d', e.target.value)} type="number" min="0" max="359" placeholder="Deg"
          className="w-10 md:w-14 px-1 md:px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs md:text-sm" />
        <input value={min} onChange={e => onChange('m', e.target.value)} type="number" min="0" max="59" placeholder="Min"
          className="w-8 md:w-12 px-1 md:px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs md:text-sm" />
        <input value={sec} onChange={e => onChange('s', e.target.value)} type="number" step="0.001" min="0" max="59.999" placeholder="Sec"
          className="flex-1 min-w-[50px] px-1 md:px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-xs md:text-sm" />
      </div>
    </div>
  )
}

function DMSState() {
  return { d: '', m: '', s: '' }
}

function DMSGet(d: ReturnType<typeof DMSState>) {
  return { deg: parseInt(d.d) || 0, min: parseInt(d.m) || 0, sec: parseFloat(d.s) || 0 }
}

function StepsDisplay({ steps, title }: { steps: InverseStep[]; title?: string }) {
  if (!steps || steps.length === 0) return null
  return (
    <div className="space-y-2">
      {title && <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{title}</h3>}
      <div className="space-y-1">
        {steps.map((step, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_1fr] md:grid-cols-[1fr_auto_1fr_auto] gap-x-1 md:gap-x-2 text-xs font-mono py-1 border-b border-[var(--border-color)]/20">
            <span className="text-[var(--text-secondary)]">{step.description}</span>
            <span className="text-[var(--text-muted)]">=</span>
            <span className="text-[var(--text-primary)] text-right">{step.value}</span>
            <span className="hidden md:block text-[var(--text-muted)] text-right min-w-[120px] text-right">{step.formula}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CoordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} type="number" step="0.001"
        className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
    </div>
  )
}

function ResultCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`px-3 py-2 rounded border ${accent ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border-color)] bg-[var(--bg-tertiary)]/50'}`}>
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
    </div>
  )
}

export default function COGOCalculator({ compact = false }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('inverse')
  const [error, setError] = useState('')

  // ── INVERSE ──────────────────────────────────────────────────────────────────
  const [invE1, setInvE1] = useState('484620.000')
  const [invN1, setInvN1] = useState('9863280.000')
  const [invE2, setInvE2] = useState('484693.000')
  const [invN2, setInvN2] = useState('9863310.000')
  const [invL1, setInvL1] = useState('A')
  const [invL2, setInvL2] = useState('B')
  const [invResult, setInvResult] = useState<ReturnType<typeof inverseComputation> | null>(null)

  // ── POLAR ───────────────────────────────────────────────────────────────────
  const [polE1, setPolE1] = useState('484620.000')
  const [polN1, setPolN1] = useState('9863280.000')
  const [polD, setPolD] = useState('78.943')
  const [polBear, setPolBear] = useState(DMSState())
  const [polResult, setPolResult] = useState<ReturnType<typeof polarComputation> | null>(null)

  // ── INTERSECTION ─────────────────────────────────────────────────────────────
  const [intE1, setIntE1] = useState('5000.000')
  const [intN1, setIntN1] = useState('5000.000')
  const [intE2, setIntE2] = useState('5100.000')
  const [intN2, setIntN2] = useState('5020.000')
  const [intBear1, setIntBear1] = useState(DMSState())
  const [intBear2, setIntBear2] = useState(DMSState())
  const [intResult, setIntResult] = useState<ReturnType<typeof intersectionComputation> | null>(null)

  // ── RESECTION ────────────────────────────────────────────────────────────────
  const [resEA, setResEA] = useState('5000.000'); const [resNA, setResNA] = useState('5000.000')
  const [resEB, setResEB] = useState('5120.000'); const [resNB, setResNB] = useState('5050.000')
  const [resEC, setResEC] = useState('5100.000'); const [resNC, setResNC] = useState('5100.000')
  const [resAlpha, setResAlpha] = useState(DMSState())
  const [resBeta, setResBeta] = useState(DMSState())
  const [resResult, setResResult] = useState<ReturnType<typeof resectionComputation> | null>(null)

  // ── AREA ────────────────────────────────────────────────────────────────────
  const [areaText, setAreaText] = useState('A,484620.000,9863280.000\nB,484693.000,9863310.000\nC,484750.000,9863250.000')
  const [areaResult, setAreaResult] = useState<ReturnType<typeof areaComputation> | null>(null)

  // ── JOIN ────────────────────────────────────────────────────────────────────
  const [joinText, setJoinText] = useState('A,484620.000,9863280.000\nB,484693.000,9863310.000\nC,484750.000,9863250.000\nD,484720.000,9863200.000')
  const [joinResult, setJoinResult] = useState<ReturnType<typeof joinComputation> | null>(null)

  // ── COMPUTE HANDLERS ────────────────────────────────────────────────────────
  const handleInverse = () => {
    setError('')
    if (!invE1 || !invN1 || !invE2 || !invN2) { setError('Enter all coordinates'); return }
    try {
      setInvResult(inverseComputation({
        e1: parseFloat(invE1), n1: parseFloat(invN1),
        e2: parseFloat(invE2), n2: parseFloat(invN2),
        label1: invL1, label2: invL2,
      }))
    } catch (e: any) { setError(e.message) }
  }

  const handlePolar = () => {
    setError('')
    if (!polE1 || !polN1 || !polD) { setError('Enter all fields'); return }
    const b = DMSGet(polBear)
    try {
      setPolResult(polarComputation({
        e1: parseFloat(polE1), n1: parseFloat(polN1),
        bearingDeg: b.deg, bearingMin: b.min, bearingSec: b.sec,
        distance: parseFloat(polD),
      }))
    } catch (e: any) { setError(e.message) }
  }

  const handleIntersection = () => {
    setError('')
    const b1 = DMSGet(intBear1)
    const b2 = DMSGet(intBear2)
    try {
      setIntResult(intersectionComputation({
        e1: parseFloat(intE1), n1: parseFloat(intN1),
        e2: parseFloat(intE2), n2: parseFloat(intN2),
        bearingDeg1: b1.deg, bearingMin1: b1.min, bearingSec1: b1.sec,
        bearingDeg2: b2.deg, bearingMin2: b2.min, bearingSec2: b2.sec,
      }))
    } catch (e: any) { setError(e.message) }
  }

  const handleResection = () => {
    setError('')
    const a = DMSGet(resAlpha)
    const b = DMSGet(resBeta)
    try {
      setResResult(resectionComputation({
        eA: parseFloat(resEA), nA: parseFloat(resNA),
        eB: parseFloat(resEB), nB: parseFloat(resNB),
        eC: parseFloat(resEC), nC: parseFloat(resNC),
        alphaDeg: a.deg, alphaMin: a.min, alphaSec: a.sec,
        betaDeg: b.deg, betaMin: b.min, betaSec: b.sec,
      }))
    } catch (e: any) { setError(e.message) }
  }

  const handleArea = () => {
    setError('')
    const lines = areaText.trim().split('\n').filter(l => l.trim())
    const points = lines.map(line => {
      const parts = line.split(/[,\t]+/)
      if (parts.length < 3) return null
      return { label: parts[0].trim(), easting: parseFloat(parts[1]), northing: parseFloat(parts[2]) }
    }).filter(Boolean) as Array<{ label: string; easting: number; northing: number }>
    if (points.length < 3) { setError('At least 3 points required'); return }
    try {
      setAreaResult(areaComputation({ points }))
    } catch (e: any) { setError(e.message) }
  }

  const handleJoin = () => {
    setError('')
    const lines = joinText.trim().split('\n').filter(l => l.trim())
    const points = lines.map(line => {
      const parts = line.split(/[,\t]+/)
      if (parts.length < 3) return null
      return { label: parts[0].trim(), easting: parseFloat(parts[1]), northing: parseFloat(parts[2]) }
    }).filter(Boolean) as Array<{ label: string; easting: number; northing: number }>
    if (points.length < 2) { setError('At least 2 points required'); return }
    try {
      setJoinResult(joinComputation({ points }))
    } catch (e: any) { setError(e.message) }
  }

  const clearAll = () => {
    setError('')
    setInvResult(null)
    setPolResult(null)
    setIntResult(null)
    setResResult(null)
    setAreaResult(null)
    setJoinResult(null)
  }

  const handleExportPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      doc.setFontSize(16)
      doc.text('METARDU — COGO Computation Report', 14, 14)
      doc.setFontSize(10)
      doc.text(`Computation Type: ${TABS.find(t => t.id === activeTab)?.label || activeTab}`, 14, 22)
      doc.setFontSize(8)
      doc.text(`Generated: ${new Date().toLocaleString()} | Survey Act Cap. 299 | RDM 1.1 (2025)`, 14, 28)
      doc.setDrawColor(150)
      doc.line(14, 30, 196, 30)

      if (activeTab === 'inverse' && invResult) {
        autoTable(doc, {
          startY: 34,
          head: [['Parameter', 'Value', 'Formula']],
          body: [
            ['Point 1', invL1, ''],
            ['Point 2', invL2, ''],
            ['Delta Easting', `${invResult.deltaE.toFixed(4)} m`, ''],
            ['Delta Northing', `${invResult.deltaN.toFixed(4)} m`, ''],
            ['WCB', invResult.wcbDMS, ''],
            ['Distance', `${invResult.distance.toFixed(4)} m`, ''],
            ['Reduced Bearing', invResult.reducedBearing, ''],
            ['Back Bearing', invResult.backBearingDMS, ''],
            ['Quadrant', invResult.quadrant, ''],
            ['Arithmetic Check', invResult.arithmeticCheck.passed ? 'PASS' : 'FAIL', invResult.arithmeticCheck.value.toFixed(6)],
          ],
          styles: { fontSize: 9 },
          columnStyles: { 2: { cellWidth: 60 } },
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else if (activeTab === 'polar' && polResult) {
        autoTable(doc, {
          startY: 34,
          head: [['Parameter', 'Value']],
          body: [
            ['WCB Used', polResult.wcbDMS],
            ['E2 (m)', polResult.e2.toFixed(4)],
            ['N2 (m)', polResult.n2.toFixed(4)],
          ],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else if (activeTab === 'intersection' && intResult) {
        autoTable(doc, {
          startY: 34,
          head: [['Parameter', 'Value']],
          body: [
            ['Intersection Easting E3 (m)', intResult.e3.toFixed(4)],
            ['Intersection Northing N3 (m)', intResult.n3.toFixed(4)],
            ['Distance from P1 (m)', intResult.distanceFrom1.toFixed(4)],
            ['Distance from P2 (m)', intResult.distanceFrom2.toFixed(4)],
            ['Check Difference (m)', intResult.checkDiff.toFixed(4)],
            ['Within Tolerance', intResult.isWithinTolerance ? 'PASS' : 'FLAG'],
          ],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else if (activeTab === 'resection' && resResult) {
        autoTable(doc, {
          startY: 34,
          head: [['Parameter', 'Value']],
          body: [
            ['Station E (m)', resResult.eP.toFixed(4)],
            ['Station N (m)', resResult.nP.toFixed(4)],
            ['Distance to A (m)', resResult.distToA.toFixed(4)],
            ['Distance to B (m)', resResult.distToB.toFixed(4)],
            ['Distance to C (m)', resResult.distToC.toFixed(4)],
            ['Danger Circle', resResult.isDangerCircle ? 'WARNING' : 'No'],
          ],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else if (activeTab === 'area' && areaResult) {
        autoTable(doc, {
          startY: 34,
          head: [['Parameter', 'Value']],
          body: [
            ['Area (m\u00B2)', areaResult.areaSqm.toFixed(4)],
            ['Area (ha)', areaResult.areaHa.toFixed(4)],
            ['Perimeter (m)', areaResult.perimeter.toFixed(4)],
            ['Centroid E (m)', areaResult.centroid.easting.toFixed(4)],
            ['Centroid N (m)', areaResult.centroid.northing.toFixed(4)],
            ['Arithmetic Check', areaResult.arithmeticCheck.passed ? 'PASS' : 'FAIL'],
          ],
          styles: { fontSize: 9 },
          headStyles: { fillColor: [34, 197, 94] },
        })
      } else if (activeTab === 'join' && joinResult) {
        autoTable(doc, {
          startY: 34,
          head: [['From', 'To', 'Delta E (m)', 'Delta N (m)', 'Distance (m)', 'WCB', 'Back Bearing']],
          body: joinResult.rows.map(r => [r.from, r.to, r.deltaE.toFixed(4), r.deltaN.toFixed(4), r.distance.toFixed(4), r.wcbDMS, r.backBearingDMS]),
          styles: { fontSize: 8 },
          headStyles: { fillColor: [34, 197, 94] },
        })
        const finalY = (doc as any).lastAutoTable.finalY + 6
        doc.setFontSize(9)
        doc.text(`Total Perimeter: ${joinResult.totalPerimeter.toFixed(4)} m`, 14, finalY)
      } else {
        doc.setFontSize(10)
        doc.text('No computation results to export. Run a calculation first.', 14, 34)
      }

      doc.setFontSize(7)
      doc.setTextColor(120)
      doc.text('Source: Ghilani & Wolf, Elementary Surveying 16th Ed. | N.N. Basak, Surveying and Levelling | Survey Act Cap. 299 | RDM 1.1 (2025)', 14, doc.internal.pageSize.height - 8)
      doc.setTextColor(0)

      const date = new Date().toISOString().slice(0, 10)
      const tabName = TABS.find(t => t.id === activeTab)?.label.replace(/[^a-zA-Z]/g, '_') || activeTab
      doc.save(`METARDU_COGO_${tabName}_${date}.pdf`)
    } catch (err) {
      console.error('PDF export error:', err)
      setError('Failed to export PDF. Please try again.')
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'inverse', label: 'Distance & Bearing' },
    { id: 'polar', label: 'Radiation' },
    { id: 'intersection', label: 'Forward Intersection' },
    { id: 'resection', label: 'Backward Intersection' },
    { id: 'area', label: 'Area by Coordinates' },
    { id: 'join', label: 'Missing Line' },
  ]

  return (
    <div className={compact ? '' : 'w-full max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8'}>
      {!compact && (
        <>
          <h1 className="text-3xl font-bold mb-2">COGO Calculator</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Coordinate Geometry — Inverse, Polar, Intersection, Resection, Area, Join | Survey Act Cap 299 | RDM 1.1 (2025)
          </p>
        </>
      )}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-[var(--border-color)] mb-4 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); clearAll() }}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}>
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={handleExportPDF}
          className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border-color)] hover:border-[var(--accent)] rounded">
          Export PDF
        </button>
        <button onClick={clearAll}
          className="px-3 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
          Clear
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 gap-6">
        {/* ── INPUT PANEL ── */}
        <div className="space-y-4">
          {/* INVERSE */}
          {activeTab === 'inverse' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Inverse Computation — Given two points, compute bearing and distance</h2>
              <div className="grid grid-cols-2 gap-3">
                <CoordField label="Point 1 Easting (m)" value={invE1} onChange={setInvE1} />
                <CoordField label="Point 1 Northing (m)" value={invN1} onChange={setInvN1} />
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Point 1 Label</label>
                  <input value={invL1} onChange={e => setInvL1(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <CoordField label="Point 2 Easting (m)" value={invE2} onChange={setInvE2} />
                <CoordField label="Point 2 Northing (m)" value={invN2} onChange={setInvN2} />
                <div>
                  <label className="block text-xs text-[var(--text-muted)] mb-1">Point 2 Label</label>
                  <input value={invL2} onChange={e => setInvL2(e.target.value)}
                    className="w-full px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                </div>
              </div>
              <button onClick={handleInverse} className="btn btn-primary w-full">Compute Inverse →</button>
            </div>
          )}

          {/* RADIATION */}
          {activeTab === 'polar' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Radiation — Station + bearing/dist → coordinates</h2>
              <div className="grid grid-cols-2 gap-3">
                <CoordField label="Known Easting (m)" value={polE1} onChange={setPolE1} />
                <CoordField label="Known Northing (m)" value={polN1} onChange={setPolN1} />
              </div>
              <DMSField label="WCB Bearing" deg={polBear.d} min={polBear.m} sec={polBear.s}
                onChange={(f, v) => setPolBear(p => ({ ...p, [f]: v }))} />
              <CoordField label="Distance (m)" value={polD} onChange={setPolD} />
              <button onClick={handlePolar} className="btn btn-primary w-full">Compute Polar →</button>
            </div>
          )}

          {/* INTERSECTION */}
          {activeTab === 'intersection' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Bearing Intersection — Compute intersection of two bearings</h2>
              <p className="text-xs text-[var(--text-muted)]">Known Point 1</p>
              <div className="grid grid-cols-2 gap-3">
                <CoordField label="Easting (m)" value={intE1} onChange={setIntE1} />
                <CoordField label="Northing (m)" value={intN1} onChange={setIntN1} />
              </div>
              <DMSField label="Bearing from Point 1 (DMS)" deg={intBear1.d} min={intBear1.m} sec={intBear1.s}
                onChange={(f, v) => setIntBear1(p => ({ ...p, [f]: v }))} />
              <p className="text-xs text-[var(--text-muted)]">Known Point 2</p>
              <div className="grid grid-cols-2 gap-3">
                <CoordField label="Easting (m)" value={intE2} onChange={setIntE2} />
                <CoordField label="Northing (m)" value={intN2} onChange={setIntN2} />
              </div>
              <DMSField label="Bearing from Point 2 (DMS)" deg={intBear2.d} min={intBear2.m} sec={intBear2.s}
                onChange={(f, v) => setIntBear2(p => ({ ...p, [f]: v }))} />
              <button onClick={handleIntersection} className="btn btn-primary w-full">Compute Intersection →</button>
            </div>
          )}

          {/* RESECTION */}
          {activeTab === 'resection' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Three-Point Resection (Tienstra/Pothenot)</h2>
              <div className="grid grid-cols-3 gap-2">
                <div />
                <div className="text-xs text-center font-semibold text-[var(--text-secondary)]">Easting</div>
                <div className="text-xs text-center font-semibold text-[var(--text-secondary)]">Northing</div>
                <div className="text-xs text-[var(--text-secondary)] flex items-center">Point A</div>
                <input value={resEA} onChange={e => setResEA(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <input value={resNA} onChange={e => setResNA(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <div className="text-xs text-[var(--text-secondary)] flex items-center">Point B</div>
                <input value={resEB} onChange={e => setResEB(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <input value={resNB} onChange={e => setResNB(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <div className="text-xs text-[var(--text-secondary)] flex items-center">Point C</div>
                <input value={resEC} onChange={e => setResEC(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
                <input value={resNC} onChange={e => setResNC(e.target.value)} type="number" step="0.001"
                  className="px-2 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm" />
              </div>
              <DMSField label="Angle α = ∠APB (DMS)" deg={resAlpha.d} min={resAlpha.m} sec={resAlpha.s}
                onChange={(f, v) => setResAlpha(p => ({ ...p, [f]: v }))} />
              <DMSField label="Angle β = ∠BPC (DMS)" deg={resBeta.d} min={resBeta.m} sec={resBeta.s}
                onChange={(f, v) => setResBeta(p => ({ ...p, [f]: v }))} />
              <button onClick={handleResection} className="btn btn-primary w-full">Compute Resection →</button>
            </div>
          )}

          {/* AREA */}
          {activeTab === 'area' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Area by Coordinates (Shoelace)</h2>
              <p className="text-xs text-[var(--text-muted)]">Enter one point per line: Label, Easting, Northing</p>
              <textarea value={areaText} onChange={e => setAreaText(e.target.value)}
                className="w-full h-48 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm font-mono"
                placeholder={'A,484620.000,9863280.000\nB,484693.000,9863310.000\nC,484750.000,9863250.000'} />
              <button onClick={handleArea} className="btn btn-primary w-full">Compute Area →</button>
            </div>
          )}

          {/* JOIN */}
          {activeTab === 'join' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-semibold text-sm">Join Computation — Traverse summary table</h2>
              <p className="text-xs text-[var(--text-muted)]">Enter points in order: Label, Easting, Northing</p>
              <textarea value={joinText} onChange={e => setJoinText(e.target.value)}
                className="w-full h-48 px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] text-sm font-mono"
                placeholder={'A,484620.000,9863280.000\nB,484693.000,9863310.000'} />
              <button onClick={handleJoin} className="btn btn-primary w-full">Compute Joins →</button>
            </div>
          )}
        </div>

        {/* ── RESULTS PANEL ── */}
        <div className="space-y-4">
          {/* INVERSE RESULTS */}
          {activeTab === 'inverse' && invResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Working — Inverse</h2>
              <StepsDisplay steps={invResult.steps} />
              <div className="border-t border-[var(--border-color)] pt-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Result</h3>
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard label="ΔE" value={`${invResult.deltaE.toFixed(4)} m`} />
                  <ResultCard label="ΔN" value={`${invResult.deltaN.toFixed(4)} m`} />
                  <ResultCard label="WCB" value={invResult.wcbDMS} accent />
                  <ResultCard label="Distance" value={`${invResult.distance.toFixed(4)} m`} accent />
                  <ResultCard label="Reduced Bearing θ" value={invResult.reducedBearing} />
                  <ResultCard label="Back Bearing" value={invResult.backBearingDMS} />
                  <ResultCard label="Quadrant" value={invResult.quadrant} />
                  <ResultCard label="Arithmetic Check"
                    value={`${invResult.arithmeticCheck.passed ? 'PASS ✓' : 'FAIL ✗'} (${invResult.arithmeticCheck.value.toFixed(6)})`}
                    accent={invResult.arithmeticCheck.passed} />
                </div>
              </div>
            </div>
          )}

          {/* POLAR RESULTS */}
          {activeTab === 'polar' && polResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Working — Polar</h2>
              <StepsDisplay steps={polResult.steps} />
              <div className="border-t border-[var(--border-color)] pt-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Result</h3>
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard label="WCB Used" value={polResult.wcbDMS} accent />
                  <ResultCard label="E₂ (m)" value={polResult.e2.toFixed(4)} accent />
                  <ResultCard label="N₂ (m)" value={polResult.n2.toFixed(4)} accent />
                </div>
              </div>
            </div>
          )}

          {/* INTERSECTION RESULTS */}
          {activeTab === 'intersection' && intResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Working — Bearing Intersection</h2>
              <StepsDisplay steps={intResult.steps} />
              <div className="border-t border-[var(--border-color)] pt-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Result</h3>
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard label="E₃ (m)" value={intResult.e3.toFixed(4)} accent />
                  <ResultCard label="N₃ (m)" value={intResult.n3.toFixed(4)} accent />
                  <ResultCard label="Dist from P1" value={`${intResult.distanceFrom1.toFixed(4)} m`} />
                  <ResultCard label="Dist from P2" value={`${intResult.distanceFrom2.toFixed(4)} m`} />
                  <ResultCard label="Check Difference"
                    value={`${intResult.checkDiff.toFixed(4)} m  ${intResult.isWithinTolerance ? '✓ PASS' : '✗ FLAG'}`}
                    accent={intResult.isWithinTolerance} />
                </div>
              </div>
            </div>
          )}

          {/* RESECTION RESULTS */}
          {activeTab === 'resection' && resResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Working — Tienstra Resection</h2>
              {resResult.isDangerCircle && (
                <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
                  ⚠ DANGER CIRCLE WARNING — K₁+K₂+K₃ ≈ 0. Point P is approximately on the circumcircle of triangle ABC. Results may be unreliable. Consider changing observation setup.
                </div>
              )}
              <StepsDisplay steps={resResult.steps} />
              <div className="border-t border-[var(--border-color)] pt-4">
                <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Result</h3>
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard label="Eₚ (m)" value={resResult.eP.toFixed(4)} accent />
                  <ResultCard label="Nₚ (m)" value={resResult.nP.toFixed(4)} accent />
                  <ResultCard label="Dist to A" value={`${resResult.distToA.toFixed(4)} m`} />
                  <ResultCard label="Dist to B" value={`${resResult.distToB.toFixed(4)} m`} />
                  <ResultCard label="Dist to C" value={`${resResult.distToC.toFixed(4)} m`} />
                </div>
              </div>
            </div>
          )}

          {/* AREA RESULTS */}
          {activeTab === 'area' && areaResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Working — Area by Coordinates</h2>
              {!areaResult.arithmeticCheck.passed && (
                <div className="p-3 bg-red-900/30 border border-red-600 rounded text-red-400 text-sm">
                  Arithmetic check failed. Difference: {areaResult.arithmeticCheck.diff.toFixed(4)} m². Recheck coordinate entries.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                      <th className="px-2 py-1.5 text-left text-[var(--text-secondary)]">From</th>
                      <th className="px-2 py-1.5 text-left text-[var(--text-secondary)]">To</th>
                      <th className="px-2 py-1.5 text-right text-[var(--text-secondary)]">E×Nₙ₊₁</th>
                      <th className="px-2 py-1.5 text-right text-[var(--text-secondary)]">N×Eₙ₊₁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaResult.diagonalRows.map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/20">
                        <td className="px-2 py-1 text-[var(--text-primary)]">{row.from}</td>
                        <td className="px-2 py-1 text-[var(--text-primary)]">{row.to}</td>
                        <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{row.posProduct.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{row.negProduct.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={2} className="px-2 py-1 text-[var(--text-primary)]">Σ</td>
                      <td className="px-2 py-1 text-right text-[var(--text-primary)]">{areaResult.positiveSum.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right text-[var(--text-primary)]">{areaResult.negativeSum.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ResultCard label="Area (m²)" value={areaResult.areaSqm.toFixed(4)} accent />
                <ResultCard label="Area (ha)" value={areaResult.areaHa.toFixed(4)} accent />
                <ResultCard label="Perimeter (m)" value={areaResult.perimeter.toFixed(4)} />
                <ResultCard label="Arithmetic Check"
                  value={`${areaResult.arithmeticCheck.passed ? 'PASS ✓' : 'FAIL ✗'} (${areaResult.arithmeticCheck.diff.toFixed(6)} m²)`}
                  accent={areaResult.arithmeticCheck.passed} />
                <ResultCard label="Centroid E" value={areaResult.centroid.easting.toFixed(4)} />
                <ResultCard label="Centroid N" value={areaResult.centroid.northing.toFixed(4)} />
              </div>
            </div>
          )}

          {/* JOIN RESULTS */}
          {activeTab === 'join' && joinResult && (
            <div className="card p-4 space-y-4">
              <h2 className="font-semibold text-sm">Join Table</h2>
              <div className="overflow-x-auto">
                <table className="min-w-[600px] w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                      <th className="px-2 py-1.5 text-left text-[var(--text-secondary)]">From</th>
                      <th className="px-2 py-1.5 text-left text-[var(--text-secondary)]">To</th>
                      <th className="px-2 py-1.5 text-right text-[var(--text-secondary)]">ΔE</th>
                      <th className="px-2 py-1.5 text-right text-[var(--text-secondary)]">ΔN</th>
                      <th className="px-2 py-1.5 text-right text-[var(--text-secondary)]">Dist (m)</th>
                      <th className="px-2 py-1.5 text-center text-[var(--text-secondary)]">WCB</th>
                      <th className="px-2 py-1.5 text-center text-[var(--text-secondary)]">Back Brg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinResult.rows.map((row, i) => (
                      <tr key={i} className="border-b border-[var(--border-color)]/20">
                        <td className="px-2 py-1 text-[var(--text-primary)]">{row.from}</td>
                        <td className="px-2 py-1 text-[var(--text-primary)]">{row.to}</td>
                        <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{row.deltaE >= 0 ? '+' : ''}{row.deltaE.toFixed(4)}</td>
                        <td className="px-2 py-1 text-right text-[var(--text-secondary)]">{row.deltaN >= 0 ? '+' : ''}{row.deltaN.toFixed(4)}</td>
                        <td className="px-2 py-1 text-right text-[var(--text-primary)]">{row.distance.toFixed(4)}</td>
                        <td className="px-2 py-1 text-center text-[var(--accent)]">{row.wcbDMS}</td>
                        <td className="px-2 py-1 text-center text-[var(--text-secondary)]">{row.backBearingDMS}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold border-t border-[var(--border-color)]">
                      <td colSpan={4} className="px-2 py-1 text-[var(--text-primary)]">Total Perimeter</td>
                      <td className="px-2 py-1 text-right text-[var(--accent)]">{joinResult.totalPerimeter.toFixed(4)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {!invResult && !polResult && !intResult && !resResult && !areaResult && !joinResult && (
            <div className="flex items-center justify-center h-64 border border-dashed border-[var(--border-color)] rounded">
              <p className="text-sm text-[var(--text-muted)]">Enter values and click Compute</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-[var(--text-muted)]">
        Source: Ghilani &amp; Wolf, Elementary Surveying 16th Ed., Sections 10.3–10.7, 12.5 | N.N. Basak, Surveying and Levelling
      </div>
    </div>
  )
}
