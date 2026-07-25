'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, AlertCircle, Plus, Clock, MapPin } from 'lucide-react'

export default function ControlPointVerificationPage() {
  const [verifications, setVerifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [pointType, setPointType] = useState('survey_point')
  const [pointId, setPointId] = useState('')
  const [pointName, setPointName] = useState('')
  const [condition, setCondition] = useState('good')
  const [measuredE, setMeasuredE] = useState('')
  const [measuredN, setMeasuredN] = useState('')
  const [publishedE, setPublishedE] = useState('')
  const [publishedN, setPublishedN] = useState('')
  const [method, setMethod] = useState('gnss_rtk')
  const [notes, setNotes] = useState('')

  useEffect(() => { loadVerifications() }, [])

  const loadVerifications = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/control-points/verifications?limit=100')
      if (res.ok) { const data = await res.json(); setVerifications(data.data) }
    } catch {} finally { setLoading(false) }
  }

  const handleSubmit = async () => {
    const body: any = {
      point_type: pointType, point_id: pointId, point_name: pointName,
      verification_date: new Date().toISOString().split('T')[0],
      condition, method, condition_notes: notes,
    }
    if (measuredE) body.measured_easting = parseFloat(measuredE)
    if (measuredN) body.measured_northing = parseFloat(measuredN)
    if (publishedE) body.published_easting = parseFloat(publishedE)
    if (publishedN) body.published_northing = parseFloat(publishedN)

    await fetch('/api/control-points/verifications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setShowForm(false); loadVerifications()
  }

  const inputCls = "w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] focus:border-[var(--accent)]/30 focus:outline-none"

  const conditionColors: Record<string, string> = {
    good: 'text-green-400 bg-green-500/10', fair: 'text-yellow-400 bg-yellow-500/10',
    poor: 'text-orange-400 bg-orange-500/10', disturbed: 'text-red-400 bg-red-500/10',
    destroyed: 'text-red-400 bg-red-500/10', missing: 'text-red-400 bg-red-500/10',
  }
  const trustColors: Record<string, string> = {
    within_tolerance: 'text-green-400', exceeds_tolerance: 'text-red-400', not_measured: 'text-gray-400',
  }

  return (
    <div className="min-h-screen p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Control Point Verification</h1>
          <p className="text-sm text-[var(--text-muted)]">Track on-site verification of control points — know whether to trust a point before you tie to it</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">
          <Plus className="w-4 h-4" /> Record Verification
        </button>
      </div>

      {showForm && (
        <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4 mb-4 grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Point Type</label>
            <select value={pointType} onChange={e => setPointType(e.target.value)} className={inputCls}>
              <option value="survey_point">Survey Point</option><option value="beacon">Beacon</option><option value="boundary_monument">Boundary Monument</option>
            </select></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Point ID (UUID)</label><input value={pointId} onChange={e => setPointId(e.target.value)} className={inputCls} placeholder="UUID" /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Point Name</label><input value={pointName} onChange={e => setPointName(e.target.value)} className={inputCls} placeholder="CP1" /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Condition</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className={inputCls}>
              <option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
              <option value="disturbed">Disturbed</option><option value="destroyed">Destroyed</option><option value="missing">Missing</option>
            </select></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Measured E</label><input value={measuredE} onChange={e => setMeasuredE(e.target.value)} className={inputCls} placeholder="264000.000" /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Measured N</label><input value={measuredN} onChange={e => setMeasuredN(e.target.value)} className={inputCls} placeholder="9861000.000" /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Published E</label><input value={publishedE} onChange={e => setPublishedE(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Published N</label><input value={publishedN} onChange={e => setPublishedN(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
              <option value="gnss_static">GNSS Static</option><option value="gnss_rtk">GNSS RTK</option>
              <option value="total_station">Total Station</option><option value="level">Level</option>
            </select></div>
          <div><label className="text-[10px] text-[var(--text-muted)] block mb-1">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} /></div>
          <button onClick={handleSubmit} className="col-span-2 px-4 py-2 bg-[var(--accent)] text-black text-xs font-semibold rounded-lg hover:bg-[var(--accent-dim)]">Submit Verification</button>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-sm text-[var(--text-muted)]">Loading...</div> : verifications.length === 0 ? (
        <div className="text-center py-8 text-sm text-[var(--text-muted)]">No verifications recorded. Click "Record Verification" to start.</div>
      ) : (
        <div className="space-y-3">
          {verifications.map(v => (
            <div key={v.id} className="bg-[var(--bg-secondary)]/50 border border-[var(--border-color)] rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[var(--accent)]" />
                  <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{v.point_name || v.point_id.substring(0, 8)}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${conditionColors[v.condition] || ''}`}>{v.condition}</span>
                  {v.displacement_status && <span className={`text-[9px] px-2 py-0.5 rounded-full ${trustColors[v.displacement_status] || ''} bg-current/10`}>{v.displacement_status}</span>}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]"><Clock className="w-3 h-3" /> {v.verification_date}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--text-muted)]">
                {v.horizontal_displacement && <div><span className="opacity-60">Displacement:</span> <span className={`font-mono ${v.displacement_status === 'exceeds_tolerance' ? 'text-red-400' : 'text-green-400'}`}>{(v.horizontal_displacement * 1000).toFixed(1)}mm</span></div>}
                {v.verifier_name && <div><span className="opacity-60">Verifier:</span> <span className="text-[var(--text-secondary)]">{v.verifier_name}</span></div>}
                {v.method && <div><span className="opacity-60">Method:</span> <span className="text-[var(--text-secondary)]">{v.method}</span></div>}
                {v.condition_notes && <div className="col-span-3"><span className="opacity-60">Notes:</span> <span className="text-[var(--text-secondary)]">{v.condition_notes}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
