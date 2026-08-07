'use client';
import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/api-client/client'
import { useRouter } from 'next/navigation'
import UTMZonePicker from '@/components/ui/UTMZonePicker'
import { computeTraverseAccuracy, getAccuracyBadgeLabel, getAccuracyBadgeClass } from '@/lib/reports/traverseAccuracy'

interface ProjectSettingsRow {
  name?: string | null
  location?: string | null
  utm_zone?: number | null
  hemisphere?: string | null
  survey_type?: string | null
  road_class?: string | null
  terrain_type?: string | null
  client_name?: string | null
  surveyor_name?: string | null
  datum?: string | null
  traverse?: { linearError?: number | null }
  road_name?: string | null
  start_chainage?: number | null
  folio_number?: string | null
  register_number?: string | null
  lr_number?: string | null
  plot_parcel_number?: string | null
  registration_district?: string | null
  locality?: string | null
}

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const dbClient = createClient()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [utmZone, setUtmZone] = useState(37)
  const [hemisphere, setHemisphere] = useState<'N' | 'S'>('S')
  const [surveyType, setSurveyType] = useState('')
  const [roadClass, setRoadClass] = useState('')
  const [terrainType, setTerrainType] = useState('')
  const [datum, setDatum] = useState<'ARC1960' | 'WGS84' | 'WGS84Geographic'>('ARC1960')
  const [clientName, setClientName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [linearError, setLinearError] = useState('')
  const [roadName, setRoadName] = useState('')
  const [startChainage, setStartChainage] = useState('')
  
  // Form No. 4 / Kenya submission fields
  const [folioNumber, setFolioNumber] = useState('')
  const [registerNumber, setRegisterNumber] = useState('')
  const [lrNumber, setLrNumber] = useState('')
  const [plotParcelNumber, setPlotParcelNumber] = useState('')
  const [registrationDistrict, setRegistrationDistrict] = useState('')
  const [locality, setLocality] = useState('')

  useEffect(() => {
    async function loadProject() {
      const { data, error } = (await dbClient
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()) as { data: ProjectSettingsRow | null; error: { message: string; code: string; details?: string } | null }

      if (error || !data) {
        router.push('/dashboard')
        return
      }

      setName(data.name || '')
      setLocation(data.location || '')
      setUtmZone(data.utm_zone || 37)
      setHemisphere((data.hemisphere as 'N' | 'S') || 'S')
      setSurveyType(data.survey_type || 'topographic')
      setRoadClass(data.road_class || '')
      setTerrainType(data.terrain_type || '')
      setClientName(data.client_name || '')
      setSurveyorName(data.surveyor_name || '')
      setDatum((data.datum as 'ARC1960' | 'WGS84' | 'WGS84Geographic') || 'ARC1960')
      setLinearError(data.traverse?.linearError !== undefined ? String(data.traverse.linearError) : '')
      setRoadName(data.road_name || '')
      setStartChainage(data.start_chainage !== undefined ? String(data.start_chainage) : '')
      setFolioNumber(data.folio_number || '')
      setRegisterNumber(data.register_number || '')
      setLrNumber(data.lr_number || '')
      setPlotParcelNumber(data.plot_parcel_number || '')
      setRegistrationDistrict(data.registration_district || '')
      setLocality(data.locality || '')
      setLoading(false)
    }

    loadProject()
  }, [projectId, dbClient, router])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const { error } = await dbClient
      .from('projects')
      .update({
        name,
        location,
        utm_zone: utmZone,
        hemisphere,
        survey_type: surveyType,
        road_class: roadClass || null,
        terrain_type: terrainType || null,
        client_name: clientName || null,
        surveyor_name: surveyorName || null,
        datum,
        traverse: { linearError: parseFloat(linearError) || 0 },
        road_name: roadName || null,
        start_chainage: parseFloat(startChainage) || 0,
        folio_number: folioNumber || null,
        register_number: registerNumber || null,
        lr_number: lrNumber || null,
        plot_parcel_number: plotParcelNumber || null,
        registration_district: registrationDistrict || null,
        locality: locality || null,
      })
      .eq('id', projectId)

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage(' Project settings saved')
      setTimeout(() => setMessage(''), 3000)
    }

    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return
    }

    const { error } = await dbClient
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      router.push('/dashboard')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-amber-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12">
      <div className="max-w-2xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-8">
          <a href={`/project/${projectId}`} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            ← Back to Project
          </a>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8">Project Settings</h1>

        {message && (
          <div className={`p-3 rounded mb-6 ${
            message.startsWith('') 
              ? 'bg-green-900/30 text-green-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label htmlFor="projectName" className="block text-sm text-[var(--text-primary)] mb-2">Project Name</label>
            <input id="projectName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label htmlFor="location" className="block text-sm text-[var(--text-primary)] mb-2">Location</label>
            <textarea
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] h-24"
            />
          </div>

          <div className="bg-[var(--bg-secondary)] p-4 rounded border border-[var(--border-color)]">
            <div className="block text-sm text-[var(--text-primary)] mb-3">UTM Zone</div>
            <UTMZonePicker
              value={utmZone}
              hemisphere={hemisphere}
              onChange={(zone, hem) => {
                setUtmZone(zone)
                setHemisphere(hem)
              }}
            />
          </div>

          <div>
            <label htmlFor="datum" className="block text-sm text-[var(--text-primary)] mb-2">Datum</label>
            <select
              id="datum"
              value={datum}
              onChange={(e) => setDatum(e.target.value as 'ARC1960' | 'WGS84' | 'WGS84Geographic')}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            >
              <option value="ARC1960">ARC1960 / UTM Zone 37S (EPSG:21037) — Kenya Default</option>
              <option value="WGS84">WGS84 / UTM Zone 37S</option>
              <option value="WGS84Geographic">WGS84 Geographic</option>
            </select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">ARC1960 required for KeNHA submissions per RDM 1.1 §5.2</p>
          </div>

          <div>
            <label htmlFor="surveyType" className="block text-sm text-[var(--text-primary)] mb-2">Survey Type</label>
            <select
              id="surveyType"
              value={surveyType}
              onChange={(e) => setSurveyType(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            >
              <option value="boundary">Boundary Survey</option>
              <option value="topographic">Topographic Survey</option>
              <option value="road">Road Survey</option>
              <option value="construction">Construction Survey</option>
              <option value="control">Control Network</option>
              <option value="leveling">Leveling Survey</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="roadClass" className="block text-sm text-[var(--text-primary)] mb-2">Road Classification (RDM 1.3)</label>
            <select
              id="roadClass"
              value={roadClass}
              onChange={(e) => setRoadClass(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            >
              <option value="">Select road class...</option>
              <optgroup label="Rural">
                <option value="S">S — Motorway (100m+ reserve)</option>
                <option value="A">A — Major Arterial / International (60–120m)</option>
                <option value="B">B — Minor Arterial / National Trunk (60–80m)</option>
                <option value="C">C — Major Collector / Inter-District (40–60m)</option>
                <option value="D">D — Minor Collector / Divisional (30–40m)</option>
                <option value="E">E — Major Local / Feeder (25–30m)</option>
                <option value="F">F — Minor Local (20–25m)</option>
                <option value="G">G — Local Access / Farm to Market (15–20m)</option>
              </optgroup>
              <optgroup label="Urban">
                <option value="H">H — Major Arterial / Urban Highway (60–80m)</option>
                <option value="J">J — Minor Arterial (40–60m)</option>
                <option value="K">K — Major Collector (30–40m)</option>
                <option value="L">L — Minor Collector (20–30m)</option>
                <option value="M">M — Major Local / Shopping Street (20–25m)</option>
                <option value="N">N — Minor Local / Non-Residential (15–20m)</option>
                <option value="P">P — Local Access / Residential (10–15m)</option>
              </optgroup>
            </select>
          </div>

          {roadClass && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="roadName" className="block text-sm text-[var(--text-primary)] mb-2">Road Name</label>
                <input
                  id="roadName"
                  type="text"
                  value={roadName}
                  onChange={(e) => setRoadName(e.target.value)}
                  placeholder="e.g. Nairobi–Mombasa Road"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label htmlFor="startChainage" className="block text-sm text-[var(--text-primary)] mb-2">Start Chainage (m)</label>
                <input
                  id="startChainage"
                  type="number"
                  value={startChainage}
                  onChange={(e) => setStartChainage(e.target.value)}
                  placeholder="e.g. 0 or 5000"
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                />
                <p className="text-xs text-[var(--text-secondary)] mt-1">km+m format: 5000m = 5+000</p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="terrainType" className="block text-sm text-[var(--text-primary)] mb-2">Terrain Type</label>
            <select
              id="terrainType"
              value={terrainType}
              onChange={(e) => setTerrainType(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            >
              <option value="">Select terrain...</option>
              <option value="flat">Flat</option>
              <option value="rolling">Rolling</option>
              <option value="mountainous">Mountainous</option>
              <option value="escarpment">Escarpment</option>
            </select>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Used for road geometric validation per RDM 1.3</p>
          </div>

          <div>
            <label htmlFor="linearError" className="block text-sm text-[var(--text-primary)] mb-2">Traverse Linear Closure Error (m)</label>
            <input
              id="linearError"
              type="number"
              step="0.001"
              value={linearError}
              onChange={(e) => setLinearError(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              placeholder="e.g. 0.001"
            />
            <p className="text-xs text-[var(--text-secondary)] mt-1">Used to compute C=m√K accuracy classification per RDM 1.1</p>
            {linearError && (
              (() => {
                const acc = computeTraverseAccuracy(parseFloat(linearError), 1000)
                return acc ? (
                  <div className={`mt-2 px-3 py-1.5 rounded text-xs font-bold inline-block ${getAccuracyBadgeClass(acc)}`}>
                    {getAccuracyBadgeLabel(acc)} — C={acc.C_mm.toFixed(2)}mm, K=1.00km
                  </div>
                ) : null
              })()
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="clientName" className="block text-sm text-[var(--text-primary)] mb-2">Client Name</label>
              <input id="clientName"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="surveyorName" className="block text-sm text-[var(--text-primary)] mb-2">Surveyor Name</label>
              <input id="surveyorName"
                type="text"
                value={surveyorName}
                onChange={(e) => setSurveyorName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Form No. 4 / Kenya Submission Fields */}
          <div className="border-t border-[var(--border-color)] pt-6 mt-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Form No. 4 — Kenya Submission</h3>
            <p className="text-xs text-[var(--text-secondary)] mb-4">These fields appear on the Survey Plan / Form No. 4 for official submissions.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="lrNumber" className="block text-sm text-[var(--text-primary)] mb-2">LR Number</label>
                <input
                  id="lrNumber"
                  type="text"
                  value={lrNumber}
                  onChange={(e) => setLrNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="LR 12345"
                />
              </div>
              <div>
                <label htmlFor="folioNumber" className="block text-sm text-[var(--text-primary)] mb-2">Folio Number</label>
                <input
                  id="folioNumber"
                  type="text"
                  value={folioNumber}
                  onChange={(e) => setFolioNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="Folio/2024/001"
                />
              </div>
              <div>
                <label htmlFor="registerNumber" className="block text-sm text-[var(--text-primary)] mb-2">Register Number</label>
                <input
                  id="registerNumber"
                  type="text"
                  value={registerNumber}
                  onChange={(e) => setRegisterNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="REG/001"
                />
              </div>
              <div>
                <label htmlFor="plotParcelNumber" className="block text-sm text-[var(--text-primary)] mb-2">Plot/Parcel Number</label>
                <input
                  id="plotParcelNumber"
                  type="text"
                  value={plotParcelNumber}
                  onChange={(e) => setPlotParcelNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="Plot 45"
                />
              </div>
              <div>
                <label htmlFor="registrationDistrict" className="block text-sm text-[var(--text-primary)] mb-2">Registration District</label>
                <input
                  id="registrationDistrict"
                  type="text"
                  value={registrationDistrict}
                  onChange={(e) => setRegistrationDistrict(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="Nairobi"
                />
              </div>
              <div>
                <label htmlFor="locality" className="block text-sm text-[var(--text-primary)] mb-2">Locality</label>
                <input
                  id="locality"
                  type="text"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
                  placeholder="Karen"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-3 bg-amber-500 text-black font-bold rounded hover:bg-amber-400 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleDelete}
              className="px-6 py-3 border border-red-500 text-red-500 font-bold rounded hover:bg-red-500/10"
            >
              Delete Project
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
