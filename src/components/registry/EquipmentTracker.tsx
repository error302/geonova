'use client'

import { useState, useEffect } from 'react'
import { Plus, AlertTriangle, Check, X, Upload, Calendar } from 'lucide-react'
import type { Equipment, EquipmentType, CalibrationRecord, CreateEquipmentRequest, CreateCalibrationRecordRequest } from '@/types/equipment'

const EQUIPMENT_TYPES: { value: EquipmentType; label: string }[] = [
  { value: 'TOTAL_STATION', label: 'Total Station' },
  { value: 'GNSS_RECEIVER', label: 'GNSS Receiver' },
  { value: 'LEVEL', label: 'Level' },
  { value: 'THEODOLITE', label: 'Theodolite' },
  { value: 'EDM', label: 'EDM' },
  { value: 'PRISM', label: 'Prism' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'TAPE', label: 'Tape' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'OTHER', label: 'Other' }
]

const statusConfig = {
  CURRENT: { color: 'bg-green-100 text-green-800', icon: Check, label: 'Current' },
  DUE_SOON: { color: 'bg-yellow-100 text-yellow-800', icon: Calendar, label: 'Due Soon' },
  OVERDUE: { color: 'bg-red-100 text-red-800', icon: AlertTriangle, label: 'Overdue' },
  INACTIVE: { color: 'bg-gray-100 text-gray-800', icon: X, label: 'Inactive' }
}

const statusOrder: Record<Equipment['status'], number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  CURRENT: 2,
  INACTIVE: 3,
}

