/**
 * Equipment Calibration Tracker
 * User-owned data — persisted in localStorage, keyed by user session.
 * No mock data. Users register their own instruments.
 */

export type EquipmentType = 'total_station' | 'gnss' | 'level' | 'theodolite' | 'edm' | 'prism_pole' | 'accessory'

export interface Equipment {
  id: string
  name: string
  type: EquipmentType
  brand: string
  model: string
  serialNumber: string
  purchaseDate: string         // ISO date string YYYY-MM-DD
  lastCalibrationDate: string  // ISO date string — user sets this on registration or after calibration
  intervalDays: number         // calibration interval in days (e.g. 365 = annual, 180 = 6-monthly)
  location: string
  notes: string
  createdAt: string
}

export interface CalibrationLog {
  id: string
  equipmentId: string
  date: string          // ISO date string
  result: 'passed' | 'failed' | 'adjusted'
  technician: string
  certificate: string
  notes: string
}

export type CalibrationStatus = 'ok' | 'due_soon' | 'overdue'

export interface EquipmentWithStatus extends Equipment {
  nextCalibrationDate: string
  daysUntilDue: number       // negative = overdue
  status: CalibrationStatus
  percentUsed: number        // 0–100, how far through the interval
}

const STORAGE_KEY = 'metardu_equipment'
const LOG_KEY = 'metardu_calibration_logs'

// ── Storage helpers ──────────────────────────────────────────────────────────

function load(): Equipment[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function save(items: Equipment[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function loadLogs(): CalibrationLog[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
  } catch { return [] }
}

function saveLogs(logs: CalibrationLog[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOG_KEY, JSON.stringify(logs))
}

// ── Status calculation ───────────────────────────────────────────────────────

export function calcStatus(eq: Equipment): EquipmentWithStatus {
  const lastCal = new Date(eq.lastCalibrationDate)
  const nextCal = new Date(lastCal.getTime() + eq.intervalDays * 86_400_000)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysUntilDue = Math.ceil((nextCal.getTime() - today.getTime()) / 86_400_000)

  let status: CalibrationStatus = 'ok'
  if (daysUntilDue < 0) status = 'overdue'
  else if (daysUntilDue <= 30) status = 'due_soon'

  const elapsed = today.getTime() - lastCal.getTime()
  const total = nextCal.getTime() - lastCal.getTime()
  const percentUsed = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))

  return {
    ...eq,
    nextCalibrationDate: nextCal.toISOString().split('T')[0],
    daysUntilDue,
    status,
    percentUsed,
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function getAll(): EquipmentWithStatus[] {
  return load().map(calcStatus).sort((a: any, b: any) => a.daysUntilDue - b.daysUntilDue)
}

export function addEquipment(data: Omit<Equipment, 'id' | 'createdAt'>): Equipment {
  const items = load()
  const item: Equipment = { ...data, id: `EQ_${Date.now()}`, createdAt: new Date().toISOString() }
  save([...items, item])
  return item
}

export function updateEquipment(id: string, updates: Partial<Omit<Equipment, 'id' | 'createdAt'>>): boolean {
  const items = load()
  const idx = items.findIndex(e => e.id === id)
  if (idx === -1) return false
  items[idx] = { ...items[idx], ...updates }
  save(items)
  return true
}

export function deleteEquipment(id: string): void {
  save(load().filter((e: any) => e.id !== id))
  saveLogs(loadLogs().filter((l: any) => l.equipmentId !== id))
}

export function logCalibration(data: Omit<CalibrationLog, 'id'>): CalibrationLog {
  const log: CalibrationLog = { ...data, id: `LOG_${Date.now()}` }
  saveLogs([...loadLogs(), log])
  // Update the equipment's lastCalibrationDate
  updateEquipment(data.equipmentId, { lastCalibrationDate: data.date })
  return log
}

export function getLogsFor(equipmentId: string): CalibrationLog[] {
  return loadLogs().filter((l: any) => l.equipmentId === equipmentId).sort((a: any, b: any) => b.date.localeCompare(a.date))
}

export function getEquipmentTypes(): { id: EquipmentType; label: string }[] {
  return [
    { id: 'total_station', label: 'Total Station' },
    { id: 'gnss',          label: 'GNSS Receiver' },
    { id: 'level',         label: 'Digital Level' },
    { id: 'theodolite',    label: 'Theodolite' },
    { id: 'edm',           label: 'EDM' },
    { id: 'prism_pole',    label: 'Prism Pole / Staff' },
    { id: 'accessory',     label: 'Accessory' },
  ]
}

export const BRANDS = ['Leica', 'Trimble', 'Topcon', 'Sokkia', 'Nikon', 'Pentax', 'GeoMax', 'Spectra', 'South', 'Hi-Target', 'Other']

export const INTERVALS: { label: string; days: number }[] = [
  { label: '3 months',  days: 90  },
  { label: '6 months',  days: 180 },
  { label: '1 year',    days: 365 },
  { label: '2 years',   days: 730 },
]
