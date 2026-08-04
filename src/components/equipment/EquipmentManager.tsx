'use client'

/**
 * EquipmentManager — Track survey equipment with calibration status
 *
 * Features:
 * - List equipment with current calibration status (current/expiring/overdue/never)
 * - Add new equipment
 * - View calibration history per item
 * - Add calibration record
 * - Visual alerts for expiring/overdue calibrations
 * - Per Survey Act: total stations need annual calibration
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Wrench, Plus, Loader2, AlertTriangle, CheckCircle2, Clock,
  Calendar, X, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react'

interface Equipment {
  id: string
  name: string
  type: string
  manufacturer?: string | null
  model?: string | null
  serial_number?: string | null
  status: string
  notes?: string | null
  last_calibrated?: string | null
  next_calibration?: string | null
  calibration_status?: string
  days_until_expiry?: number | null
}

interface Calibration {
  id: string
  calibration_date: string
  next_calibration_date: string
  calibrated_by?: string | null
  calibration_lab?: string | null
  certificate_number?: string | null
  results: string
  notes?: string | null
}

const TYPE_LABELS: Record<string, string> = {
  total_station: 'Total Station',
  gnss_rover: 'GNSS Rover',
  gnss_base: 'GNSS Base',
  auto_level: 'Auto Level',
  digital_level: 'Digital Level',
  theodolite: 'Theodolite',
  eddm: 'EDM',
  other: 'Other',
}

const CAL_STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof CheckCircle2; label: string }> = {
  current: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: CheckCircle2, label: 'Current' },
  expiring: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: Clock, label: 'Expiring Soon' },
  overdue: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: AlertTriangle, label: 'Overdue' },
  never: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', icon: Clock, label: 'Never Calibrated' },
}

export function EquipmentManager() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [calibrations, setCalibrations] = useState<Calibration[]>([])
  const [loadingCal, setLoadingCal] = useState(false)
  const [showCalForm, setShowCalForm] = useState(false)

  const fetchEquipment = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/equipment?include_calibration=true')
      if (!res.ok) return
      const data = await res.json()
      setEquipment(data.data?.equipment || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEquipment()
  }, [fetchEquipment])

  const handleExpand = useCallback(async (equipId: string) => {
    if (expandedId === equipId) {
      setExpandedId(null)
      return
    }
    setExpandedId(equipId)
    setShowCalForm(false)
    setLoadingCal(true)
    try {
      const res = await fetch(`/api/equipment/${equipId}/calibration`)
      if (res.ok) {
        const data = await res.json()
        setCalibrations(data.data?.calibrations || [])
      }
    } catch {} finally {
      setLoadingCal(false)
    }
  }, [expandedId])

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this equipment and all calibration records?')) return
    try {
      await fetch(`/api/equipment?id=${id}`, { method: 'DELETE' })
      setEquipment(prev => prev.filter(e => e.id !== id))
    } catch {}
  }, [])

  // Summary stats
  const stats = {
    total: equipment.length,
    current: equipment.filter(e => e.calibration_status === 'current').length,
    expiring: equipment.filter(e => e.calibration_status === 'expiring').length,
    overdue: equipment.filter(e => e.calibration_status === 'overdue').length,
    never: equipment.filter(e => e.calibration_status === 'never').length,
  }

  return (
    <div className="space-y-4">
      {/* Header + Summary */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Equipment & Calibration</h2>
              <p className="text-[10px] text-gray-500">Track calibration dates per Survey Act Cap 299</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Equipment
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard label="Total" value={stats.total} color="text-gray-300" bg="bg-white/[0.04]" />
          <StatCard label="Current" value={stats.current} color="text-emerald-400" bg="bg-emerald-500/10" />
          <StatCard label="Expiring" value={stats.expiring} color="text-amber-400" bg="bg-amber-500/10" />
          <StatCard label="Overdue" value={stats.overdue} color="text-red-400" bg="bg-red-500/10" />
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <AddEquipmentForm
          onClose={() => setShowAddForm(false)}
          onAdded={() => { setShowAddForm(false); fetchEquipment() }}
        />
      )}

      {/* Equipment list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
        </div>
      ) : equipment.length === 0 ? (
        <div className="card p-8 flex flex-col items-center justify-center text-center">
          <Wrench className="w-8 h-8 text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No equipment registered</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Add your total station, GNSS rover, or level to track calibration dates.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {equipment.map(equip => {
            const calStatus = equip.calibration_status || 'never'
            const cfg = CAL_STATUS_CONFIG[calStatus] || CAL_STATUS_CONFIG.never
            const StatusIcon = cfg.icon
            const isExpanded = expandedId === equip.id

            return (
              <div key={equip.id} className="card overflow-hidden">
                {/* Equipment row */}
                <div
                  onClick={() => handleExpand(equip.id)}
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${cfg.bg} ${cfg.border} border`}>
                    <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{equip.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-gray-400 uppercase">
                        {TYPE_LABELS[equip.type] || equip.type}
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {equip.manufacturer} {equip.model}
                      {equip.serial_number && ` (S/N: ${equip.serial_number})`}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                      {equip.days_until_expiry != null && equip.days_until_expiry >= 0 && (
                        <span className="text-[10px] text-gray-600 flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {equip.days_until_expiry} days left
                        </span>
                      )}
                      {equip.days_until_expiry != null && equip.days_until_expiry < 0 && (
                        <span className="text-[10px] text-red-400 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {Math.abs(equip.days_until_expiry)} days overdue
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(equip.id, e)}
                      className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </div>
                </div>

                {/* Expanded calibration history */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-color)] p-4 bg-[var(--bg-tertiary)]/30">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[var(--text-primary)]">Calibration History</span>
                      <button
                        onClick={() => setShowCalForm(!showCalForm)}
                        className="flex items-center gap-1 px-2 h-7 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] text-[10px] font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        Add Calibration
                      </button>
                    </div>

                    {showCalForm && (
                      <AddCalibrationForm
                        equipmentId={equip.id}
                        onClose={() => setShowCalForm(false)}
                        onAdded={() => {
                          setShowCalForm(false)
                          handleExpand(equip.id)
                          fetchEquipment()
                        }}
                      />
                    )}

                    {loadingCal ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                      </div>
                    ) : calibrations.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-4">No calibration records yet</p>
                    ) : (
                      <div className="space-y-2">
                        {calibrations.map(cal => (
                          <div key={cal.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-[var(--border-color)]">
                            <div className={`shrink-0 w-7 h-7 rounded flex items-center justify-center ${
                              cal.results === 'pass' ? 'bg-emerald-500/10' : 'bg-red-500/10'
                            }`}>
                              {cal.results === 'pass' ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-[var(--text-primary)]">
                                {new Date(cal.calibration_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}
                                <span className="text-gray-500 ml-2">→ expires {new Date(cal.next_calibration_date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                              </div>
                              {cal.calibration_lab && (
                                <div className="text-[10px] text-gray-500 mt-0.5">Lab: {cal.calibration_lab}</div>
                              )}
                              {cal.certificate_number && (
                                <div className="text-[10px] text-gray-500 font-mono">Cert: {cal.certificate_number}</div>
                              )}
                              {cal.notes && (
                                <div className="text-[10px] text-gray-600 mt-0.5">{cal.notes}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`p-2 rounded-lg ${bg} border border-white/[0.04] text-center`}>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  )
}

function AddEquipmentForm({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('total_station')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, manufacturer, model, serialNumber, notes }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }, [name, type, manufacturer, model, serialNumber, notes, onAdded])

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Add Equipment</h3>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="name">Name</label>
          <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Leica TS07" className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase tracking-wider mb-1" htmlFor="type">Type</label>
          <select id="type" value={type} onChange={e => setType(e.target.value)} className="w-full h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)]">
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="text" value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="Manufacturer" className="h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="Model" className="h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
        <input type="text" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Serial No." className="h-9 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] font-mono placeholder-gray-600 focus:border-[var(--accent)]/30 focus:outline-none" />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-9 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400 hover:text-gray-200">Cancel</button>
        <button onClick={handleSave} disabled={saving || !name} className="flex-1 h-9 rounded-lg bg-[var(--accent)] text-black text-xs font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40">
          {saving ? 'Saving...' : 'Add Equipment'}
        </button>
      </div>
    </div>
  )
}

function AddCalibrationForm({ equipmentId, onClose, onAdded }: { equipmentId: string; onClose: () => void; onAdded: () => void }) {
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0])
  const [nextDate, setNextDate] = useState(new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0])
  const [lab, setLab] = useState('')
  const [certNumber, setCertNumber] = useState('')
  const [results, setResults] = useState('pass')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/equipment/${equipmentId}/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calibrationDate: calDate, nextCalibrationDate: nextDate,
          calibrationLab: lab, certificateNumber: certNumber,
          results, notes,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed')
      }
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }, [equipmentId, calDate, nextDate, lab, certNumber, results, notes, onAdded])

  return (
    <div className="card p-3 mb-3 space-y-2 border-[var(--accent)]/20">
      <div className="text-xs font-medium text-[var(--accent)]">Add Calibration Record</div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-1" htmlFor="calibration-date">Calibration Date</label>
          <input id="calibration-date" aria-label="Calibration Date" type="date" value={calDate} onChange={e => setCalDate(e.target.value)} className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]" />
        </div>
        <div>
          <label className="block text-[9px] text-gray-500 uppercase mb-1" htmlFor="next-calibration">Next Calibration</label>
          <input  id="next-calibration" aria-label="Next Calibration" type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={lab} onChange={e => setLab(e.target.value)} placeholder="Calibration Lab" className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] placeholder-gray-600" />
        <input type="text" value={certNumber} onChange={e => setCertNumber(e.target.value)} placeholder="Certificate No." className="h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)] font-mono placeholder-gray-600" />
      </div>
      <select value={results} onChange={e => setResults(e.target.value)} className="w-full h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-primary)]">
        <option value="pass">Pass</option>
        <option value="fail">Fail</option>
        <option value="conditional">Conditional Pass</option>
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 h-8 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs text-gray-400">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex-1 h-8 rounded bg-[var(--accent)] text-black text-xs font-semibold disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
}
