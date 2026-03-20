'use client'

import { useState, useEffect } from 'react'
import { 
  getAllEquipment, 
  getCalibrationAlerts, 
  getEquipmentTypes, 
  getCalibrationSummary,
  Equipment 
} from '@/lib/integrations/equipment'

export default function EquipmentPage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [selectedType, setSelectedType] = useState<string>('all')

  useEffect(() => {
    setLoading(true)
    setEquipment(getAllEquipment())
    setAlerts(getCalibrationAlerts())
    setSummary(getCalibrationSummary())
    setLoading(false)
  }, [])

  const types = getEquipmentTypes()
  const filteredEquipment = selectedType === 'all' 
    ? equipment 
    : equipment.filter(e => e.type === selectedType)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-900/30 text-green-400 border border-green-700/30'
      case 'due': return 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/30'
      case 'overdue': return 'bg-red-900/30 text-red-400 border border-red-700/30'
      case 'calibrating': return 'bg-blue-900/30 text-blue-400 border border-blue-700/30'
      default: return 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Equipment Calibration Tracker</h1>
        <p className="text-[var(--text-muted)] mb-8">Monitor and manage survey instrument calibration schedules</p>

        {alerts.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/40 rounded-lg">
            <h3 className="font-medium text-yellow-300 mb-2">⚠️ Calibration Alerts</h3>
            <div className="space-y-1">
              {alerts.map((alert, i) => (
                <p key={i} className="text-sm text-yellow-400">
                  {alert.equipment.name} ({alert.equipment.brand} {alert.equipment.model}) - 
                  {alert.daysUntilDue < 0 
                    ? ` Overdue by ${Math.abs(alert.daysUntilDue)} days`
                    : ` Due in ${alert.daysUntilDue} days`
                  }
                </p>
              ))}
            </div>
          </div>
        )}

        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-sm text-[var(--text-muted)]">Total Equipment</p>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-green-600">{summary.active}</p>
              <p className="text-sm text-[var(--text-muted)]">Active</p>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-yellow-600">{summary.due}</p>
              <p className="text-sm text-[var(--text-muted)]">Due Soon</p>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-red-600">{summary.overdue}</p>
              <p className="text-sm text-[var(--text-muted)]">Overdue</p>
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)] p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Equipment Inventory</h2>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="p-2 border rounded-lg"
            >
              <option value="all">All Types</option>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Equipment</th>
                  <th className="text-left py-3 px-4">Brand/Model</th>
                  <th className="text-left py-3 px-4">Serial #</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-left py-3 px-4">Last Cal.</th>
                  <th className="text-left py-3 px-4">Next Due</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEquipment.map(eq => (
                  <tr key={eq.id} className="border-b hover:bg-[var(--bg-secondary)]">
                    <td className="py-3 px-4 font-medium">{eq.name}</td>
                    <td className="py-3 px-4 text-sm text-[var(--text-muted)]">{eq.brand} {eq.model}</td>
                    <td className="py-3 px-4 text-sm font-mono">{eq.serialNumber}</td>
                    <td className="py-3 px-4 text-sm">{eq.location || '-'}</td>
                    <td className="py-3 px-4 text-sm">{eq.calibrationDate || '-'}</td>
                    <td className="py-3 px-4 text-sm">{eq.nextCalibrationDate || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(eq.status)}`}>
                        {eq.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
