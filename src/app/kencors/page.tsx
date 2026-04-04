'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  STATIONS, NETWORKS, getNearestStations, getCounties, distanceKm,
  CORSStation, NetworkId,
} from '@/lib/integrations/kencors'

// ── helpers ──────────────────────────────────────────────────────────────────

const NETWORK_COLORS: Record<NetworkId, string> = {
  MUYA:    'bg-blue-900/40 text-blue-300 border-blue-700/40',
  AGL:     'bg-green-900/40 text-green-300 border-green-700/40',
  KENCORS: 'bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/30',
  KPLC:    'bg-purple-900/40 text-purple-300 border-purple-700/40',
}

const STATUS_DOT: Record<CORSStation['status'], string> = {
  online:  'bg-green-500',
  offline: 'bg-red-500',
  unknown: 'bg-amber-400',
}

// ── Station card ──────────────────────────────────────────────────────────────

function StationCard({ station, distance, onSelect, selected }: {
  station: CORSStation & { distanceKm?: number }
  distance?: number
  onSelect: () => void
  selected: boolean
}) {
  const net = NETWORKS[station.network]
  return (
    <div onClick={onSelect}
      className={`bg-[var(--bg-card)] border rounded-xl p-4 cursor-pointer transition-colors ${
        selected ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5' : 'border-[var(--border-color)] hover:border-[var(--accent)]/30'
      }`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[station.status]}`} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{station.name}</h3>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${NETWORK_COLORS[station.network]}`}>
          {station.network}
        </span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-2">{station.county} County</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)] font-mono">
          {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
        </span>
        {distance != null && (
          <span className={`font-semibold ${distance < 30 ? 'text-green-400' : distance < 80 ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            {distance.toFixed(0)} km
          </span>
        )}
      </div>
      {station.notes && (
        <p className="text-[10px] text-amber-400 mt-1">{station.notes}</p>
      )}
    </div>
  )
}

// ── Network card ──────────────────────────────────────────────────────────────

function NetworkCard({ net }: { net: typeof NETWORKS[NetworkId] }) {
  const stationCount = STATIONS.filter((s: any) => s.network === net.id).length
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-[var(--text-primary)]">{net.name}</h3>
          <p className="text-xs text-[var(--text-muted)]">{net.operator}</p>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded border ${NETWORK_COLORS[net.id]}`}>
          {stationCount} stations
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        {[
          ['Accuracy', net.accuracy],
          ['Coverage', net.coverage],
          ['Format', net.rtcmFormat],
          ['Mountpoint', net.mountpoint],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-[var(--text-muted)]">{k}</p>
            <p className="text-[var(--text-secondary)] font-medium mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{net.notes}</p>
      <div className="flex gap-2 flex-wrap">
        <a href={net.website} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] hover:underline">
          {net.website.replace('https://', '')} →
        </a>
        {net.contactEmail && (
          <a href={`mailto:${net.contactEmail}`} className="text-xs text-[var(--accent)] hover:underline">
            {net.contactEmail}
          </a>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KenCORSPage() {
  const [filterNetwork, setFilterNetwork] = useState<'' | NetworkId>('')
  const [filterCounty,  setFilterCounty]  = useState('')
  const [search, setSearch]               = useState('')
  const [myLat, setMyLat]   = useState('')
  const [myLon, setMyLon]   = useState('')
  const [locating, setLocating]   = useState(false)
  const [nearestStations, setNearestStations] = useState<(CORSStation & { distanceKm: number })[]>([])
  const [selectedStation, setSelectedStation] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'finder' | 'networks' | 'guide'>('finder')

  const counties = getCounties()

  const findNearest = useCallback(() => {
    const lat = parseFloat(myLat)
    const lon = parseFloat(myLon)
    if (isNaN(lat) || isNaN(lon)) return
    setNearestStations(getNearestStations(lat, lon, 6, filterNetwork || undefined))
  }, [myLat, myLon, filterNetwork])

  useEffect(() => {
    if (myLat && myLon) findNearest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findNearest])

  const detectGPS = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setMyLat(pos.coords.latitude.toFixed(6))
        setMyLon(pos.coords.longitude.toFixed(6))
        setLocating(false)
      },
      () => setLocating(false)
    )
  }

  // Filtered stations for browse tab
  const shownStations = STATIONS.filter((s: any) => {
    if (filterNetwork && s.network !== filterNetwork) return false
    if (filterCounty && s.county !== filterCounty) return false
    if (search) {
      const q = search.toLowerCase()
      return s.name.toLowerCase().includes(q) || s.town.toLowerCase().includes(q) || s.county.toLowerCase().includes(q)
    }
    return true
  })

  const selectedSt = selectedStation ? STATIONS.find((s: any) => s.id === selectedStation) : null

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Kenya CORS Network</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Real-time GNSS corrections via Muya CORS, AGL CORS, and Survey of Kenya KenCORS.
            Find the nearest base station for RTK surveys.
          </p>
        </div>

        {/* Network summary */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {([
            { id: 'MUYA',    label: 'Muya CORS',    count: STATIONS.filter((s: any) =>s.network==='MUYA').length,    color: 'text-blue-400' },
            { id: 'AGL',     label: 'AGL CORS',     count: STATIONS.filter((s: any) =>s.network==='AGL').length,     color: 'text-green-400' },
            { id: 'KENCORS', label: 'KenCORS (SoK)', count: STATIONS.filter((s: any) =>s.network==='KENCORS').length, color: 'text-[var(--accent)]' },
            { id: 'KPLC',    label: 'Kenya Power',  count: '15 pending',  color: 'text-purple-400' },
          ] as const).map((n: any) => (
            <div key={n.id} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-3 text-center">
              <p className={`text-xl font-bold ${n.color}`}>{n.count}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{n.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--bg-secondary)] rounded-xl p-1">
          {([
            { id: 'finder',   label: 'Find nearest station' },
            { id: 'networks', label: 'Network details' },
            { id: 'guide',    label: 'Setup guide' },
          ] as const).map((t: any) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── FINDER TAB ── */}
        {activeTab === 'finder' && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div>
              <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 mb-4">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Your position</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Latitude (decimal °)</label>
                    <input value={myLat} onChange={e => setMyLat(e.target.value)}
                      placeholder="-1.2921" className="input w-full text-sm font-mono" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Longitude (decimal °)</label>
                    <input value={myLon} onChange={e => setMyLon(e.target.value)}
                      placeholder="36.8219" className="input w-full text-sm font-mono" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={detectGPS} disabled={locating}
                    className="flex-1 btn btn-secondary text-sm py-2 flex items-center justify-center gap-2">
                    {locating ? (
                      <div className="w-3.5 h-3.5 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                      </svg>
                    )}
                    Use my GPS
                  </button>
                  <select value={filterNetwork} onChange={e => setFilterNetwork(e.target.value as any)}
                    className="input flex-1 text-sm">
                    <option value="">All networks</option>
                    <option value="MUYA">Muya CORS</option>
                    <option value="AGL">AGL CORS</option>
                    <option value="KENCORS">KenCORS (SoK)</option>
                  </select>
                </div>
              </div>

              {/* Nearest results */}
              {nearestStations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Nearest stations to your position:</p>
                  {nearestStations.map((s: any) => (
                    <StationCard key={s.id} station={s} distance={s.distanceKm}
                      selected={selectedStation === s.id}
                      onSelect={() => setSelectedStation(selectedStation === s.id ? null : s.id)} />
                  ))}
                </div>
              )}

              {!nearestStations.length && (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <input value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search stations…"
                      className="input flex-1 min-w-40 text-sm" />
                    <select value={filterCounty} onChange={e => setFilterCounty(e.target.value)}
                      className="input text-sm">
                      <option value="">All counties</option>
                      {counties.map((c: any) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {shownStations.slice(0, 8).map((s: any) => (
                    <StationCard key={s.id} station={s}
                      distance={myLat && myLon ? distanceKm(parseFloat(myLat), parseFloat(myLon), s.latitude, s.longitude) : undefined}
                      selected={selectedStation === s.id}
                      onSelect={() => setSelectedStation(selectedStation === s.id ? null : s.id)} />
                  ))}
                </div>
              )}
            </div>

            {/* Right: selected station detail or coverage note */}
            <div>
              {selectedSt ? (
                <div className="bg-[var(--bg-card)] border border-[var(--accent)]/30 rounded-xl p-5 sticky top-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-[var(--text-primary)]">{selectedSt.name}</h2>
                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[selectedSt.status]}`} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    {[
                      ['Network', NETWORKS[selectedSt.network].name],
                      ['County', selectedSt.county],
                      ['Latitude', selectedSt.latitude.toFixed(6) + '°'],
                      ['Longitude', selectedSt.longitude.toFixed(6) + '°'],
                      ['Elevation', selectedSt.elevation + ' m (approx.)'],
                      ['Format', NETWORKS[selectedSt.network].rtcmFormat],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs text-[var(--text-muted)]">{k}</p>
                        <p className="text-[var(--text-primary)] font-medium mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-[var(--bg-secondary)] rounded-lg p-3 text-xs text-[var(--text-secondary)] mb-4 leading-relaxed">
                    <strong className="text-[var(--text-primary)]">Connection details</strong><br/>
                    Mountpoint: <code className="text-[var(--accent)]">{NETWORKS[selectedSt.network].mountpoint}</code><br/>
                    Accuracy: {NETWORKS[selectedSt.network].accuracy}<br/>
                    {NETWORKS[selectedSt.network].notes}
                  </div>

                  <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-xs text-amber-400">
                    Exact station coordinates are proprietary. Register with {NETWORKS[selectedSt.network].operator} to receive NTRIP credentials and precise base station positions.
                  </div>

                  <a href={NETWORKS[selectedSt.network].website} target="_blank" rel="noopener noreferrer"
                    className="btn btn-primary w-full mt-3 text-sm text-center block">
                    Register with {NETWORKS[selectedSt.network].name} →
                  </a>
                </div>
              ) : (
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">How to connect</h2>
                  <ol className="space-y-3 text-sm text-[var(--text-secondary)]">
                    {[
                      'Enter your site coordinates or click "Use my GPS" to find the nearest stations',
                      'Choose a network — Muya CORS has the widest coverage (25+ stations)',
                      'Register on the provider website to receive NTRIP credentials',
                      'In your data collector or controller, configure the NTRIP client with: host, port 2101, mountpoint, and your credentials',
                      'Select your coordinate system: WGS84 for direct GPS, or Arc 1960 UTM for Kenya surveys',
                    ].map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 bg-[var(--bg-secondary)] rounded-lg p-3 text-xs text-[var(--text-muted)]">
                    <strong className="text-[var(--text-secondary)]">Standard NTRIP settings:</strong><br/>
                    Host: per provider · Port: 2101 · Protocol: NTRIP v2<br/>
                    Minimum baseline: {'<'} 30 km for {'<'}2 cm accuracy
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NETWORKS TAB ── */}
        {activeTab === 'networks' && (
          <div className="grid md:grid-cols-2 gap-4">
            {Object.values(NETWORKS).map((net: any) => <NetworkCard key={net.id} net={net} />)}
          </div>
        )}

        {/* ── SETUP GUIDE ── */}
        {activeTab === 'guide' && (
          <div className="space-y-5 max-w-3xl">
            {[
              {
                title: 'What is CORS RTK?',
                content: 'A Continuously Operating Reference Station (CORS) is a fixed GNSS receiver that broadcasts real-time corrections to your rover via the internet (NTRIP protocol). Instead of setting up your own base station, you connect to the nearest CORS and achieve centimetre-level positioning.',
              },
              {
                title: 'Coordinate systems in Kenya',
                content: 'Kenya uses Arc 1960 datum (based on Clarke 1880 ellipsoid) projected to UTM zones 36S, 37S, and 36N. Always check your data collector is set to Arc 1960 / UTM (not WGS84 UTM) for surveys that will be submitted to the Land Registry. The two datums differ by up to 200 metres — using the wrong one will cause rejection of your survey plan.',
              },
              {
                title: 'Survey of Kenya requirements',
                content: 'For cadastral surveys (boundary, subdivision), the Survey of Kenya requires that CORS stations used be approved and gazetted. Muya CORS and AGL CORS stations are gazetted. Kenya Power\'s 15 stations are currently undergoing the gazettement process with Survey of Kenya approval expected. Always confirm with your CORS provider that their network is gazetted before using it for formal cadastral work.',
              },
              {
                title: 'Setting up NTRIP in your data collector',
                content: 'Leica Captivate / CS20: Configuration → GNSS Rover → RTK → NTRIP. Trimble Access: Survey styles → Rover → Network Rover → NTRIP. Topcon FC-5000: Config → Network RTK → NTRIP client. Enter host (from your provider), port 2101, your username and password, and select the mountpoint for your area.',
              },
              {
                title: 'Baseline length and accuracy',
                content: 'RTK accuracy degrades with distance from the reference station. For <2 cm horizontal: stay within 30 km. For <5 cm: within 70 km. For baselines over 50 km, consider a VRS (Virtual Reference Station) service or post-processing with RINEX data from the nearest station.',
              },
            ].map(({ title, content }) => (
              <div key={title} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
