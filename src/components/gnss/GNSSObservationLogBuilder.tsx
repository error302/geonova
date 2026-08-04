'use client';

import { useState, useCallback } from 'react'
import { Printer, Plus, Trash2, Satellite, Upload, FileText } from 'lucide-react'
import { PrintMetaPanel, type PrintMeta } from '@/components/shared/PrintMetaPanel'
import { printGNSSObservationLog, type GNSSObservationEntry, type GNSSBaselineEntry, type GNSSLogInput } from '@/lib/print/gnssObservationLog'

// ── Sample data for demo ──────────────────────────────────────────────────────

const SAMPLE_OBSERVATIONS: GNSSObservationEntry[] = [
  {
    pointId: 'BM_101', startTime: '2026-05-04T08:15:00', endTime: '2026-05-04T08:30:00',
    durationMin: 15, satellites: 14, pdop: 1.2, hdop: 0.7, vdop: 1.0,
    fixType: 'RTK_FIX', antennaHeight: 1.550, antennaMeasurement: 'SLANT',
    easting: 276543.210, northing: 9852341.678, ellHeight: 1642.345, orthoHeight: 1617.890,
    rmsH: 0.008, rmsV: 0.014, notes: 'PSC flush with ground, clear sky'
  },
  {
    pointId: 'AB1', startTime: '2026-05-04T08:35:00', endTime: '2026-05-04T08:45:00',
    durationMin: 10, satellites: 12, pdop: 1.5, hdop: 0.9, vdop: 1.2,
    fixType: 'RTK_FIX', antennaHeight: 2.000, antennaMeasurement: 'VERTICAL',
    easting: 276612.445, northing: 9852298.112, ellHeight: 1638.901, orthoHeight: 1614.456,
    rmsH: 0.010, rmsV: 0.018,
  },
  {
    pointId: 'AB2', startTime: '2026-05-04T08:50:00', endTime: '2026-05-04T09:00:00',
    durationMin: 10, satellites: 13, pdop: 1.3, hdop: 0.8, vdop: 1.0,
    fixType: 'RTK_FIX', antennaHeight: 2.000, antennaMeasurement: 'VERTICAL',
    easting: 276689.023, northing: 9852315.445, ellHeight: 1640.112, orthoHeight: 1615.667,
    rmsH: 0.009, rmsV: 0.015,
  },
  {
    pointId: 'AB3', startTime: '2026-05-04T09:05:00', endTime: '2026-05-04T09:15:00',
    durationMin: 10, satellites: 11, pdop: 1.8, hdop: 1.1, vdop: 1.4,
    fixType: 'RTK_FIX', antennaHeight: 2.000, antennaMeasurement: 'VERTICAL',
    easting: 276701.890, northing: 9852378.901, ellHeight: 1641.567, orthoHeight: 1617.122,
    rmsH: 0.012, rmsV: 0.020,
  },
  {
    pointId: 'AB4', startTime: '2026-05-04T09:20:00', endTime: '2026-05-04T09:30:00',
    durationMin: 10, satellites: 14, pdop: 1.1, hdop: 0.6, vdop: 0.9,
    fixType: 'RTK_FIX', antennaHeight: 2.000, antennaMeasurement: 'VERTICAL',
    easting: 276625.123, northing: 9852401.234, ellHeight: 1639.890, orthoHeight: 1615.445,
    rmsH: 0.007, rmsV: 0.012,
  },
]

