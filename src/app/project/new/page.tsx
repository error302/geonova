'use client';

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BoundarySelectorMap } from '@/components/project/BoundarySelectorMap'
import { getUTMZoneFromLatLng } from '@/lib/geodesy/utmZones'
import { useCountry, ALL_COUNTRIES } from '@/lib/country'
import type { SurveyingCountry } from '@/lib/country'
import { SURVEY_TYPE_LABELS, SurveyType } from '@/types/project'
import type { ProjectType } from '@/types/scheme'

export default function NewProjectPage() {
  const { country: defaultCountry, setCountry: setContextCountry } = useCountry()
  const router = useRouter()

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<SurveyingCountry>(defaultCountry)
  const [utmZone, setUtmZone] = useState(() => {
    const c = ALL_COUNTRIES.find((c: any) => c.id === defaultCountry)
    return c?.id === 'us' ? '17' : c?.id === 'uk' ? '30' : c?.id === 'australia' ? '51' : '37'
  })
  const [hemisphere, setHemisphere] = useState<'N' | 'S'>('S')
  const [surveyType, setSurveyType] = useState<SurveyType>('topographic')
  const [clientName, setClientName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  
  const [polygonCoordinates, setPolygonCoordinates] = useState<number[][]>([])
  const [estimatedArea, setEstimatedArea] = useState<number | null>(null)

  // Phase 25: Project scale selector
  const [projectType, setProjectType] = useState<ProjectType>('small')
  const [schemeNumber, setSchemeNumber] = useState('')
  const [schemeCounty, setSchemeCounty] = useState('')
  const [schemeSubCounty, setSchemeSubCounty] = useState('')
  const [schemeWard, setSchemeWard] = useState('')
  const [plannedParcels, setPlannedParcels] = useState('')
  const [adjudicationSection, setAdjudicationSection] = useState('')

  const handleCountryChange = (newCountry: SurveyingCountry) => {
    setSelectedCountry(newCountry)
    const zoneMap: Partial<Record<SurveyingCountry, [string, 'N' | 'S']>> = {
      us: ['17', 'N'], uk: ['30', 'N'], australia: ['51', 'S'],
      new_zealand: ['59', 'S'], south_africa: ['35', 'S'],
      bahrain: ['39', 'N'], nigeria: ['31', 'N'], ghana: ['30', 'N'],
      tanzania: ['37', 'S'], uganda: ['36', 'N'], india: ['44', 'N'],
      indonesia: ['48', 'S'], brazil: ['23', 'S'],
      saudi_arabia: ['39', 'N'], oman: ['40', 'N'], uae: ['40', 'N'],
    }
    const [zone, hemi] = zoneMap[newCountry] || ['37', 'S']
    setUtmZone(zone)
    setHemisphere(hemi)
  }

  const detectZoneFromGPS = () => {
    if (!navigator.geolocation) { setError('GPS not supported'); return }
    setDetecting(true); setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { zone, hemisphere: hem, description } = getUTMZoneFromLatLng(pos.coords.latitude, pos.coords.longitude)
        setUtmZone(String(zone)); setHemisphere(hem as 'N' | 'S')
        setDetecting(false)
        setError(`Detected: Zone ${zone}${hem} — ${description}`)
        setTimeout(() => setError(''), 5000)
      },
      () => { setDetecting(false); setError('Could not get location. Check GPS permissions.') }
    )
  }

  const datumLabels: Record<SurveyingCountry, string> = {
    kenya: 'ARC1960', uganda: 'ARC1960', tanzania: 'ARC1960',
    nigeria: 'Minna', ghana: 'Gold Coast 1920', south_africa: 'Hartebeesthoek94',
    bahrain: 'Ain Al-Abd 1970', saudi_arabia: 'IGM 1969', oman: 'OTM / GRS80',
    uae: 'NAD83(CSRS)', new_zealand: 'NZGD2000', us: 'NAD83(2011)',
    uk: 'OSGB36', australia: 'GDA2020', india: 'WGS84', indonesia: 'WGS84',
    brazil: 'WGS84', rwanda: 'ARC1960', burundi: 'ARC1960',
    south_sudan: 'ARC1960', zambia: 'ARC1960', other: 'WGS84',
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload: Record<string, any> = {
        name,
        survey_type: surveyType,
        location,
        utm_zone: parseInt(utmZone) || 37,
        hemisphere,
        project_type: projectType,
        client_name: clientName || undefined,
        surveyor_name: surveyorName || undefined,
        country: selectedCountry,
        datum: datumLabels[selectedCountry],
        boundary: polygonCoordinates.length > 0 ? { type: 'Polygon', coordinates: [polygonCoordinates] } : undefined,
        area_sqm: estimatedArea || undefined,
      }

      if (projectType === 'scheme') {
        Object.assign(payload, {
          scheme_number: schemeNumber || undefined,
          county: schemeCounty || undefined,
          sub_county: schemeSubCounty || undefined,
          ward: schemeWard || undefined,
          planned_parcels: plannedParcels ? parseInt(plannedParcels) : undefined,
          adjudication_section: adjudicationSection || undefined,
        })
      }

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to create project')
        setLoading(false)
        return
      }

      const project = json.data
      setContextCountry(selectedCountry)

      if (projectType === 'scheme') {
        router.push(`/project/${project.id}/scheme`)
      } else {
        router.push(`/project/${project.id}`)
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Network error — please try again')
      setLoading(false)
    }
  }

  const currentCountry = ALL_COUNTRIES.find((c: any) => c.id === selectedCountry)
  const inputClass = 'w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] focus:outline-none transition-colors text-sm'
  const labelClass = 'block text-sm font-medium text-[var(--text-secondary)] mb-1.5'

  const kenyaCounties = [
    'Mombasa','Kilifi','Kwale','Lamu','Tana River','Taita Taveta',
    'Garissa','Wajir','Mandera','Marsabit','Isiolo','Meru',
    'Tharaka Nithi','Embu','Kitui','Machakos','Makueni','Nyandarua',
    'Nyeri','Kirinyaga','Muranga','Kiambu','Turkana','West Pokot',
    'Samburu','Trans Nzoia','Uasin Gishu','Elgeyo Marakwet','Nandi',
    'Baringo','Laikipia','Nakuru','Narok','Kajiado','Kericho',
    'Bomet','Kakamega','Vihiga','Bungoma','Busia','Siaya',
    'Kisumu','Homa Bay','Migori','Kisii','Nyamira','Nairobi',
  ]

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[var(--bg-primary)]">
      <main className="max-w-2xl mx-auto px-4 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
          <Link href="/dashboard" className="hover:text-[var(--accent)] transition-colors">Dashboard</Link>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-[var(--text-primary)]">New Project</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Create New Project</h1>
          <p className="text-sm text-[var(--text-secondary)]">Set up your survey project parameters and coordinate system.</p>

          {/* 1-Click Survey Type Presets */}
          <div className="mt-4 p-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl">
            <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-2">⚡ 1-Click Survey Presets</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSurveyType('cadastral')
                  setProjectType('scheme')
                  setName(name || 'Cadastral Parcel Subdivision')
                }}
                className="px-3 py-2 text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 text-left transition"
              >
                📜 <strong>Cadastral Subdivision</strong>
                <span className="block text-[10px] opacity-70 mt-0.5">Cap 299, Beacon tables, Mutation export</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSurveyType('engineering')
                  setProjectType('medium')
                  setName(name || 'Road Corridor Alignment')
                }}
                className="px-3 py-2 text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 text-left transition"
              >
                🛣️ <strong>Road Engineering</strong>
                <span className="block text-[10px] opacity-70 mt-0.5">RDM 1.3 Curves, Cross-sections, Chainage</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSurveyType('topographic')
                  setProjectType('small')
                  setName(name || 'Topographic Site Survey')
                }}
                className="px-3 py-2 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 text-left transition"
              >
                ⛰️ <strong>Topographic Survey</strong>
                <span className="block text-[10px] opacity-70 mt-0.5">TIN Contours, Point cloud, DXF Plot</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error / Info Banner */}
        {error && (
          <div className={`mb-6 p-3.5 border rounded-lg text-sm flex items-start gap-2 ${
            error.startsWith('Detected')
              ? 'bg-green-900/20 border-green-500/30 text-green-400'
              : 'bg-red-900/20 border-red-500/30 text-red-400'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Project Scale Toggle */}
          <div>
            <label className={labelClass}>Project Scale <span className="text-[var(--accent)]">*</span></label>
            <div className="grid grid-cols-2 gap-0 rounded-lg border border-[var(--border-color)] overflow-hidden">
              <button type="button" onClick={() => setProjectType('small')}
                className={`py-3.5 px-4 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  projectType === 'small'
                    ? 'bg-[var(--accent)] text-black'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <span>Small Project</span>
                <span className="text-[10px] opacity-70">Individual parcel / site</span>
              </button>
              <button type="button" onClick={() => { setProjectType('scheme'); setSurveyType('cadastral') }}
                className={`py-3.5 px-4 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                  projectType === 'scheme'
                    ? 'bg-orange-500 text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span>Scheme / Large Project</span>
                <span className="text-[10px] opacity-70">Subdivision, adjudication</span>
              </button>
            </div>
            {projectType === 'scheme' && (
              <p className="mt-2 text-xs text-orange-400">
                Scheme mode enables blocks, parcel management, batch deed plans, and Registry Index Maps.
              </p>
            )}
          </div>

          {/* Project Name */}
          <div>
            <label className={labelClass}>Project Name <span className="text-[var(--accent)]">*</span></label>
            <input aria-label="Project name" type="text" value={name} onChange={e => setName(e.target.value)}
              className={inputClass} required autoFocus
              placeholder={projectType === 'scheme' ? 'e.g., Mwavumbo Ward Cadastral Subdivision' : 'e.g., Karen Estate Boundary Survey'} />
          </div>

          {/* Interactive Boundary Selector */}
          <div>
            <label className={labelClass}>Project Boundary Map</label>
            <BoundarySelectorMap 
              className="w-full h-64 mb-2"
              onBoundaryChange={(coords, area, center) => {
                setPolygonCoordinates(coords)
                setEstimatedArea(area)
                // Auto-detect UTM zone from drawn center
                const { zone, hemisphere: hem } = getUTMZoneFromLatLng(center[1], center[0])
                setUtmZone(String(zone))
                setHemisphere(hem as 'N' | 'S')
              }}
            />
            {estimatedArea && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Estimated Area: {(estimatedArea / 10000).toFixed(4)} Hectares ({(estimatedArea / 4046.86).toFixed(4)} Acres)
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <label className={labelClass}>Location / Description</label>
            <textarea value={location} onChange={e => setLocation(e.target.value)}
              className={`${inputClass} h-20 resize-none`}
              placeholder={projectType === 'scheme' ? 'e.g., Mariakani, Kilifi County' : 'e.g., Mombasa, along Diani Beach Road'} />
          </div>

          {/* Scheme-specific fields */}
          {projectType === 'scheme' && (
            <div className="p-5 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Scheme Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Scheme Number</label>
                  <input type="text" value={schemeNumber} onChange={e => setSchemeNumber(e.target.value)}
                    className={inputClass} aria-label="e.g., CRS/MWK/001/2026" placeholder="e.g., CRS/MWK/001/2026" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Adjudication Section</label>
                  <input type="text" value={adjudicationSection} onChange={e => setAdjudicationSection(e.target.value)}
                    className={inputClass} aria-label="e.g., Mwavumbo Section" placeholder="e.g., Mwavumbo Section" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">County</label>
                  <select value={schemeCounty} onChange={e => setSchemeCounty(e.target.value)} className={inputClass}>
                    <option value="">Select county</option>
                    {kenyaCounties.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Sub-County</label>
                  <input type="text" value={schemeSubCounty} onChange={e => setSchemeSubCounty(e.target.value)}
                    className={inputClass} aria-label="e.g., Mariakani" placeholder="e.g., Mariakani" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Ward</label>
                  <input type="text" value={schemeWard} onChange={e => setSchemeWard(e.target.value)}
                    className={inputClass} aria-label="e.g., Mwavumbo" placeholder="e.g., Mwavumbo" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Planned Parcels</label>
                <input type="number" value={plannedParcels} onChange={e => setPlannedParcels(e.target.value)}
                  className={inputClass} min={1} aria-label="e.g., 250" placeholder="e.g., 250" />
              </div>
            </div>
          )}

          {/* UTM Zone */}
          <div>
            <label className={labelClass}>UTM Zone (1–60)</label>
            <div className="grid grid-cols-2 gap-4">
              <input aria-label="UTM Zone (1–60)" type="number" value={utmZone} onChange={e => setUtmZone(e.target.value)}
                className={inputClass} min={1} max={60} required />
              <div className="flex rounded-lg border border-[var(--border-color)] overflow-hidden">
                {(['N', 'S'] as const).map(h => (
                  <button key={h} type="button" onClick={() => setHemisphere(h)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      hemisphere === h ? 'bg-[var(--accent)] text-black' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}>
                    {h === 'N' ? <><span className="sm:hidden">N</span><span className="hidden sm:inline">N — Northern</span></> : <><span className="sm:hidden">S</span><span className="hidden sm:inline">S — Southern</span></>}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={detectZoneFromGPS} disabled={detecting}
              className="mt-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] flex items-center gap-1.5 transition-colors disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {detecting ? 'Detecting...' : 'Detect zone from GPS'}
            </button>
          </div>

          {/* Country */}
          <div>
            <label className={labelClass}>Country / Jurisdiction</label>
            <select value={selectedCountry} onChange={e => handleCountryChange(e.target.value as SurveyingCountry)} className={inputClass}>
              {ALL_COUNTRIES.map((c: any) => (
                <option key={c.id} value={c.id}>{c.flag} {c.name}</option>
              ))}
            </select>
            {currentCountry && (
              <div className="mt-2 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]/50 text-xs text-[var(--text-secondary)]">
                Datum: <span className="text-[var(--text-primary)]">{datumLabels[selectedCountry]}</span>
              </div>
            )}
          </div>

          {/* Survey Type */}
          <div>
            <label className={labelClass}>Survey Type</label>
            <select value={surveyType} onChange={e => setSurveyType(e.target.value as SurveyType)} className={inputClass}>
              {(Object.entries(SURVEY_TYPE_LABELS) as [SurveyType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Client + Surveyor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Client Name</label>
              <input type="text" value={clientName} onChange={e => setClientName(e.target.value)}
                className={inputClass} aria-label="e.g., Kilifi County Government" placeholder="e.g., Kilifi County Government" />
            </div>
            <div>
              <label className={labelClass}>Surveyor Name</label>
              <input type="text" value={surveyorName} onChange={e => setSurveyorName(e.target.value)}
                className={inputClass} aria-label="Your name or company" placeholder="Your name or company" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-[var(--border-color)]">
            <Link href="/dashboard"
              className="px-5 py-2.5 text-sm text-[var(--text-secondary)] border border-[var(--border-color)] rounded-lg hover:border-[var(--border-hover)] transition-colors">
              Cancel
            </Link>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 sm:flex-none sm:px-8 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black text-sm font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? 'Creating...' : projectType === 'scheme' ? 'Create Scheme Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
