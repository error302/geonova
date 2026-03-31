'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getUTMZoneFromLatLng } from '@/lib/engine/utmZones'
import { useCountry, ALL_COUNTRIES } from '@/lib/country'
import type { SurveyingCountry } from '@/lib/country'

export default function NewProjectPage() {
  const { country: defaultCountry, setCountry: setContextCountry } = useCountry()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<SurveyingCountry>(defaultCountry)
  const [utmZone, setUtmZone] = useState(() => {
    const c = ALL_COUNTRIES.find(c => c.id === defaultCountry)
    return c ? String(c.id === 'us' ? '17' : c.id === 'uk' ? '30' : c.id === 'australia' ? '51' : 37) : '37'
  })
  const [hemisphere, setHemisphere] = useState('S')
  const [surveyType, setSurveyType] = useState('topographic')
  const [clientName, setClientName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCountryChange = (newCountry: SurveyingCountry) => {
    setSelectedCountry(newCountry)
    const c = ALL_COUNTRIES.find(c => c.id === newCountry)
    if (c) {
      if (c.id === 'us') { setUtmZone('17'); setHemisphere('N') }
      else if (c.id === 'uk') { setUtmZone('30'); setHemisphere('N') }
      else if (c.id === 'australia') { setUtmZone('51'); setHemisphere('S') }
      else if (c.id === 'new_zealand') { setUtmZone('59'); setHemisphere('S') }
      else if (c.id === 'south_africa') { setUtmZone('35'); setHemisphere('S') }
      else if (c.id === 'bahrain') { setUtmZone('39'); setHemisphere('N') }
      else if (c.id === 'nigeria') { setUtmZone('31'); setHemisphere('N') }
      else if (c.id === 'ghana') { setUtmZone('30'); setHemisphere('N') }
      else if (c.id === 'tanzania') { setUtmZone('37'); setHemisphere('S') }
      else if (c.id === 'uganda') { setUtmZone('36'); setHemisphere('N') }
      else if (c.id === 'india') { setUtmZone('44'); setHemisphere('N') }
      else if (c.id === 'indonesia') { setUtmZone('48'); setHemisphere('S') }
      else if (c.id === 'brazil') { setUtmZone('23'); setHemisphere('S') }
      else if (c.id === 'saudi_arabia') { setUtmZone('39'); setHemisphere('N') }
      else if (c.id === 'oman') { setUtmZone('40'); setHemisphere('N') }
      else if (c.id === 'uae') { setUtmZone('40'); setHemisphere('N') }
      else { setUtmZone('37'); setHemisphere('S') }
    }
  }

  const currentCountry = ALL_COUNTRIES.find(c => c.id === selectedCountry)
  const datumLabels: Record<SurveyingCountry, string> = {
    kenya: 'ARC1960',
    uganda: 'ARC1960',
    tanzania: 'ARC1960',
    nigeria: 'Minna',
    ghana: 'Gold Coast 1920',
    south_africa: 'Hartebeesthoek94',
    bahrain: 'Ain Al-Abd 1970',
    saudi_arabia: 'IGM 1969',
    oman: 'OTM / GRS80',
    uae: 'NAD83(CSRS)',
    new_zealand: 'NZGD2000',
    us: 'NAD83(2011)',
    uk: 'OSGB36',
    australia: 'GDA2020',
    india: 'WGS84',
    indonesia: 'WGS84',
    brazil: 'WGS84',
    rwanda: 'ARC1960',
    burundi: 'ARC1960',
    south_sudan: 'ARC1960',
    zambia: 'ARC1960',
    other: 'WGS84',
  }

  const detectZoneFromGPS = () => {
    if (!navigator.geolocation) {
      setError('GPS not supported in your browser')
      return
    }

    setDetecting(true)
    setError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { zone, hemisphere: hem, description } = getUTMZoneFromLatLng(
          pos.coords.latitude,
          pos.coords.longitude
        )
        setUtmZone(String(zone))
        setHemisphere(hem)
        setDetecting(false)
        setError(`✓ Detected: Zone ${zone}${hem} — ${description}`)
        
        setTimeout(() => setError(''), 5000)
      },
      (err) => {
        setDetecting(false)
        setError('Could not get location. Please check GPS permissions.')
      }
    )
  }

  useEffect(() => {
    let mounted = true

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted && session?.user?.email) {
        setSurveyorName(session.user.email)
      }
    }

    void getUser()

    return () => {
      mounted = false
    }
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.replace('/login?next=%2Fproject%2Fnew')
      return
    }

    const { error } = await supabase.from('projects').insert({
      name,
      location,
      utm_zone: parseInt(utmZone),
      hemisphere,
      user_id: user.id,
      survey_type: surveyType,
      client_name: clientName || null,
      surveyor_name: surveyorName || user.email,
      country: selectedCountry,
      datum: datumLabels[selectedCountry],
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setContextCountry(selectedCountry)
      router.push('/dashboard')
    }
  }

  const zoneDescriptions: Record<number, string> = {
    28: 'West Africa',
    29: 'West Africa',
    30: 'West Africa / UK',
    31: 'West Africa / Europe',
    32: 'East Africa / Europe',
    33: 'East Africa / Europe',
    34: 'East Africa / Middle East',
    35: 'East Africa',
    36: 'East Africa / Middle East',
    37: 'East Africa (Kenya, Uganda, Tanzania)',
    38: 'East Africa / Arabia',
    39: 'East Africa / Arabia',
    40: 'East Africa / South Asia',
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-card)]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center">
          <a href="/dashboard" className="text-2xl font-bold text-[var(--accent)]">
            METARDU
          </a>
          <span className="ml-4 text-[var(--text-secondary)]">/ New Project</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Create New Project</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className={`p-3 border rounded text-sm ${
              error.startsWith('✓') 
                ? 'bg-green-900/30 border-green-600 text-green-400'
                : 'bg-red-900/30 border-red-600 text-red-400'
            }`}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Project Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
              required
              placeholder="My Survey Project"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Location / Description</label>
            <textarea
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)] h-24 resize-none"
              placeholder="Project location or description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">UTM Zone (1-60)</label>
              <input
                type="number"
                value={utmZone}
                onChange={(e) => setUtmZone(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                min={1}
                max={60}
                required
              />
              {zoneDescriptions[parseInt(utmZone)] && (
                <p className="text-amber-500 text-xs mt-1">
                  {zoneDescriptions[parseInt(utmZone)]}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Hemisphere</label>
              <select
                value={hemisphere}
                onChange={(e) => setHemisphere(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
              >
                <option value="N">N — Northern</option>
                <option value="S">S — Southern</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={detectZoneFromGPS}
            disabled={detecting}
            className="text-sm text-amber-500 hover:text-amber-400 flex items-center gap-2"
          >
            <span>📍</span>
            {detecting ? 'Detecting...' : 'Detect zone from GPS'}
          </button>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Country / Jurisdiction</label>
            <select
              value={selectedCountry}
              onChange={(e) => handleCountryChange(e.target.value as SurveyingCountry)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
            >
              {ALL_COUNTRIES.map(c => (
                <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
              ))}
            </select>
            {currentCountry && (
              <div className="mt-2 p-2 bg-[var(--bg-tertiary)] rounded text-xs text-[var(--text-secondary)]">
                <span className="text-amber-500 font-medium">{currentCountry.name}</span>
                {' · '}
                <span>Datum: {datumLabels[selectedCountry]}</span>
                {' · '}
                <span>Standard: {selectedCountry === 'kenya' ? 'Kenya Reg 168/1994 (R2024)' : selectedCountry === 'us' ? 'USACE EM 1110-1-1005' : selectedCountry === 'bahrain' ? 'Bahrain CSD 2nd Ed 2024' : selectedCountry === 'saudi_arabia' || selectedCountry === 'oman' || selectedCountry === 'uae' ? 'GCC Cadastral Standard (Bahrain CSD §F framework)' : selectedCountry === 'uk' ? 'RICS / HMLR' : selectedCountry === 'new_zealand' ? 'LINZ Rule 8.2' : 'National Standard'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Survey Type</label>
            <select
              value={surveyType}
              onChange={(e) => setSurveyType(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
            >
              <optgroup label="Boundary Surveys">
                <option value="subdivision">Subdivision</option>
                <option value="amalgamation">Amalgamation</option>
                <option value="resurvey">Boundary Resurvey</option>
                <option value="mutation">Mutation</option>
                <option value="gnss_control">GNSS Control Survey</option>
              </optgroup>
              <optgroup label="Levelling Surveys">
                <option value="differential">Differential Levelling</option>
                <option value="profile">Profile Levelling</option>
                <option value="cross_section">Cross-Section Levelling</option>
                <option value="benchmark_establishment">Benchmark Establishment</option>
                <option value="two_peg_test">Two Peg Test</option>
              </optgroup>
              <optgroup label="Other Surveys">
                <option value="topographic">Topographic Survey</option>
                <option value="mining">Mining Survey</option>
                <option value="hydrographic">Hydrographic Survey</option>
                <option value="drone_uav">Drone / UAV Survey</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                placeholder="e.g., Kenya National Highways Authority"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Surveyor Name</label>
              <input
                type="text"
                value={surveyorName}
                onChange={(e) => setSurveyorName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[var(--accent)] focus:outline-none text-[var(--text-primary)]"
                placeholder="Your name or company"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <a
              href="/dashboard"
              className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded transition-colors"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>

        <div className="mt-12 p-4 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
          <h3 className="text-[var(--text-secondary)] text-sm font-medium mb-3">UTM Zone Reference</h3>
          <div className="grid grid-cols-4 gap-2 text-xs text-[var(--text-muted)]">
            <div><span className="text-amber-500">28-30</span> West Africa</div>
            <div><span className="text-amber-500">31-32</span> Central Africa</div>
            <div><span className="text-amber-500">33-37</span> East Africa</div>
            <div><span className="text-amber-500">37</span> Kenya/Uganda/TZ</div>
            <div><span className="text-amber-500">10-19</span> USA</div>
            <div><span className="text-amber-500">42-46</span> South Asia</div>
            <div><span className="text-amber-500">46-54</span> SE Asia</div>
            <div><span className="text-amber-500">49-56</span> Australia</div>
          </div>
        </div>
      </main>
    </div>
  )
}
