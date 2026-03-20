'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getUTMZoneFromLatLng } from '@/lib/engine/utmZones'

export default function NewProjectPage() {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [utmZone, setUtmZone] = useState('37')
  const [hemisphere, setHemisphere] = useState('S')
  const [surveyType, setSurveyType] = useState('topographic')
  const [clientName, setClientName] = useState('')
  const [surveyorName, setSurveyorName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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

  useState(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setSurveyorName(user.email)
      }
    }
    getUser()
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
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
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
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
          <a href="/dashboard" className="text-2xl font-bold" style={{ color: '#E8841A' }}>
            GEONOVA
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
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
              required
              placeholder="My Survey Project"
            />
          </div>

          <div>
            <label className="block text-sm text-[var(--text-primary)] mb-2">Location / Description</label>
            <textarea
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)] h-24 resize-none"
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
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
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
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
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
            <label className="block text-sm text-[var(--text-primary)] mb-2">Survey Type</label>
            <select
              value={surveyType}
              onChange={(e) => setSurveyType(e.target.value)}
              className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
            >
              <option value="boundary">Boundary Survey</option>
              <option value="topographic">Topographic Survey</option>
              <option value="road">Road Survey</option>
              <option value="construction">Construction Survey</option>
              <option value="control">Control Network</option>
              <option value="leveling">Leveling Survey</option>
              <option value="mining">Mining Survey</option>
              <option value="hydrographic">Hydrographic Survey</option>
              <option value="drone">Drone/UAV Survey</option>
              <option value="gnss">GNSS Survey</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Client Name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
                placeholder="e.g., Kenya National Highways Authority"
              />
            </div>

            <div>
              <label className="block text-sm text-[var(--text-primary)] mb-2">Surveyor Name</label>
              <input
                type="text"
                value={surveyorName}
                onChange={(e) => setSurveyorName(e.target.value)}
                className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded focus:border-[#E8841A] focus:outline-none text-[var(--text-primary)]"
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
              className="flex-1 py-3 bg-[#E8841A] hover:bg-[#d67715] text-black font-semibold rounded transition-colors disabled:opacity-50"
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
