'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NearbyBeacon {
  id: string
  name: string
  easting: number
  northing: number
  elevation?: number
  beacon_type: string
  authority?: string
  distance: number
}

interface NearbyBeaconsModalProps {
  projectEasting: number
  projectNorthing: number
  projectId: string
  onClose: () => void
}

export default function NearbyBeaconsModal({ 
  projectEasting, 
  projectNorthing, 
  projectId,
  onClose 
}: NearbyBeaconsModalProps) {
  const [beacons, setBeacons] = useState<NearbyBeacon[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBeacon, setSelectedBeacon] = useState<NearbyBeacon | null>(null)

  const supabase = createClient()

  const fetchNearbyBeacons = useCallback(async () => {
    setLoading(true)
    
    const { data, error } = await supabase
      .from('public_beacons')
      .select('*')
      .eq('status', 'verified')
      .limit(20)

    if (data) {
      const withDistance = data.map((b: any) => ({
        ...b,
        distance: Math.sqrt(
          Math.pow(b.easting - projectEasting, 2) + 
          Math.pow(b.northing - projectNorthing, 2)
        )
      })).sort((a: any, b: any) => a.distance - b.distance)

      setBeacons(withDistance)
    }
    
    setLoading(false)
  }, [supabase, projectEasting, projectNorthing])

  useEffect(() => {
    fetchNearbyBeacons()
  }, [fetchNearbyBeacons])

  const handleImport = async () => {
    if (!selectedBeacon) return

    const { error } = await supabase.from('survey_points').insert({
      project_id: projectId,
      name: selectedBeacon.name,
      easting: selectedBeacon.easting,
      northing: selectedBeacon.northing,
      elevation: selectedBeacon.elevation,
      is_control: true,
      control_order: 'primary',
      locked: true
    })

    if (error) {
      alert('Error importing: ' + error.message)
    } else {
      alert('Beacon imported successfully!')
      onClose()
    }
  }

  const getMarkerIcon = (type: string) => {
    const icons: Record<string, string> = {
      trig: '▲',
      control: '●',
      boundary: '■',
      benchmark: '◆',
      gnss: '★'
    }
    return icons[type] || '●'
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] flex">
      <div className="w-96 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Nearby Beacons</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xl">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full"></div>
            </div>
          ) : beacons.length === 0 ? (
            <p className="text-[var(--text-muted)] text-center py-8">No verified beacons found</p>
          ) : (
            <div className="space-y-2">
              {beacons.map((beacon: any) => (
                <button
                  key={beacon.id}
                  onClick={() => setSelectedBeacon(beacon)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedBeacon?.id === beacon.id 
                      ? 'bg-[var(--accent)]/20 border border-[var(--accent)]' 
                      : 'bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text-primary)]">
                      {getMarkerIcon(beacon.beacon_type)} {beacon.name}
                    </span>
                    <span className="text-sm text-[var(--accent)]">
                      {(beacon.distance / 1000).toFixed(1)} km
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-1 capitalize">
                    {beacon.beacon_type} {beacon.authority && `• ${beacon.authority}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedBeacon && (
          <div className="p-4 border-t border-[var(--border-color)]">
            <button
              onClick={handleImport}
              className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg"
            >
              Import to Project
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-[var(--bg-tertiary)] flex items-center justify-center">
          <p className="text-[var(--text-muted)]">Map view would show beacon locations</p>
        </div>
      </div>
    </div>
  )
}
