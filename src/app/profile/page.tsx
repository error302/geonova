'use client';

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/api-client/client'
import { useRouter } from 'next/navigation'
import { User } from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  country: string
  license_number: string
  firm_name: string
  specializations: string[]
  default_utm_zone: number
  default_hemisphere: string
  preferred_language: string
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [profile, setProfile] = useState<Profile>({
    id: '',
    full_name: '',
    country: '',
    license_number: '',
    firm_name: '',
    specializations: [],
    default_utm_zone: 37,
    default_hemisphere: 'S',
    preferred_language: 'en'
  })

  const router = useRouter()
  const dbClient = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await dbClient.auth.getSession()
      const user = session?.user
      if (!user) {
        window.location.replace('/login?next=%2Fprofile')
        return
      }

      const { data } = await dbClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
                .single() as unknown as { data: Profile | null }

      if (data) {
        setProfile({
          ...(data as Profile),
          specializations: (data as Profile).specializations || []
        })
      } else {
        setProfile(prev => ({ ...prev, id: user.id ?? "" }))
      }
      setLoading(false)
    }

    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    const { data: { session } } = await dbClient.auth.getSession()
    const user = session?.user
    if (!user) return

    const { error } = await dbClient
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: profile.full_name,
        country: profile.country,
        license_number: profile.license_number,
        firm_name: profile.firm_name,
        specializations: profile.specializations,
        default_utm_zone: profile.default_utm_zone,
        default_hemisphere: profile.default_hemisphere,
        preferred_language: profile.preferred_language,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  const toggleSpecialization = (spec: string) => {
    setProfile(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter((s) => s !== spec)
        : [...prev.specializations, spec]
    }))
  }

  const specializations = [
    'Cadastral/Boundary',
    'Topographic',
    'Engineering',
    'Construction',
    'Mining',
    'Hydrographic',
    'GNSS/GPS',
    'Control Networks',
    'Road/Highway',
    'Drones/UAV'
  ]

  const countries = [
    'Kenya', 'Uganda', 'Tanzania', 'Nigeria', 'Ghana', 'South Africa',
    'Ethiopia', 'Rwanda', 'Zambia', 'Zimbabwe', 'Mozambique', 'Egypt',
    'Morocco', 'India', 'Indonesia', 'Brazil', 'Australia', 'United Kingdom',
    'United States', 'Other'
  ]

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'sw', name: 'Kiswahili' },
    { code: 'fr', name: 'Français' },
    { code: 'ar', name: 'العربية' },
    { code: 'pt', name: 'Português' },
    { code: 'es', name: 'Español' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'id', name: 'Bahasa Indonesia' },
    { code: 'am', name: 'አማርኛ' },
    { code: 'ha', name: 'Hausa' }
  ]

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 animate-pulse">
        <div className="h-8 w-36 rounded bg-[var(--bg-tertiary)] mb-8" />
                {Array.from({ length: 5 }, (_, i) => <div key={`${_}-${i}`} className="h-14 rounded-lg bg-[var(--bg-tertiary)] mb-4" />)}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <a href="/dashboard" className="text-2xl font-bold text-[var(--accent)]">
            METARDU
          </a>
          <span className="ml-4 text-[var(--text-secondary)]">/ Profile</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-8 flex items-center gap-2"><User className="w-6 h-6" /> Your Profile</h1>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-full-name" className="block text-sm text-[var(--text-secondary)] mb-2">Full Name</label>
                <input
                  id="profile-full-name"
                  type="text"
                  value={profile.full_name}
                  onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                  className="input w-full"
 placeholder="Enter your full name"
                />
              </div>
              <div>
                <label htmlFor="profile-country" className="block text-sm text-[var(--text-secondary)] mb-2">Country</label>
                <select
                  id="profile-country"
                  value={profile.country}
                  onChange={e => setProfile({ ...profile, country: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select country</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="profile-license" className="block text-sm text-[var(--text-secondary)] mb-2">License Number</label>
                <input
                  id="profile-license"
                  type="text"
                  value={profile.license_number}
                  onChange={e => setProfile({ ...profile, license_number: e.target.value })}
                  className="input w-full"
 placeholder="e.g., LS/12345"
                />
              </div>
              <div>
                <label htmlFor="profile-firm" className="block text-sm text-[var(--text-secondary)] mb-2">Firm/Company Name</label>
                <input
                  id="profile-firm"
                  type="text"
                  value={profile.firm_name}
                  onChange={e => setProfile({ ...profile, firm_name: e.target.value })}
                  className="input w-full"
 placeholder="Survey Associates Ltd"
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Specializations</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {specializations.map((spec: string) => (
                <button
                  key={spec}
                  onClick={() => toggleSpecialization(spec)}
                  className={`px-4 py-2 rounded text-sm text-left transition-colors ${
                    profile.specializations.includes(spec)
                      ? 'bg-[var(--accent)] text-black'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-hover)]'
                  }`}
                >
                  {profile.specializations.includes(spec) ? '' : '○'} {spec}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Default Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="profile-utm" className="block text-sm text-[var(--text-secondary)] mb-2">Default UTM Zone</label>
                <input id="profile-utm"
                  type="number"
                  min={1}
                  max={60}
                  value={profile.default_utm_zone}
                  onChange={e => setProfile({ ...profile, default_utm_zone: parseInt(e.target.value) })}
                  className="input w-full"
                />
              </div>
              <div>
                <label htmlFor="profile-hemisphere" className="block text-sm text-[var(--text-secondary)] mb-2">Hemisphere</label>
                <select
                  id="profile-hemisphere"
                  value={profile.default_hemisphere}
                  onChange={e => setProfile({ ...profile, default_hemisphere: e.target.value })}
                  className="input w-full"
                >
                  <option value="N">Northern</option>
                  <option value="S">Southern</option>
                </select>
              </div>
              <div>
                <label htmlFor="profile-language" className="block text-sm text-[var(--text-secondary)] mb-2">Language</label>
                <select
                  id="profile-language"
                  value={profile.preferred_language}
                  onChange={e => setProfile({ ...profile, preferred_language: e.target.value })}
                  className="input w-full"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
            {saved && (
              <span className="text-green-400 flex items-center">
                 Saved successfully!
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