const SAMPLE_BASELINES: GNSSBaselineEntry[] = [
  { from: 'CORS_NBI', to: 'BM_101', deltaE: 543.210, deltaN: 341.678, deltaU: 42.345, distance: 641.890, azimuth: 57.85, solution: 'FIX', ratio: 99.9, rms: 0.008 },
  { from: 'BM_101', to: 'AB1', deltaE: 69.235, deltaN: -43.566, deltaU: -3.444, distance: 81.807, azimuth: 122.15, solution: 'FIX', ratio: 99.8, rms: 0.010 },
  { from: 'BM_101', to: 'AB2', deltaE: 145.813, deltaN: -26.233, deltaU: -2.233, distance: 148.159, azimuth: 100.20, solution: 'FIX', ratio: 99.7, rms: 0.012 },
  { from: 'BM_101', to: 'AB3', deltaE: 158.680, deltaN: 37.223, deltaU: -0.778, distance: 162.994, azimuth: 76.81, solution: 'FIX', ratio: 99.5, rms: 0.011 },
  { from: 'BM_101', to: 'AB4', deltaE: 81.913, deltaN: 59.556, deltaU: -2.455, distance: 101.284, azimuth: 53.97, solution: 'FIX', ratio: 99.9, rms: 0.009 },
]

// ── Fix types ─────────────────────────────────────────────────────────────────

