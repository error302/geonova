'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getAll, addEquipment, updateEquipment, deleteEquipment, logCalibration, getLogsFor,
  getEquipmentTypes, EquipmentWithStatus, Equipment, CalibrationLog, BRANDS, INTERVALS,
} from '@/lib/integrations/equipment'

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysLabel(d: number) {
  if (d < 0) return `${Math.abs(d)}d overdue`
  if (d === 0) return 'Due today'
  if (d === 1) return '1 day'
  return `${d} days`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusPill(s: EquipmentWithStatus['status']) {
  if (s === 'overdue')  return 'bg-red-900/40 text-red-300 border border-red-700/50'
  if (s === 'due_soon') return 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
  return 'bg-green-900/40 text-green-300 border border-green-700/50'
}

function statusLabel(e: EquipmentWithStatus) {
  if (e.status === 'overdue')  return 'Overdue'
  if (e.status === 'due_soon') return 'Due soon'
  return 'Current'
}

function CountdownBar({ e }: { e: EquipmentWithStatus }) {
  const pct = e.percentUsed
  const color = e.status === 'overdue' ? 'bg-red-500' : e.status === 'due_soon' ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
        <span>{fmtDate(e.lastCalibrationDate)}</span>
        <span className={e.status === 'overdue' ? 'text-red-400 font-semibold' : e.status === 'due_soon' ? 'text-amber-400' : 'text-green-400'}>
          {e.status === 'overdue' ? daysLabel(e.daysUntilDue) : `${daysLabel(e.daysUntilDue)} left`}
        </span>
        <span>{fmtDate(e.nextCalibrationDate)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Add / Edit form ───────────────────────────────────────────────────────────

const BLANK = {
  name: '', type: 'total_station' as Equipment['type'], brand: '',
  model: '', serialNumber: '', purchaseDate: '', lastCalibrationDate: '',
  intervalDays: 365, location: '', notes: '',
}

function EquipmentForm({
  initial, onSave, onCancel,
}: { initial?: Partial<Equipment>; onSave: (data: Omit<Equipment, 'id' | 'createdAt'>) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const types = getEquipmentTypes()
  const f = (k: keyof typeof BLANK, v: string | number) => setForm(p => ({ ...p, [k]: v }))
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {initial?.id ? 'Edit instrument' : 'Register new instrument'}
          </h2>
          <button onClick={onCancel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Instrument name *</label>
              <input value={form.name} onChange={e => f('name', e.target.value)}
                placeholder="e.g. Leica TS16 — Site A"
                className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Type *</label>
              <select value={form.type} onChange={e => f('type', e.target.value as Equipment['type'])} className="input w-full">
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Brand</label>
              <input value={form.brand} onChange={e => f('brand', e.target.value)}
                list="brands-list" placeholder="Leica, Trimble…" className="input w-full" />
              <datalist id="brands-list">{BRANDS.map((b: any) => <option key={b} value={b} />)}</datalist>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Model</label>
              <input value={form.model} onChange={e => f('model', e.target.value)} placeholder="TS16" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Serial number</label>
              <input value={form.serialNumber} onChange={e => f('serialNumber', e.target.value)} placeholder="1847293" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Purchase date</label>
              <input type="date" max={today} value={form.purchaseDate} onChange={e => f('purchaseDate', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Last calibration date *</label>
              <input type="date" max={today} value={form.lastCalibrationDate} onChange={e => f('lastCalibrationDate', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Calibration interval *</label>
              <select value={form.intervalDays} onChange={e => f('intervalDays', Number(e.target.value))} className="input w-full">
                {INTERVALS.map((i: any) => <option key={i.days} value={i.days}>{i.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Location / Office</label>
              <input value={form.location} onChange={e => f('location', e.target.value)} placeholder="Nairobi Office, Site B…" className="input w-full" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} placeholder="Any relevant notes…" className="input w-full resize-none" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onCancel} className="btn btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => {
              if (!form.name || !form.lastCalibrationDate) return
              onSave(form)
            }}
            className="btn btn-primary flex-1"
          >
            {initial?.id ? 'Save changes' : 'Register instrument'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Log calibration form ─────────────────────────────────────────────────────

function LogForm({ equipment, onSave, onCancel }: { equipment: EquipmentWithStatus; onSave: () => void; onCancel: () => void }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today,
    result: 'passed' as CalibrationLog['result'],
    technician: '',
    certificate: '',
    notes: '',
  })
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Log calibration</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{equipment.name}</p>
          </div>
          <button onClick={onCancel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Calibration date *</label>
            <input type="date" max={today} value={form.date} onChange={e => f('date', e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Result *</label>
            <div className="flex gap-2">
              {(['passed', 'adjusted', 'failed'] as const).map((r: any) => (
                <button key={r} onClick={() => f('result', r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.result === r
                      ? r === 'passed' ? 'bg-green-900/40 text-green-300 border-green-700'
                        : r === 'adjusted' ? 'bg-amber-900/40 text-amber-300 border-amber-700'
                        : 'bg-red-900/40 text-red-300 border-red-700'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'
                  }`}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Technician / Lab</label>
            <input value={form.technician} onChange={e => f('technician', e.target.value)} placeholder="ABC Metrology Lab" className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Certificate number</label>
            <input value={form.certificate} onChange={e => f('certificate', e.target.value)} placeholder="CERT-2024-001" className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => f('notes', e.target.value)} rows={2} className="input w-full resize-none" placeholder="Adjustments made, etc." />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onCancel} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={() => {
            if (!form.date) return
            logCalibration({ equipmentId: equipment.id, ...form })
            onSave()
          }} className="btn btn-primary flex-1">
            Save calibration record
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Detail drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ equipment, onClose, onEdit, onLog, onDelete }: {
  equipment: EquipmentWithStatus
  onClose: () => void
  onEdit: () => void
  onLog: () => void
  onDelete: () => void
}) {
  const logs = getLogsFor(equipment.id)
  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-md bg-[var(--bg-card)] border-l border-[var(--border-color)] h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)]">{equipment.name}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl leading-none">×</button>
        </div>
        <div className="p-6 space-y-6">
          {/* Status banner */}
          <div className={`rounded-lg p-4 ${equipment.status === 'overdue' ? 'bg-red-900/30 border border-red-700/40' : equipment.status === 'due_soon' ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-green-900/20 border border-green-700/30'}`}>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${equipment.status === 'overdue' ? 'text-red-300' : equipment.status === 'due_soon' ? 'text-amber-300' : 'text-green-300'}`}>
                {Math.abs(equipment.daysUntilDue)}
              </span>
              <span className={`text-sm ${equipment.status === 'overdue' ? 'text-red-400' : equipment.status === 'due_soon' ? 'text-amber-400' : 'text-green-400'}`}>
                {equipment.status === 'overdue' ? 'days overdue' : equipment.status === 'due_soon' ? 'days until due' : 'days remaining'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Next calibration: {fmtDate(equipment.nextCalibrationDate)}
            </p>
            <CountdownBar e={equipment} />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Type', getEquipmentTypes().find((t: any) => t.id === equipment.type)?.label || equipment.type],
              ['Brand / Model', `${equipment.brand} ${equipment.model}`.trim() || '—'],
              ['Serial number', equipment.serialNumber || '—'],
              ['Location', equipment.location || '—'],
              ['Purchase date', equipment.purchaseDate ? fmtDate(equipment.purchaseDate) : '—'],
              ['Interval', INTERVALS.find((i: any) => i.days === equipment.intervalDays)?.label || `${equipment.intervalDays} days`],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-[var(--text-muted)] text-xs">{k}</p>
                <p className="text-[var(--text-primary)] mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          {equipment.notes && (
            <div>
              <p className="text-[var(--text-muted)] text-xs mb-1">Notes</p>
              <p className="text-sm text-[var(--text-secondary)]">{equipment.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={onLog} className="btn btn-primary flex-1 text-sm py-2">Log calibration</button>
            <button onClick={onEdit} className="btn btn-secondary text-sm py-2 px-4">Edit</button>
            <button onClick={onDelete} className="btn btn-secondary text-sm py-2 px-3 text-red-400 border-red-700/30 hover:bg-red-900/20">Delete</button>
          </div>

          {/* Calibration history */}
          {logs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Calibration history</h3>
              <div className="space-y-2">
                {logs.map((log: any) => (
                  <div key={log.id} className="bg-[var(--bg-secondary)] rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{fmtDate(log.date)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${log.result === 'passed' ? 'bg-green-900/40 text-green-300' : log.result === 'adjusted' ? 'bg-amber-900/40 text-amber-300' : 'bg-red-900/40 text-red-300'}`}>
                        {log.result}
                      </span>
                    </div>
                    {log.technician && <p className="text-[var(--text-muted)] text-xs">{log.technician}{log.certificate && ` · ${log.certificate}`}</p>}
                    {log.notes && <p className="text-[var(--text-muted)] text-xs mt-1">{log.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const [items, setItems] = useState<EquipmentWithStatus[]>([])
  const [view, setView] = useState<'all' | 'overdue' | 'due_soon' | 'ok'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editItem, setEditItem] = useState<EquipmentWithStatus | null>(null)
  const [logItem, setLogItem] = useState<EquipmentWithStatus | null>(null)
  const [detailItem, setDetailItem] = useState<EquipmentWithStatus | null>(null)

  const reload = useCallback(() => setItems(getAll()), [])
  useEffect(() => { reload() }, [reload])

  const filtered = view === 'all' ? items : items.filter((i: any) => i.status === view)

  const counts = {
    overdue: items.filter((i: any) => i.status === 'overdue').length,
    due_soon: items.filter((i: any) => i.status === 'due_soon').length,
    ok: items.filter((i: any) => i.status === 'ok').length,
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Instrument calibration</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">Track calibration schedules for your survey equipment</p>
          </div>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary">
            + Add instrument
          </button>
        </div>

        {/* Summary cards */}
        {items.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {([
              { key: 'overdue', label: 'Overdue', color: 'text-red-400', border: 'border-red-700/30 bg-red-900/10' },
              { key: 'due_soon', label: 'Due within 30 days', color: 'text-amber-400', border: 'border-amber-700/30 bg-amber-900/10' },
              { key: 'ok', label: 'Current', color: 'text-green-400', border: 'border-green-700/30 bg-green-900/10' },
            ] as const).map(({ key, label, color, border }) => (
              <button key={key} onClick={() => setView(v => v === key ? 'all' : key)}
                className={`p-4 rounded-xl border transition-all text-left ${view === key ? border : 'border-[var(--border-color)] bg-[var(--bg-card)]'}`}>
                <p className={`text-2xl font-bold ${color}`}>{counts[key]}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{label}</p>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-24 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="text-4xl mb-4">📐</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">No instruments registered</h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              Add your total stations, GNSS receivers, levels, and other instruments to track their calibration schedules.
            </p>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary">
              Register your first instrument
            </button>
          </div>
        )}

        {/* Equipment list */}
        {items.length > 0 && (
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="text-center py-12 text-[var(--text-muted)] text-sm">
                No instruments with that status
              </div>
            )}
            {filtered.map((eq: any) => (
              <div key={eq.id}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 cursor-pointer hover:border-[var(--accent)]/40 transition-colors"
                onClick={() => setDetailItem(eq)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[var(--text-primary)]">{eq.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusPill(eq.status)}`}>
                        {statusLabel(eq)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {[eq.brand, eq.model].filter(Boolean).join(' ')}
                      {eq.serialNumber && ` · ${eq.serialNumber}`}
                      {eq.location && ` · ${eq.location}`}
                    </p>
                    <CountdownBar e={eq} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-bold tabular-nums ${eq.status === 'overdue' ? 'text-red-400' : eq.status === 'due_soon' ? 'text-amber-400' : 'text-green-400'}`}>
                      {Math.abs(eq.daysUntilDue)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {eq.status === 'overdue' ? 'days late' : 'days left'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && (
        <EquipmentForm
          onSave={data => { addEquipment(data); reload(); setShowAdd(false) }}
          onCancel={() => setShowAdd(false)}
        />
      )}
      {editItem && (
        <EquipmentForm
          initial={editItem}
          onSave={data => { updateEquipment(editItem.id, data); reload(); setEditItem(null); setDetailItem(null) }}
          onCancel={() => setEditItem(null)}
        />
      )}
      {logItem && (
        <LogForm
          equipment={logItem}
          onSave={() => { reload(); setLogItem(null); setDetailItem(null) }}
          onCancel={() => setLogItem(null)}
        />
      )}
      {detailItem && (
        <DetailDrawer
          equipment={items.find((i: any) => i.id === detailItem.id) || detailItem}
          onClose={() => setDetailItem(null)}
          onEdit={() => { setEditItem(detailItem); setDetailItem(null) }}
          onLog={() => { setLogItem(detailItem); setDetailItem(null) }}
          onDelete={() => { deleteEquipment(detailItem.id); reload(); setDetailItem(null) }}
        />
      )}
    </div>
  )
}
