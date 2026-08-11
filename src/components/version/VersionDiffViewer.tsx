'use client';

/**
 * VersionDiffViewer — visual comparison of two survey plan versions
 *
 * Shows side-by-side:
 * - Beacon coordinate changes (highlighted in red/green)
 * - Boundary bearing/distance changes
 * - Area changes
 * - Metadata changes (LR number, client, etc.)
 *
 * The surveyor can see exactly what changed between revisions
 * and restore a previous version with one click.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RotateCcw, GitCompare, ArrowRight, Check } from 'lucide-react'
import { logger } from '@/lib/logger'

interface VersionData {
  version: number
  createdAt: string
  createdBy: string
  data: {
    beacons?: Array<{ id: string; label: string; easting: number; northing: number }>
    boundaries?: Array<{ id: string; fromId: string; toId: string; bearing: string; distance: string }>
    area?: number
    lrNumber?: string
    clientName?: string
  }
}

interface DiffResult {
  beaconChanges: Array<{
    id: string; label: string
    oldEasting?: number; newEasting?: number
    oldNorthing?: number; newNorthing?: number
    deltaE: number; deltaN: number
    status: 'added' | 'removed' | 'moved' | 'unchanged'
  }>
  boundaryChanges: Array<{
    id: string
    oldBearing?: string; newBearing?: string
    oldDistance?: string; newDistance?: string
    status: 'added' | 'removed' | 'changed' | 'unchanged'
  }>
  metadataChanges: Array<{ field: string; oldValue: string; newValue: string }>
  areaChange: { old: number; new: number; delta: number }
}

interface VersionDiffViewerProps {
  entityType: string
  entityId: string
  onRestore?: (version: number) => void
}

export function VersionDiffViewer({ entityType, entityId, onRestore }: VersionDiffViewerProps) {
  const [versions, setVersions] = useState<VersionData[]>([])
  const [selectedOld, setSelectedOld] = useState<number | null>(null)
  const [selectedNew, setSelectedNew] = useState<number | null>(null)
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadVersions() {
      try {
        const res = await fetch(`/api/versions?entity_type=${entityType}&entity_id=${entityId}&limit=50`)
        const data = (await res.json()) as { data?: VersionData[] }
        if (data.data) {
          setVersions(data.data)
          if (data.data.length >= 2) {
            setSelectedOld(data.data[data.data.length - 2].version)
            setSelectedNew(data.data[data.data.length - 1].version)
          }
        }
      } catch (err) {
        logger.error('Failed to load versions:', { error: err })
      } finally {
        setLoading(false)
      }
    }
    loadVersions()
  }, [entityType, entityId])

  useEffect(() => {
    if (selectedOld === null || selectedNew === null) return
    const oldVer = versions.find(v => v.version === selectedOld)
    const newVer = versions.find(v => v.version === selectedNew)
    if (!oldVer || !newVer) return
    setDiff(computeDiff(oldVer, newVer))
  }, [selectedOld, selectedNew, versions])

  const handleRestore = useCallback(() => {
    if (selectedOld !== null && onRestore) onRestore(selectedOld)
  }, [selectedOld, onRestore])

  if (loading) return <div className="text-sm text-gray-500 p-4">Loading version history...</div>

  if (versions.length < 2) {
    return (
      <div className="text-sm text-gray-500 p-4 text-center">
        <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-30" />
        Need at least 2 versions to compare. Current: {versions.length} version(s).
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={selectedOld ?? ''} onChange={(e) => setSelectedOld(Number(e.target.value))} className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-700">
          {versions.map(v => <option key={v.version} value={v.version}>v{v.version} — {new Date(v.createdAt).toLocaleDateString()}</option>)}
        </select>
        <ArrowRight className="w-4 h-4 text-gray-500" />
        <select value={selectedNew ?? ''} onChange={(e) => setSelectedNew(Number(e.target.value))} className="bg-gray-800 text-white text-xs rounded px-2 py-1 border border-gray-700">
          {versions.map(v => <option key={v.version} value={v.version}>v{v.version} — {new Date(v.createdAt).toLocaleDateString()}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={handleRestore} className="text-xs ml-auto">
          <RotateCcw className="w-3 h-3 mr-1" /> Restore v{selectedOld}
        </Button>
      </div>

      {diff && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Badge variant={diff.beaconChanges.filter(c => c.status !== 'unchanged').length > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {diff.beaconChanges.filter(c => c.status === 'moved').length} moved beacons
            </Badge>
            <Badge variant={diff.metadataChanges.length > 0 ? 'destructive' : 'secondary'} className="text-xs">
              {diff.metadataChanges.length} metadata changes
            </Badge>
            <Badge variant="outline" className="text-xs">
              Area: {diff.areaChange.old.toFixed(4)} → {diff.areaChange.new.toFixed(4)} ha ({diff.areaChange.delta > 0 ? '+' : ''}{diff.areaChange.delta.toFixed(6)})
            </Badge>
          </div>

          {diff.beaconChanges.filter(c => c.status !== 'unchanged').length > 0 && (
            <Card className="p-3 bg-gray-900 border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Beacon Changes</h3>
              <table className="w-full text-xs">
                <thead><tr className="text-gray-500 border-b border-gray-700">
                  <th className="text-left py-1">Beacon</th><th className="text-right">Old E</th><th className="text-right">New E</th><th className="text-right">ΔE</th><th className="text-right">Old N</th><th className="text-right">New N</th><th className="text-right">ΔN</th><th className="text-center">Status</th>
                </tr></thead>
                <tbody>
                  {diff.beaconChanges.filter(c => c.status !== 'unchanged').map(c => (
                    <tr key={c.id} className="border-b border-gray-800">
                      <td className="py-1 font-mono">{c.label}</td>
                      <td className="text-right text-gray-500">{c.oldEasting?.toFixed(3) ?? '—'}</td>
                      <td className="text-right text-gray-300">{c.newEasting?.toFixed(3) ?? '—'}</td>
                      <td className={`text-right ${c.deltaE !== 0 ? 'text-yellow-400' : 'text-gray-600'}`}>{c.deltaE !== 0 ? `${c.deltaE > 0 ? '+' : ''}${c.deltaE.toFixed(3)}` : '—'}</td>
                      <td className="text-right text-gray-500">{c.oldNorthing?.toFixed(3) ?? '—'}</td>
                      <td className="text-right text-gray-300">{c.newNorthing?.toFixed(3) ?? '—'}</td>
                      <td className={`text-right ${c.deltaN !== 0 ? 'text-yellow-400' : 'text-gray-600'}`}>{c.deltaN !== 0 ? `${c.deltaN > 0 ? '+' : ''}${c.deltaN.toFixed(3)}` : '—'}</td>
                      <td className="text-center">{c.status === 'added' && <span className="text-green-400">+added</span>}{c.status === 'removed' && <span className="text-red-400">-removed</span>}{c.status === 'moved' && <span className="text-yellow-400">→moved</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {diff.metadataChanges.length > 0 && (
            <Card className="p-3 bg-gray-900 border-gray-800">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Metadata Changes</h3>
              <div className="space-y-1">
                {diff.metadataChanges.map((c, i) => (
                  <div key={c.field} className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500 w-32">{c.field}:</span>
                    <span className="text-red-400 line-through">{c.oldValue || '—'}</span>
                    <ArrowRight className="w-3 h-3 text-gray-600" />
                    <span className="text-green-400">{c.newValue || '—'}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {diff.beaconChanges.every(c => c.status === 'unchanged') && diff.metadataChanges.length === 0 && diff.areaChange.delta === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <Check className="w-8 h-8 mx-auto mb-2 text-green-500" />
              No changes between these versions.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function computeDiff(oldVer: VersionData, newVer: VersionData): DiffResult {
  const oldBeacons = oldVer.data.beacons ?? []
  const newBeacons = newVer.data.beacons ?? []
  const oldMap = new Map(oldBeacons.map(b => [b.id, b]))
  const newMap = new Map(newBeacons.map(b => [b.id, b]))
  const beaconChanges: DiffResult['beaconChanges'] = []
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()])
  for (const id of allIds) {
    const old = oldMap.get(id); const nw = newMap.get(id)
    if (!old && nw) beaconChanges.push({ id, label: nw.label, newEasting: nw.easting, newNorthing: nw.northing, deltaE: 0, deltaN: 0, status: 'added' })
    else if (old && !nw) beaconChanges.push({ id, label: old.label, oldEasting: old.easting, oldNorthing: old.northing, deltaE: 0, deltaN: 0, status: 'removed' })
    else if (old && nw) {
      const dE = nw.easting - old.easting; const dN = nw.northing - old.northing
      beaconChanges.push({ id, label: nw.label, oldEasting: old.easting, newEasting: nw.easting, oldNorthing: old.northing, newNorthing: nw.northing, deltaE: dE, deltaN: dN, status: Math.abs(dE) > 0.001 || Math.abs(dN) > 0.001 ? 'moved' : 'unchanged' })
    }
  }
  const oldBoundaries = oldVer.data.boundaries ?? []
  const newBoundaries = newVer.data.boundaries ?? []
  const oldBMap = new Map(oldBoundaries.map(b => [b.id, b]))
  const newBMap = new Map(newBoundaries.map(b => [b.id, b]))
  const boundaryChanges: DiffResult['boundaryChanges'] = []
  for (const id of new Set([...oldBMap.keys(), ...newBMap.keys()])) {
    const old = oldBMap.get(id); const nw = newBMap.get(id)
    if (!old && nw) boundaryChanges.push({ id, newBearing: nw.bearing, newDistance: nw.distance, status: 'added' })
    else if (old && !nw) boundaryChanges.push({ id, oldBearing: old.bearing, oldDistance: old.distance, status: 'removed' })
    else if (old && nw) boundaryChanges.push({ id, oldBearing: old.bearing, newBearing: nw.bearing, oldDistance: old.distance, newDistance: nw.distance, status: old.bearing !== nw.bearing || old.distance !== nw.distance ? 'changed' : 'unchanged' })
  }
  const metadataChanges: DiffResult['metadataChanges'] = []
  if (oldVer.data.lrNumber !== newVer.data.lrNumber) metadataChanges.push({ field: 'LR Number', oldValue: oldVer.data.lrNumber ?? '', newValue: newVer.data.lrNumber ?? '' })
  if (oldVer.data.clientName !== newVer.data.clientName) metadataChanges.push({ field: 'Client', oldValue: oldVer.data.clientName ?? '', newValue: newVer.data.clientName ?? '' })
  return { beaconChanges, boundaryChanges, metadataChanges, areaChange: { old: oldVer.data.area ?? 0, new: newVer.data.area ?? 0, delta: (newVer.data.area ?? 0) - (oldVer.data.area ?? 0) } }
}
