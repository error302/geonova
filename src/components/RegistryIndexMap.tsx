'use client'

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageContext'

interface RIMParcel {
  id: string
  number: string
  x: number
  y: number
  width: number
  height: number
  area: string
  description: string
  color: string
  subParcelIds?: string[]
}

interface RIMAmendment {
  id: string
  date: string
  reference: string
  description: string
  edition: string
  affectedPlots: string
}

interface RIMSheetIndex {
  rows: number
  cols: number
  currentRow: number
  currentCol: number
}

interface RegistryIndexMapProps {
  isOpen: boolean
  onClose: () => void
  initialData?: {
    district?: string
    location?: string
    subLocation?: string
    registrationUnit?: string
    sheetNumber?: string
    edition?: string
    scale?: string
    parcels?: RIMParcel[]
  }
}

const PARCEL_COLORS = [
  '#fef3c7', '#d1fae5', '#dbeafe', '#ede9fe',
  '#fce7f3', '#ffedd5', '#f0fdf4', '#fafafa',
]

export default function RegistryIndexMap({ isOpen, onClose, initialData }: RegistryIndexMapProps) {
  const { t } = useLanguage()
  const printRef = useRef<HTMLDivElement>(null)

  const [district, setDistrict] = useState(initialData?.district ?? '')
  const [location, setLocation] = useState(initialData?.location ?? '')
  const [subLocation, setSubLocation] = useState(initialData?.subLocation ?? '')
  const [registrationUnit, setRegistrationUnit] = useState(initialData?.registrationUnit ?? '')
  const [sheetNumber, setSheetNumber] = useState(initialData?.sheetNumber ?? '1')
  const [edition, setEdition] = useState(initialData?.edition ?? '1st EDITION')
  const [scale, setScale] = useState(initialData?.scale ?? '1:2,500')
  const [amendments, setAmendments] = useState<RIMAmendment[]>([])
  const [parcels, setParcels] = useState<RIMParcel[]>(initialData?.parcels ?? [])
  const [selectedParcel, setSelectedParcel] = useState<string | null>(null)
  const [nextParcelNum, setNextParcelNum] = useState(1)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  const [sheetIndex, setSheetIndex] = useState<RIMSheetIndex>({
    rows: 3, cols: 3, currentRow: 1, currentCol: 1,
  })

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const sheetId = [district.toUpperCase(), location.toUpperCase(), registrationUnit.toUpperCase(), `SHEET ${sheetNumber}`]
    .filter(Boolean).join(' / ')

  const addParcel = () => {
    const gridCols = 4
    const row = Math.floor((nextParcelNum - 1) / gridCols)
    const col = (nextParcelNum - 1) % gridCols
    const cellW = 180
    const cellH = 120
    const padding = 8
    const newParcel: RIMParcel = {
      id: crypto.randomUUID(),
      number: String(nextParcelNum),
      x: padding + col * (cellW + padding),
      y: padding + row * (cellH + padding),
      width: cellW,
      height: cellH,
      area: '',
      description: '',
      color: PARCEL_COLORS[(nextParcelNum - 1) % PARCEL_COLORS.length],
    }
    setParcels(prev => [...prev, newParcel])
    setNextParcelNum(n => n + 1)
  }

  const updateParcel = (id: string, updates: Partial<RIMParcel>) => {
    setParcels(prev => prev.map((p: any) => p.id === id ? { ...p, ...updates } : p))
  }

  const removeParcel = (id: string) => {
    setParcels(prev => prev.filter((p: any) => p.id !== id))
    setSelectedParcel(null)
  }

  const addAmendment = () => {
    const prevEdition = amendments.length > 0
      ? amendments[amendments.length - 1].edition
      : edition
    const nextEd = parseInt(prevEdition.replace(/\D/g, '')) || 1
    setAmendments(prev => [...prev, {
      id: crypto.randomUUID(),
      date: new Date().toLocaleDateString('en-GB'),
      reference: '',
      description: '',
      edition: `${nextEd + 1}TH ED`,
      affectedPlots: '',
    }])
  }

  const updateAmendment = (id: string, updates: Partial<RIMAmendment>) => {
    setAmendments(prev => prev.map((a: any) => a.id === id ? { ...a, ...updates } : a))
  }

  const handlePrint = () => {
    const content = printRef.current
    if (!content) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>RIM - ${sheetId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; background: white; padding: 20px; }
    .sheet {
      width: 210mm; min-height: 297mm;
      border: 2px solid #000;
      padding: 12mm;
      position: relative;
      background: white;
      page-break-after: always;
    }
    .sheet-header {
      text-align: center;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .sheet-title {
      font-size: 16pt;
      font-weight: bold;
      text-decoration: underline;
      letter-spacing: 1px;
    }
    .sheet-id {
      font-size: 11pt;
      margin-top: 2px;
    }
    .meta-row {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
      font-size: 9pt;
      flex-wrap: wrap;
    }
    .meta-item { display: flex; gap: 4px; }
    .meta-label { font-weight: bold; }
    .grid-area {
      display: grid;
      grid-template-columns: repeat(${sheetIndex.cols}, 1fr);
      grid-template-rows: repeat(${sheetIndex.rows}, 40px);
      border: 1px solid #999;
      margin-bottom: 8px;
    }
    .grid-cell {
      border: 1px solid #999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      background: #f9f9f9;
    }
    .grid-cell.current {
      background: #000;
      color: white;
      font-weight: bold;
    }
    .parcel-map {
      border: 1px solid #000;
      min-height: 400px;
      position: relative;
      background: #f5f5f5;
      margin-bottom: 8px;
    }
    .parcel {
      position: absolute;
      border: 1.5px solid #000;
      background: #fff;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .parcel.selected { outline: 2px solid #2563eb; }
    .parcel-num { font-size: 9pt; font-weight: bold; }
    .parcel-area { font-size: 7pt; color: #555; }
    .parcel-sub { font-size: 6pt; color: #888; }
    .history-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
      margin-bottom: 6px;
    }
    .history-table th, .history-table td {
      border: 1px solid #000;
      padding: 3px 5px;
      text-align: left;
    }
    .history-table th { background: #000; color: #fff; }
    .footer-row {
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      margin-top: 4px;
      border-top: 1px solid #000;
      padding-top: 4px;
    }
    @media print {
      body { padding: 0; }
      .sheet { border: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${content.innerHTML}
</body>
</html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto p-4">
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Toolbar */}
        <div className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-wide">📋</span>
            <h2 className="font-semibold">Registry Index Map (RIM)</h2>
            <span className="text-xs bg-amber-600 px-2 py-0.5 rounded">Kenya — General Boundaries</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode(m => m === 'view' ? 'edit' : 'view')}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            >
              {mode === 'view' ? '✏️ Edit Sheet' : '👁 View'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded"
            >
              🖨 Print / Export
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar controls */}
          {mode === 'edit' && (
            <div className="w-72 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto max-h-[90vh]">
              <h3 className="text-sm font-bold mb-3 text-gray-700 uppercase tracking-wide">Sheet Details</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">District</label>
                  <input value={district} onChange={e => setDistrict(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm uppercase" placeholder="e.g. KAJIADO" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Location</label>
                  <input value={location} onChange={e => setLocation(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm uppercase" placeholder="e.g. ILKISONGO" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Sub-Location / Registration Unit</label>
                  <input value={registrationUnit} onChange={e => setRegistrationUnit(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm uppercase" placeholder="e.g. ENTARARA" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sheet No.</label>
                    <input type="number" value={sheetNumber} onChange={e => setSheetNumber(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm" min={1} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Edition</label>
                    <input value={edition} onChange={e => setEdition(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm" placeholder="e.g. 1ST EDITION" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Scale</label>
                  <select value={scale} onChange={e => setScale(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm">
                    <option value="1:2,500">1:2,500 (Land Consolidation / Adjudication)</option>
                    <option value="1:5,000">1:5,000 (Large-scale farms / Settlement)</option>
                    <option value="1:10,000">1:10,000 (Subdivision of large farms)</option>
                    <option value="1:50,000">1:50,000 (Pastoral / Range Provisional)</option>
                  </select>
                </div>

                <div className="border-t pt-3">
                  <h4 className="text-xs font-bold text-gray-700 mb-2">Sheet Index (Adjacent Sheets)</h4>
                  <div className="grid grid-cols-3 gap-1 mb-2">
                    {[[0,0],[0,1],[0,2],[1,0],[1,1,'●'],[1,2],[2,0],[2,1],[2,2]].map(([r,c,label],i) => (
                      <button key={i}
                        onClick={() => setSheetIndex(s => ({...s, currentRow: r as number, currentCol: c as number}))}
                        className={`h-8 text-xs rounded border ${r===sheetIndex.currentRow&&c===sheetIndex.currentCol?'bg-black text-white':'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        {label ?? `${Number(r!)+1}-${Number(c!)+1}`}
                      </button>
                    ))}
                  </div>
                  <input type="text" placeholder="Index notes (e.g. Sheet 2 to North)"
                    className="w-full px-2 py-1 border rounded text-xs" />
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-700">Parcels ({parcels.length})</h4>
                    <button onClick={addParcel}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                      + Add Parcel
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {parcels.map((p: any) => (
                      <div key={p.id}
                        className={`flex items-center gap-1 p-1 rounded border cursor-pointer text-xs ${selectedParcel === p.id ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:bg-gray-50'}`}
                        onClick={() => setSelectedParcel(p.id)}
                      >
                        <div className="w-4 h-4 rounded border" style={{background: p.color, borderColor: '#000'}} />
                        <span className="font-bold w-6">{p.number}.</span>
                        <input value={p.area} onChange={e => updateParcel(p.id, {area: e.target.value})}
                          onClick={e => e.stopPropagation()}
                          placeholder="Area (ha)"
                          className="flex-1 px-1 border rounded text-xs" />
                        <button onClick={e => { e.stopPropagation(); removeParcel(p.id) }}
                          className="text-red-500 hover:text-red-700 font-bold px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-gray-700">Sheet History ({amendments.length})</h4>
                    <button onClick={addAmendment}
                      className="px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600">
                      + Amendment
                    </button>
                  </div>
                  <div className="space-y-2">
                    {amendments.map((a: any) => (
                      <div key={a.id} className="border rounded p-2 bg-white text-xs space-y-1">
                        <div className="grid grid-cols-2 gap-1">
                          <input value={a.date} onChange={e => updateAmendment(a.id, {date: e.target.value})}
                            className="px-1 border rounded" placeholder="Date" />
                          <input value={a.edition} onChange={e => updateAmendment(a.id, {edition: e.target.value})}
                            className="px-1 border rounded" placeholder="Edition" />
                        </div>
                        <input value={a.reference} onChange={e => updateAmendment(a.id, {reference: e.target.value})}
                          className="w-full px-1 border rounded" placeholder="Reference (e.g. MUT/2/1036/1/88)" />
                        <input value={a.description} onChange={e => updateAmendment(a.id, {description: e.target.value})}
                          className="w-full px-1 border rounded" placeholder="Description (e.g. SUBDIV 904 INTO 3054-3061)" />
                        <input value={a.affectedPlots} onChange={e => updateAmendment(a.id, {affectedPlots: e.target.value})}
                          className="w-full px-1 border rounded" placeholder="Affected parcels" />
                        <button onClick={() => setAmendments(prev => prev.filter((x: any) => x.id !== a.id))}
                          className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Print area */}
          <div className="flex-1 bg-gray-100 p-4 overflow-auto max-h-[90vh]">
            <div ref={printRef} className="bg-white">
              <RIMSheetContent
                sheetId={sheetId}
                district={district}
                location={location}
                subLocation={subLocation}
                registrationUnit={registrationUnit}
                sheetNumber={sheetNumber}
                edition={edition}
                scale={scale}
                parcels={parcels}
                selectedParcel={selectedParcel}
                amendments={amendments}
                sheetIndex={sheetIndex}
                mode={mode}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RIMSheetContent({
  sheetId, district, location, registrationUnit, sheetNumber, edition, scale,
  parcels, selectedParcel, amendments, sheetIndex, mode
}: {
  sheetId: string
  district: string; location: string; subLocation: string; registrationUnit: string
  sheetNumber: string; edition: string; scale: string
  parcels: RIMParcel[]; selectedParcel: string | null
  amendments: RIMAmendment[]
  sheetIndex: RIMSheetIndex
  mode: 'view' | 'edit'
}) {
  return (
    <div className="w-[210mm] min-h-[297mm] p-[12mm] border-2 border-black bg-white relative font-mono">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <div className="text-base font-bold underline tracking-widest uppercase">
          REGISTRY INDEX MAP
        </div>
        <div className="text-xs mt-1 tracking-wider">
          {sheetId || 'DISTRICT / LOCATION / REGISTRATION UNIT / SHEET N'}
        </div>
      </div>

      {/* Scale + Edition */}
      <div className="flex justify-between text-xs mb-2 px-1">
        <div><span className="font-bold">Scale:</span> {scale}</div>
        <div><span className="font-bold">Edition:</span> {edition || '—'}</div>
        <div><span className="font-bold">Sheet:</span> {sheetNumber || '1'}</div>
      </div>

      {/* Sheet Index (mini grid of adjacent sheets) */}
      <div className="flex items-start gap-2 mb-3">
        <div>
          <div className="text-[7pt] font-bold mb-0.5 uppercase">Sheet Index</div>
          <div className={`grid gap-px bg-gray-400 border border-gray-400`}
            style={{gridTemplateColumns: `repeat(${sheetIndex.cols}, 18px)`, gridTemplateRows: `repeat(${sheetIndex.rows}, 14px)`}}>
            {Array.from({length: sheetIndex.rows * sheetIndex.cols}).map((_, i) => {
              const r = Math.floor(i / sheetIndex.cols)
              const c = i % sheetIndex.cols
              const isCurrent = r === sheetIndex.currentRow && c === sheetIndex.currentCol
              const adjSheets = ['NW', 'N', 'NE', 'W', '●', 'E', 'SW', 'S', 'SE']
              return (
                <div key={i}
                  className={`flex items-center justify-center text-[6pt] ${isCurrent ? 'bg-black text-white font-bold' : 'bg-gray-100'}`}
                  title={adjSheets[i] ?? `${r+1}-${c+1}`}
                >
                  {isCurrent ? '●' : adjSheets[i]}
                </div>
              )
            })}
          </div>
          <div className="text-[6pt] text-gray-500 mt-0.5">
            {sheetIndex.currentRow === 0 ? 'North' : ''} {sheetIndex.currentCol === 0 ? 'West' : ''}
          </div>
        </div>

        {/* Sub-location / Location */}
        <div className="text-xs flex-1 border border-gray-300 p-1 bg-gray-50">
          <div className="font-bold text-[8pt] mb-1">Location Reference</div>
          <div className="grid grid-cols-2 gap-x-4 text-[7pt]">
            <div><span className="font-bold">District:</span> {district || '—'}</div>
            <div><span className="font-bold">Location:</span> {location || '—'}</div>
            <div><span className="font-bold">Sub-Location:</span> {(location as any)?.subLocation || '—'}</div>
            <div><span className="font-bold">Reg. Unit:</span> {registrationUnit || '—'}</div>
          </div>
        </div>
      </div>

      {/* North Arrow */}
      <div className="absolute top-[38mm] right-[12mm] text-center">
        <div className="text-[8pt] font-bold">N</div>
        <svg width="28" height="36" viewBox="0 0 28 36">
          <polygon points="14,2 4,30 14,24 24,30" fill="#000" />
          <line x1="14" y1="8" x2="14" y2="34" stroke="#000" strokeWidth="1" />
          <text x="16" y="8" fontSize="7" fontWeight="bold" fill="#000">N</text>
        </svg>
        <div className="text-[6pt] text-gray-500">↑ Heading</div>
      </div>

      {/* Parcel Map Area */}
      <div className="border border-black mb-3 min-h-[360px] relative bg-gray-50/50"
        style={{height: 'auto', minHeight: '360px'}}>
        {/* Grid overlay */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

        {parcels.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[360px] text-gray-400 text-sm">
            {mode === 'edit' ? '← Add parcels using the panel →' : 'No parcels on this sheet'}
          </div>
        ) : (
          parcels.map((p: any) => (
            <div key={p.id}
              className={`absolute flex flex-col items-center justify-center cursor-pointer ${selectedParcel === p.id ? 'outline-2 outline-blue-500' : ''}`}
              style={{
                left: p.x, top: p.y, width: p.width, height: p.height,
                background: p.color,
              }}
            >
              <span className="text-[9pt] font-bold leading-none">{p.number}</span>
              {p.area && <span className="text-[7pt] text-gray-600">{p.area} ha</span>}
              <div className="border-t border-black/30 w-3/4 mt-0.5" />
            </div>
          ))
        )}
      </div>

      {/* Parcel List Table */}
      {parcels.length > 0 && (
        <div className="mb-3">
          <div className="text-[7pt] font-bold border-b border-black pb-0.5 mb-1">PARCEL REGISTER</div>
          <table className="w-full border-collapse text-[7pt]">
            <thead>
              <tr className="bg-black text-white">
                <th className="border border-gray-400 px-1 py-0.5 text-left w-10">No.</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left">Parcel Ref.</th>
                <th className="border border-gray-400 px-1 py-0.5 text-right w-16">Area (ha)</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-1 py-0.5 text-center font-bold">{p.number}</td>
                  <td className="border border-gray-300 px-1 py-0.5 uppercase">{[district, location, registrationUnit, p.number].filter(Boolean).join('/')}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-right">{p.area || '—'}</td>
                  <td className="border border-gray-300 px-1 py-0.5 text-gray-500">{p.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet History Table */}
      <div className="mb-3">
        <div className="text-[7pt] font-bold border-b border-black pb-0.5 mb-1 uppercase">
          Sheet History — Amendments & Subdivisions
        </div>
        {amendments.length === 0 ? (
          <div className="text-[7pt] text-gray-400 italic border border-dashed border-gray-300 p-1">
            No amendments recorded
          </div>
        ) : (
          <table className="w-full border-collapse text-[7pt]">
            <thead>
              <tr className="bg-black text-white">
                <th className="border border-gray-400 px-1 py-0.5 text-left w-14">Date</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left w-28">Reference</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left">Description</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left w-14">Edition</th>
                <th className="border border-gray-400 px-1 py-0.5 text-left">Plots Affected</th>
              </tr>
            </thead>
            <tbody>
              {amendments.map((a, i) => (
                <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="border border-gray-300 px-1 py-0.5">{a.date}</td>
                  <td className="border border-gray-300 px-1 py-0.5 font-mono">{a.reference || '—'}</td>
                  <td className="border border-gray-300 px-1 py-0.5 uppercase">{a.description || '—'}</td>
                  <td className="border border-gray-300 px-1 py-0.5 font-bold">{a.edition}</td>
                  <td className="border border-gray-300 px-1 py-0.5">{a.affectedPlots || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-end text-[6pt] text-gray-600 border-t border-black pt-1 mt-1">
        <div>
          <span className="font-bold">NOTE:</span> Boundaries shown are GENERAL boundaries (undetermined precise line).
          Measurements must be obtained from field sheets / mutation forms.
        </div>
        <div className="text-right">
          <div>Registered Land Act (Cap. 300) — Director of Surveys</div>
          <div>RIM Sheet {sheetNumber} — {edition}</div>
        </div>
      </div>

      {/* Scale bar */}
      <div className="absolute bottom-[12mm] left-[12mm]">
        <div className="text-[6pt] mb-0.5">Scale: {scale}</div>
        <div className="flex items-end">
          {[0, 10, 20, 30, 40].map((_, i) => (
            <div key={i} className="flex items-end">
              <div className={`h-3 ${i % 2 === 0 ? 'bg-black w-4' : 'bg-black/50 w-2'}`} />
            </div>
          ))}
          <span className="text-[6pt] ml-1">m</span>
        </div>
      </div>
    </div>
  )
}