const FIX_TYPES = ['FIX', 'FLOAT', 'DGNSS', 'AUTONOMOUS', 'RTK_FIX', 'RTK_FLOAT'] as const
const ANT_METHODS = ['SLANT', 'VERTICAL', 'ARP'] as const
const BASE_SOURCES = ['OWN_BASE', 'CORS', 'VRS', 'THIRD_PARTY'] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function GNSSObservationLogBuilder() {
  const [observations, setObservations] = useState<GNSSObservationEntry[]>([])
  const [baselines, setBaselines] = useState<GNSSBaselineEntry[]>([])
  const [meta, setMeta] = useState<PrintMeta>({
    projectName: '', clientName: '', surveyorName: '', surveyorEmail: '', clientEmail: '', regNo: '', iskNo: '',
    date: new Date().toISOString().split('T')[0], instrument: '', weather: '', observer: '',
    submissionNo: '',
  })

  // Equipment state
  const [receiverModel, setReceiverModel] = useState('')
  const [receiverSerial, setReceiverSerial] = useState('')
  const [antennaModel, setAntennaModel] = useState('')
  const [antennaSerial, setAntennaSerial] = useState('')
  const [baseStationId, setBaseStationId] = useState('')
  const [baseStationSource, setBaseStationSource] = useState<'OWN_BASE' | 'CORS' | 'VRS' | 'THIRD_PARTY'>('CORS')
  const [datum, setDatum] = useState('WGS84')
  const [projection, setProjection] = useState('UTM Zone 37S')
  const [geoidModel, setGeoidModel] = useState('EGM2008')
  const [elevationMask, setElevationMask] = useState(15)
  const [epochInterval, setEpochInterval] = useState(1)
  const [processingSoftware, setProcessingSoftware] = useState('')

  const loadSample = useCallback(() => {
    setObservations(SAMPLE_OBSERVATIONS)
    setBaselines(SAMPLE_BASELINES)
    setReceiverModel('Leica GS18 T')
    setReceiverSerial('LEI-3847291')
    setAntennaModel('Leica GS18 T Internal')
    setAntennaSerial('LEI-3847291')
    setBaseStationId('CORS_NBI')
    setBaseStationSource('CORS')
    setDatum('WGS84')
    setProjection('UTM Zone 37S')
    setGeoidModel('EGM2008')
    setElevationMask(15)
    setEpochInterval(1)
    setProcessingSoftware('Leica Infinity 4.1')
    setMeta({
      projectName: 'Kaputiei North Subdivision — FR 583/83',
      clientName: 'Kaputiei Holdings Ltd',
      surveyorName: 'Samuel K. Muriithi',
      surveyorEmail: '',
      clientEmail: '',
      regNo: 'LS-1402',
      iskNo: 'ISK-1402',
      date: '2026-05-04',
      instrument: 'Leica GS18 T',
      weather: 'Clear, 24°C',
      observer: 'S.K.M.',
      submissionNo: 'RS087_2026_014_R00',
    })
  }, [])

  const addObservation = () => {
    const idx = observations.length + 1
    setObservations([...observations, {
      pointId: `P${idx}`, startTime: new Date().toISOString(), endTime: new Date().toISOString(),
      durationMin: 10, satellites: 10, pdop: 1.5, hdop: 0.9, vdop: 1.2,
      fixType: 'RTK_FIX', antennaHeight: 2.000, antennaMeasurement: 'VERTICAL',
    }])
  }

  const removeObservation = (i: number) => {
    setObservations(observations.filter((_, idx) => idx !== i))
  }

  const updateObs = (i: number, field: keyof GNSSObservationEntry, value: string | number) => {
    const updated = [...observations]
    updated[i] = { ...updated[i], [field]: value }
    setObservations(updated)
  }

  const addBaseline = () => {
    setBaselines([...baselines, {
      from: 'BASE', to: `P${baselines.length + 1}`,
      deltaE: 0, deltaN: 0, deltaU: 0, distance: 0, azimuth: 0,
      solution: 'FIX', ratio: 99.0, rms: 0.01,
    }])
  }

  const removeBaseline = (i: number) => {
    setBaselines(baselines.filter((_, idx) => idx !== i))
  }

  const updateBsl = (i: number, field: keyof GNSSBaselineEntry, value: string | number) => {
    const updated = [...baselines]
    updated[i] = { ...updated[i], [field]: value }
    setBaselines(updated)
  }

  const handlePrint = () => {
    const inp: GNSSLogInput = {
      observations, baselines, receiverModel, receiverSerial,
      antennaModel, antennaSerial, baseStationId, baseStationSource,
      datum, projection, geoidModel, elevationMask, epochInterval,
      processingSoftware,
      meta: { ...meta, title: 'GNSS Observation Log' },
    }
    printGNSSObservationLog(inp)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50'
  const labelCls = 'block text-xs font-medium text-gray-400 mb-1 uppercase tracking-wide'

  return (
    <div className="space-y-8">
      {/* Top actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={loadSample}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 text-sm">
          <FileText className="h-4 w-4" /> Load Sample Data
        </button>
        <button onClick={handlePrint}
          disabled={observations.length === 0}
          className="flex items-center gap-2 px-5 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 text-sm font-medium">
          <Printer className="h-4 w-4" /> Print GNSS Log
        </button>
      </div>

      {/* Print header */}
      <PrintMetaPanel meta={meta} onChange={setMeta} />

      {/* Equipment */}
      <details open className="bg-gray-800/60 rounded-xl border border-gray-700 p-5">
        <summary className="text-lg font-semibold text-white cursor-pointer flex items-center gap-2">
          <Satellite className="h-5 w-5 text-cyan-400" /> Equipment &amp; Settings
        </summary>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div><label htmlFor="gnsso-receiver-model" className={labelCls}>Receiver Model</label><input id="gnsso-receiver-model" className={inputCls} value={receiverModel} onChange={e => setReceiverModel(e.target.value)} placeholder="Leica GS18 T" /></div>
          <div><label htmlFor="gnsso-receiver-serial" className={labelCls}>Receiver S/N</label><input id="gnsso-receiver-serial" className={inputCls} value={receiverSerial} onChange={e => setReceiverSerial(e.target.value)} /></div>
          <div><label htmlFor="gnsso-antenna-model" className={labelCls}>Antenna Model</label><input id="gnsso-antenna-model" className={inputCls} value={antennaModel} onChange={e => setAntennaModel(e.target.value)} /></div>
          <div><label htmlFor="gnsso-antenna-serial" className={labelCls}>Antenna S/N</label><input id="gnsso-antenna-serial" className={inputCls} value={antennaSerial} onChange={e => setAntennaSerial(e.target.value)} /></div>
          <div><label htmlFor="gnsso-base-station-id" className={labelCls}>Base Station ID</label><input id="gnsso-base-station-id" className={inputCls} value={baseStationId} onChange={e => setBaseStationId(e.target.value)} placeholder="CORS_NBI" /></div>
          <div>
            <label htmlFor="gnsso-base-source" className={labelCls}>Base Source</label>
            <select id="gnsso-base-source" className={inputCls} value={baseStationSource} onChange={e => setBaseStationSource(e.target.value as typeof baseStationSource)}>
              {BASE_SOURCES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div><label htmlFor="gnsso-datum" className={labelCls}>Datum</label><input id="gnsso-datum" className={inputCls} value={datum} onChange={e => setDatum(e.target.value)} /></div>
          <div><label htmlFor="gnsso-projection" className={labelCls}>Projection</label><input id="gnsso-projection" className={inputCls} value={projection} onChange={e => setProjection(e.target.value)} /></div>
          <div><label htmlFor="gnsso-geoid-model" className={labelCls}>Geoid Model</label><input id="gnsso-geoid-model" className={inputCls} value={geoidModel} onChange={e => setGeoidModel(e.target.value)} /></div>
          <div><label htmlFor="gnsso-elevation-mask" className={labelCls}>Elevation Mask (°)</label><input id="gnsso-elevation-mask" type="number" className={inputCls} value={elevationMask} onChange={e => setElevationMask(Number(e.target.value))} /></div>
          <div><label htmlFor="gnsso-epoch-interval" className={labelCls}>Epoch Interval (s)</label><input id="gnsso-epoch-interval" type="number" className={inputCls} value={epochInterval} onChange={e => setEpochInterval(Number(e.target.value))} /></div>
          <div><label htmlFor="gnsso-processing-software" className={labelCls}>Processing Software</label><input id="gnsso-processing-software" className={inputCls} value={processingSoftware} onChange={e => setProcessingSoftware(e.target.value)} /></div>
        </div>
      </details>

      {/* Observations table */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Observations ({observations.length})</h3>
          <button onClick={addObservation}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 px-2">Point</th>
                <th className="py-2 px-2">Start</th>
                <th className="py-2 px-2">End</th>
                <th className="py-2 px-2">Min</th>
                <th className="py-2 px-2">Sats</th>
                <th className="py-2 px-2">PDOP</th>
                <th className="py-2 px-2">HDOP</th>
                <th className="py-2 px-2">Fix</th>
                <th className="py-2 px-2">Ant H</th>
                <th className="py-2 px-2">E</th>
                <th className="py-2 px-2">N</th>
                <th className="py-2 px-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {observations.map((o, i) => (
                <tr key={`${o}-${i}`} className="border-b border-gray-700/50">
                  <td className="py-1 px-2"><input aria-label="Point" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs font-mono" value={o.pointId} onChange={e => updateObs(i, 'pointId', e.target.value)} /></td>
                  <td className="py-1 px-2"><input aria-label="Start" type="datetime-local" className="w-36 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs" value={o.startTime.slice(0, 16)} onChange={e => updateObs(i, 'startTime', e.target.value)} /></td>
                  <td className="py-1 px-2"><input aria-label="End" type="datetime-local" className="w-36 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs" value={o.endTime.slice(0, 16)} onChange={e => updateObs(i, 'endTime', e.target.value)} /></td>
                  <td className="py-1 px-2"><input aria-label="Min" type="number" className="w-12 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={o.durationMin} onChange={e => updateObs(i, 'durationMin', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="Sats" type="number" className="w-10 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={o.satellites} onChange={e => updateObs(i, 'satellites', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="PDOP" type="number" step="0.1" className="w-12 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={o.pdop} onChange={e => updateObs(i, 'pdop', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="HDOP" type="number" step="0.1" className="w-12 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={o.hdop} onChange={e => updateObs(i, 'hdop', Number(e.target.value))} /></td>
                  <td className="py-1 px-2">
                    <select aria-label="Fix" className="w-20 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs" value={o.fixType} onChange={e => updateObs(i, 'fixType', e.target.value)}>
                      {FIX_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="py-1 px-2"><input aria-label="Ant H" type="number" step="0.001" className="w-14 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={o.antennaHeight} onChange={e => updateObs(i, 'antennaHeight', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="E" type="number" step="0.001" className="w-20 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right font-mono" value={o.easting ?? ''} onChange={e => updateObs(i, 'easting', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="N" type="number" step="0.001" className="w-24 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right font-mono" value={o.northing ?? ''} onChange={e => updateObs(i, 'northing', Number(e.target.value))} /></td>
                  <td className="py-1 px-1">
                    <button onClick={() => removeObservation(i)} aria-label="Remove point" className="p-1 text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {observations.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-6">No observations. Click &quot;Add&quot; or load sample data.</p>
          )}
        </div>
      </div>

      {/* Baselines table */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Baseline Vectors ({baselines.length})</h3>
          <button onClick={addBaseline}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm">
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                <th className="py-2 px-2">From</th>
                <th className="py-2 px-2">To</th>
                <th className="py-2 px-2">ΔE</th>
                <th className="py-2 px-2">ΔN</th>
                <th className="py-2 px-2">ΔU</th>
                <th className="py-2 px-2">Dist</th>
                <th className="py-2 px-2">Sol</th>
                <th className="py-2 px-2">Ratio</th>
                <th className="py-2 px-2">RMS</th>
                <th className="py-2 px-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {baselines.map((b, i) => (
                <tr key={`${b}-${i}`} className="border-b border-gray-700/50">
                  <td className="py-1 px-2"><input aria-label="From" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs font-mono" value={b.from} onChange={e => updateBsl(i, 'from', e.target.value)} /></td>
                  <td className="py-1 px-2"><input aria-label="To" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs font-mono" value={b.to} onChange={e => updateBsl(i, 'to', e.target.value)} /></td>
                  <td className="py-1 px-2"><input aria-label="Delta E" type="number" step="0.001" className="w-20 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.deltaE} onChange={e => updateBsl(i, 'deltaE', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="Delta N" type="number" step="0.001" className="w-20 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.deltaN} onChange={e => updateBsl(i, 'deltaN', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="Delta U" type="number" step="0.001" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.deltaU} onChange={e => updateBsl(i, 'deltaU', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="Dist" type="number" step="0.001" className="w-20 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.distance} onChange={e => updateBsl(i, 'distance', Number(e.target.value))} /></td>
                  <td className="py-1 px-2">
                    <select aria-label="Sol" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs" value={b.solution} onChange={e => updateBsl(i, 'solution', e.target.value)}>
                      <option value="FIX">FIX</option>
                      <option value="FLOAT">FLOAT</option>
                      <option value="DGNSS">DGNSS</option>
                    </select>
                  </td>
                  <td className="py-1 px-2"><input aria-label="Ratio" type="number" step="0.1" className="w-14 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.ratio ?? ''} onChange={e => updateBsl(i, 'ratio', Number(e.target.value))} /></td>
                  <td className="py-1 px-2"><input aria-label="RMS" type="number" step="0.0001" className="w-16 px-1 py-1 rounded border border-gray-600 bg-gray-900 text-white text-xs text-right" value={b.rms} onChange={e => updateBsl(i, 'rms', Number(e.target.value))} /></td>
                  <td className="py-1 px-1">
                    <button onClick={() => removeBaseline(i)} aria-label="Remove baseline" className="p-1 text-red-400 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {baselines.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-6">No baselines. Click &quot;Add&quot; or load sample data.</p>
          )}
        </div>
      </div>

      {/* Bottom print button */}
      <div className="flex justify-end">
        <button onClick={handlePrint}
          disabled={observations.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 font-medium">
          <Printer className="h-5 w-5" /> Print GNSS Observation Log
        </button>
      </div>
    </div>
  )
}
