'use client'
import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { WorkingDiagram, BeaconPoint, BoundaryLine, SubArea, BoundaryType, LegacyUnit } from '@/lib/working-diagram/types'
import { metersToLegacy, degToDMS, dmsToDeg } from '@/lib/working-diagram/units'
import { RoadBoundarySelector } from './RoadBoundarySelector'
import { LegacyUnitBadge } from './LegacyUnitBadge'
import { SubAreaPanel } from './SubAreaPanel'

const DiagramCanvas = dynamic(() => import('./DiagramCanvas'), { ssr: false })

const createEmptyDiagram = (): WorkingDiagram => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  titleBlock: {
    drawingTitle: 'WORKING DIAGRAM',
    surveyorName: '',
    surveyorRegNo: '',
    county: '',
    subcounty: '',
    scaleNote: 'Dimensions in Metres',
    utmZone: '37S',
    date: new Date().toISOString().split('T')[0],
  },
  north: {
    bearing: '0° 00\' 00\'\'',
    type: 'grid',
  },
  beacons: [],
  boundaries: [],
  subAreas: [],
})

type TabType = 'title' | 'beacons' | 'boundaries' | 'subareas' | 'north'

export default function WorkingDiagramClient() {
  const [diagram, setDiagram] = useState<WorkingDiagram>(createEmptyDiagram)
  const [activeTab, setActiveTab] = useState<TabType>('title')
  const svgRef = useRef<HTMLDivElement>(null)

  const addBeacon = () => {
    const id = `B${diagram.beacons.length + 1}`
    const newBeacon: BeaconPoint = {
      id,
      label: id,
      symbol: 'concrete_beacon',
    }
    setDiagram(d => ({ ...d, beacons: [...d.beacons, newBeacon] }))
  }

  const updateBeacon = (id: string, updates: Partial<BeaconPoint>) => {
    setDiagram(d => ({
      ...d,
      beacons: d.beacons.map(b => b.id === id ? { ...b, ...updates } : b),
    }))
  }

  const removeBeacon = (id: string) => {
    setDiagram(d => ({
      ...d,
      beacons: d.beacons.filter(b => b.id !== id),
      boundaries: d.boundaries.filter(b => b.fromBeaconId !== id && b.toBeaconId !== id),
    }))
  }

  const addBoundary = () => {
    if (diagram.beacons.length < 2) return
    const idx = diagram.boundaries.length
    const fromBeacon = diagram.beacons[idx]?.id || diagram.beacons[0].id
    const toBeacon = diagram.beacons[idx + 1]?.id || diagram.beacons[1].id
    const newBoundary: BoundaryLine = {
      id: `L${idx + 1}`,
      fromBeaconId: fromBeacon,
      toBeaconId: toBeacon,
      bearingDeg: 0,
      bearingDMS: '0° 00\' 00\'\'',
      distanceMeters: 0,
      showLegacy: false,
      boundaryType: 'standard',
    }
    setDiagram(d => ({ ...d, boundaries: [...d.boundaries, newBoundary] }))
  }

  const updateBoundary = (id: string, updates: Partial<BoundaryLine>) => {
    setDiagram(d => {
      const boundaries = d.boundaries.map(b => {
        if (b.id !== id) return b
        const updated = { ...b, ...updates }
        if (updates.bearingDMS !== undefined) {
          updated.bearingDeg = dmsToDeg(updates.bearingDMS)
        }
        if (updates.distanceMeters !== undefined && updated.showLegacy && updated.legacyUnit) {
          updated.legacyDistance = metersToLegacy(updates.distanceMeters, updated.legacyUnit)
        }
        return updated
      })
      return { ...d, boundaries }
    })
  }

  const removeBoundary = (id: string) => {
    setDiagram(d => ({ ...d, boundaries: d.boundaries.filter(b => b.id !== id) }))
  }

  const addSubArea = () => {
    const id = String.fromCharCode(65 + diagram.subAreas.length)
    const newArea: SubArea = {
      id,
      label: `AREA ${id}`,
      areaHa: 0,
      beaconIds: [],
      fillPattern: 'none',
      fillColor: '#f0f4e8',
    }
    setDiagram(d => ({ ...d, subAreas: [...d.subAreas, newArea] }))
  }

  const updateSubArea = (id: string, updates: Partial<SubArea>) => {
    setDiagram(d => ({
      ...d,
      subAreas: d.subAreas.map(a => a.id === id ? { ...a, ...updates } : a),
    }))
  }

  const removeSubArea = (id: string) => {
    setDiagram(d => ({ ...d, subAreas: d.subAreas.filter(a => a.id !== id) }))
  }

  const exportSVG = () => {
    const svg = document.getElementById('working-diagram-svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `working-diagram-${diagram.titleBlock.parcelRef || 'export'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'title', label: 'Title Block' },
    { id: 'beacons', label: 'Beacons' },
    { id: 'boundaries', label: 'Boundaries' },
    { id: 'subareas', label: 'Sub-Areas' },
    { id: 'north', label: 'North / Units' },
  ]

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <h1 className="text-xl font-semibold">Working Diagram</h1>
        <div className="flex gap-2">
          <button onClick={() => setDiagram(createEmptyDiagram())} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">New</button>
          <button onClick={exportSVG} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Export SVG</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[380px] border-r bg-white overflow-y-auto p-4">
          <div className="flex border-b mb-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium ${activeTab === tab.id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'title' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500">Drawing Title</label>
                <input type="text" value={diagram.titleBlock.drawingTitle} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, drawingTitle: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Surveyor Name</label>
                <input type="text" value={diagram.titleBlock.surveyorName} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, surveyorName: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Reg No.</label>
                <input type="text" value={diagram.titleBlock.surveyorRegNo} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, surveyorRegNo: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Parcel Ref</label>
                <input type="text" value={diagram.titleBlock.parcelRef || ''} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, parcelRef: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">County</label>
                <input type="text" value={diagram.titleBlock.county} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, county: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Subcounty</label>
                <input type="text" value={diagram.titleBlock.subcounty || ''} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, subcounty: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">UTM Zone</label>
                <input type="text" value={diagram.titleBlock.utmZone} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, utmZone: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Date</label>
                <input type="date" value={diagram.titleBlock.date} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, date: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" />
              </div>
            </div>
          )}

          {activeTab === 'beacons' && (
            <div className="space-y-3">
              <button onClick={addBeacon} className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">+ Add Beacon</button>
              {diagram.beacons.map(beacon => (
                <div key={beacon.id} className="border rounded p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{beacon.id}</span>
                    <button onClick={() => removeBeacon(beacon.id)} className="text-red-500 text-xs">Remove</button>
                  </div>
                  <input type="text" value={beacon.label} onChange={e => updateBeacon(beacon.id, { label: e.target.value })} placeholder="Label" className="w-full px-2 py-1 border rounded text-sm" />
                  <select value={beacon.symbol} onChange={e => updateBeacon(beacon.id, { symbol: e.target.value as BeaconPoint['symbol'] })} className="w-full px-2 py-1 border rounded text-sm">
                    <option value="concrete_beacon">Concrete Beacon</option>
                    <option value="iron_peg">Iron Peg</option>
                    <option value="old_beacon">Old Beacon</option>
                    <option value="reference_mark">Reference Mark</option>
                    <option value="intersection_beacon">Intersection Beacon</option>
                    <option value="nail">Nail</option>
                    <option value="none">None</option>
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" value={beacon.easting || ''} onChange={e => updateBeacon(beacon.id, { easting: parseFloat(e.target.value) })} placeholder="Easting" className="w-full px-2 py-1 border rounded text-sm" />
                    <input type="number" value={beacon.northing || ''} onChange={e => updateBeacon(beacon.id, { northing: parseFloat(e.target.value) })} placeholder="Northing" className="w-full px-2 py-1 border rounded text-sm" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'boundaries' && (
            <div className="space-y-3">
              <button onClick={addBoundary} disabled={diagram.beacons.length < 2} className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300">+ Add Boundary</button>
              {diagram.boundaries.map(boundary => (
                <div key={boundary.id} className="border rounded p-2 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">{boundary.id}</span>
                    <button onClick={() => removeBoundary(boundary.id)} className="text-red-500 text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={boundary.fromBeaconId} onChange={e => updateBoundary(boundary.id, { fromBeaconId: e.target.value })} className="w-full px-2 py-1 border rounded text-sm">
                      {diagram.beacons.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                    <select value={boundary.toBeaconId} onChange={e => updateBoundary(boundary.id, { toBeaconId: e.target.value })} className="w-full px-2 py-1 border rounded text-sm">
                      {diagram.beacons.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                  <input type="text" value={boundary.bearingDMS} onChange={e => updateBoundary(boundary.id, { bearingDMS: e.target.value })} placeholder="0° 00' 00''" className="w-full px-2 py-1 border rounded text-sm" />
                  <input type="number" step="0.01" value={boundary.distanceMeters} onChange={e => updateBoundary(boundary.id, { distanceMeters: parseFloat(e.target.value) })} placeholder="Distance (m)" className="w-full px-2 py-1 border rounded text-sm" />
                  <RoadBoundarySelector value={boundary.boundaryType} onChange={v => updateBoundary(boundary.id, { boundaryType: v })} roadLabel={boundary.roadLabel} onRoadLabelChange={v => updateBoundary(boundary.id, { roadLabel: v })} />
                  <LegacyUnitBadge showLegacy={boundary.showLegacy} onShowLegacyChange={v => updateBoundary(boundary.id, { showLegacy: v })} legacyUnit={boundary.legacyUnit} onLegacyUnitChange={v => updateBoundary(boundary.id, { legacyUnit: v, legacyDistance: metersToLegacy(boundary.distanceMeters, v) })} distanceMeters={boundary.distanceMeters} legacyDistance={boundary.legacyDistance} onLegacyDistanceChange={v => updateBoundary(boundary.id, { legacyDistance: v })} />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'subareas' && (
            <SubAreaPanel subAreas={diagram.subAreas} beacons={diagram.beacons} onAdd={addSubArea} onUpdate={updateSubArea} onRemove={removeSubArea} />
          )}

          {activeTab === 'north' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500">North Bearing</label>
                <input type="text" value={diagram.north.bearing} onChange={e => setDiagram(d => ({ ...d, north: { ...d.north, bearing: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm" placeholder="0° 00' 00''" />
              </div>
              <div>
                <label className="block text-xs text-gray-500">North Type</label>
                <select value={diagram.north.type} onChange={e => setDiagram(d => ({ ...d, north: { ...d.north, type: e.target.value as 'grid' | 'true' | 'magnetic' } }))} className="w-full px-2 py-1 border rounded text-sm">
                  <option value="grid">Grid North</option>
                  <option value="true">True North</option>
                  <option value="magnetic">Magnetic North</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Scale Note</label>
                <select value={diagram.titleBlock.scaleNote} onChange={e => setDiagram(d => ({ ...d, titleBlock: { ...d.titleBlock, scaleNote: e.target.value } }))} className="w-full px-2 py-1 border rounded text-sm">
                  <option value="Dimensions in Metres">Dimensions in Metres</option>
                  <option value="Dimensions in Metres and Perches">Dimensions in Metres and Perches</option>
                  <option value="Dimensions in Metres and Links">Dimensions in Metres and Links</option>
                  <option value="Dimensions in Metres and Chains">Dimensions in Metres and Chains</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-100" ref={svgRef}>
          <div className="bg-white shadow-lg inline-block">
            <DiagramCanvas diagram={diagram} />
          </div>
        </div>
      </div>
    </div>
  )
}