export default function EquipmentTracker() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCalibrationModal, setShowCalibrationModal] = useState(false)

  useEffect(() => {
    fetchEquipment()
  }, [])

  const fetchEquipment = async () => {
    try {
      const res = await fetch('/api/equipment/list')
      const data = await res.json()
      setEquipment(data.equipment || [])
    } catch (error) {
      console.error('Failed to fetch equipment:', error)
    }
    setLoading(false)
  }

  const overdueCount = equipment.filter(e => e.status === 'OVERDUE').length
  const dueSoonCount = equipment.filter(e => e.status === 'DUE_SOON').length
  const currentCount = equipment.filter(e => e.status === 'CURRENT').length

  if (loading) {
    return <div className="p-8 text-center">Loading equipment...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-800">{currentCount}</span>
          </div>
          <p className="text-sm text-green-700">Current</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-yellow-600" />
            <span className="text-2xl font-bold text-yellow-800">{dueSoonCount}</span>
          </div>
          <p className="text-sm text-yellow-700">Due Soon</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-2xl font-bold text-red-800">{overdueCount}</span>
          </div>
          <p className="text-sm text-red-700">Overdue</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <X className="w-5 h-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-800">{equipment.length}</span>
          </div>
          <p className="text-sm text-gray-700">Total</p>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="p-4 bg-red-100 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">
            ⚠️ Calibration overdue. Survey Regulations 1994 Reg 5 requires current
            calibration for all survey instruments. This equipment should not be used
            for licensed surveys until recalibrated.
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Equipment</h3>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-1 bg-sky-600 text-white rounded-lg text-sm hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {[...equipment]
              .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
              .map(eq => (
                <button
                  key={eq.id}
                  onClick={() => setSelectedEquipment(eq)}
                  className={`w-full p-3 rounded-lg border text-left transition ${
                    selectedEquipment?.id === eq.id
                      ? 'border-sky-500 bg-sky-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{eq.name}</p>
                      <p className="text-sm text-gray-500">{eq.make} {eq.model}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${statusConfig[eq.status].color}`}>
                      {statusConfig[eq.status].label}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Next due: {eq.nextCalibrationDue}
                  </div>
                </button>
              ))}

            {equipment.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                No equipment added yet
              </p>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {selectedEquipment ? (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-semibold">{selectedEquipment.name}</h3>
                  <p className="text-gray-500">{selectedEquipment.make} {selectedEquipment.model}</p>
                </div>
                <span className={`px-3 py-1 rounded ${statusConfig[selectedEquipment.status].color}`}>
                  {statusConfig[selectedEquipment.status].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Serial Number</p>
                  <p className="font-medium">{selectedEquipment.serialNumber}</p>
                </div>
                <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium">
                      {EQUIPMENT_TYPES.find(t => t.value === selectedEquipment.type)?.label}
                    </p>
                  </div>
                <div>
                  <p className="text-sm text-gray-500">Last Calibration</p>
                  <p className="font-medium">{selectedEquipment.lastCalibrationDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Next Due</p>
                  <p className="font-medium">{selectedEquipment.nextCalibrationDue}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Certificate No.</p>
                  <p className="font-medium">{selectedEquipment.calibrationCertNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Calibration Lab</p>
                  <p className="font-medium">{selectedEquipment.calibrationLab}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCalibrationModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Calibration Record
                </button>
                <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                  <Upload className="w-4 h-4" />
                  Upload Certificate
                </button>
              </div>

              {selectedEquipment.calibrationHistory && selectedEquipment.calibrationHistory.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Calibration History</h4>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Cert No</th>
                        <th className="text-left py-2">Lab</th>
                        <th className="text-left py-2">Result</th>
                        <th className="text-left py-2">Next Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEquipment.calibrationHistory.map((cal, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2">{cal.date}</td>
                          <td className="py-2">{cal.certNumber}</td>
                          <td className="py-2">{cal.lab}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              cal.result === 'PASS' ? 'bg-green-100 text-green-800' :
                              cal.result === 'FAIL' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {cal.result}
                            </span>
                          </td>
                          <td className="py-2">{cal.nextDueDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500 border rounded-lg p-8">
              Select equipment to view details
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddEquipmentModal
          onClose={() => setShowAddModal(false)}
          onAdd={() => {
            setShowAddModal(false)
            fetchEquipment()
          }}
        />
      )}

      {showCalibrationModal && selectedEquipment && (
        <AddCalibrationModal
          equipmentId={selectedEquipment.id}
          onClose={() => setShowCalibrationModal(false)}
          onAdd={() => {
            setShowCalibrationModal(false)
            fetchEquipment()
          }}
        />
      )}
    </div>
  )
}

function AddEquipmentModal({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const [form, setForm] = useState<CreateEquipmentRequest>({
    name: '',
    type: 'TOTAL_STATION',
    make: '',
    model: '',
    serialNumber: '',
    lastCalibrationDate: '',
    calibrationCertNumber: '',
    calibrationLab: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await fetch('/api/equipment/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      onAdd()
    } catch (error) {
      console.error('Failed to add equipment:', error)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">Add Equipment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Equipment Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Leica TS06 Plus"
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as EquipmentType })}
              className="w-full p-2 border rounded-lg"
            >
              {EQUIPMENT_TYPES.map((t: any) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Make</label>
              <input
                type="text"
                value={form.make}
                onChange={e => setForm({ ...form, make: e.target.value })}
                placeholder="e.g., Leica"
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <input
                type="text"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., TS06 Plus"
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Serial Number</label>
            <input
              type="text"
              value={form.serialNumber}
              onChange={e => setForm({ ...form, serialNumber: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Last Calibration</label>
              <input
                type="date"
                value={form.lastCalibrationDate}
                onChange={e => setForm({ ...form, lastCalibrationDate: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Certificate No.</label>
              <input
                type="text"
                value={form.calibrationCertNumber}
                onChange={e => setForm({ ...form, calibrationCertNumber: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Calibration Lab</label>
            <input
              type="text"
              value={form.calibrationLab}
              onChange={e => setForm({ ...form, calibrationLab: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name || !form.serialNumber}
            className="flex-1 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Equipment'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddCalibrationModal({
  equipmentId,
  onClose,
  onAdd
}: {
  equipmentId: string
  onClose: () => void
  onAdd: () => void
}) {
  const [form, setForm] = useState<CreateCalibrationRecordRequest>({
    date: '',
    certNumber: '',
    lab: '',
    technician: '',
    result: 'PASS',
    findings: '',
    nextDueDate: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await fetch('/api/equipment/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId, ...form })
      })
      onAdd()
    } catch (error) {
      console.error('Failed to add calibration:', error)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full">
        <h3 className="text-lg font-semibold mb-4">Add Calibration Record</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Certificate No.</label>
              <input
                type="text"
                value={form.certNumber}
                onChange={e => setForm({ ...form, certNumber: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Lab</label>
              <input
                type="text"
                value={form.lab}
                onChange={e => setForm({ ...form, lab: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Technician</label>
              <input
                type="text"
                value={form.technician}
                onChange={e => setForm({ ...form, technician: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Result</label>
            <select
              value={form.result}
              onChange={e => setForm({ ...form, result: e.target.value as 'PASS' | 'FAIL' | 'CONDITIONAL' })}
              className="w-full p-2 border rounded-lg"
            >
              <option value="PASS">Pass</option>
              <option value="FAIL">Fail</option>
              <option value="CONDITIONAL">Conditional</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Findings</label>
            <textarea
              value={form.findings}
              onChange={e => setForm({ ...form, findings: e.target.value })}
              rows={2}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Next Due Date</label>
            <input
              type="date"
              value={form.nextDueDate}
              onChange={e => setForm({ ...form, nextDueDate: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={loading || !form.date || !form.nextDueDate}
            className="flex-1 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Record'}
          </button>
        </div>
      </div>
    </div>
  )
}
