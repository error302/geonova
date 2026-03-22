'use client'
import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import UTMZonePicker from '@/components/ui/UTMZonePicker'

export default function ProjectSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params)
  const router = useRouter()
  const supabase = createClient()
  
  const [project, setProject] = useState<any>(null)
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

  useEffect(() => {
    async function loadProject() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()

      if (error || !data) {
        router.push('/dashboard')
        return
      }

      setProject(data)
      setName(data.name || '')
      setLocation(data.location || '')
      setUtmZone(data.utm_zone || 37)
      setHemisphere(data.hemisphere || 'S')
      setSurveyType(data.survey_type || 'topographic')
      setRoadClass(data.road_class || '')
      setTerrainType(data.terrain_type || '')
      setClientName(data.client_name || '')
      setSurveyorName(data.surveyor_name || '')
      setDatum(data.datum || 'ARC1960')
      setLoading(false)
    }

    loadProject()
  }, [projectId, supabase, router])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    const { error } = await supabase
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
      })
      .eq('id', projectId)

    if (error) {
      setMessage('Error: ' + error.message)
    } else {
      setMessage('✓ Project settings saved')
      setTimeout(() => setMessage(''), 3000)
    }

    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return
    }

    const { error } = await supabase
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
            message.startsWith('✓') 
              ? 'bg-green-900/30 text-green-400'
              : 'bg-red-900/30 text-red-400'
          }`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Location</label>
            <textarea
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)] h-24"
            />
          </div>

          <div className="bg-[var(--bg-secondary)] p-4 rounded border border-[var(--border-color)]">
            <label className="block text-sm text-[var(--text-primary)] mb-3">UTM Zone</label>
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
            <label className="block text-sm text-[var(--text-primary)] mb-2">Datum</label>
            <select
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
            <label className="block text-sm text-[var(--text-primary)] mb-2">Survey Type</label>
            <select
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
            <label className="block text-sm text-[var(--text-primary)] mb-2">Road Classification (RDM 1.3)</label>
            <select
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

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Terrain Type</label>
            <select
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Surveyor Name</label>
              <input
                type="text"
                value={surveyorName}
                onChange={(e) => setSurveyorName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded text-[var(--text-primary)]"
              />
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
