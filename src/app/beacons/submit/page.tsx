'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function SubmitBeaconPage() {
  const [form, setForm] = useState({
    name: '',
    easting: '',
    northing: '',
    elevation: '',
    utmZone: '37',
    hemisphere: 'S',
    authority: '',
    beaconType: 'control',
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { error: insertError } = await supabase.from('public_beacons').insert({
        name: form.name,
        easting: parseFloat(form.easting),
        northing: parseFloat(form.northing),
        elevation: form.elevation ? parseFloat(form.elevation) : null,
        utm_zone: parseInt(form.utmZone),
        hemisphere: form.hemisphere,
        authority: form.authority,
        beacon_type: form.beaconType,
        description: form.description,
        submitted_by: user?.id,
        status: 'pending'
      })

      if (insertError) throw insertError

      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Failed to submit beacon')
    }

    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-8 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-400 mb-4">Beacon Submitted!</h1>
          <p className="text-[var(--text-primary)] mb-6">
            Thank you. Your beacon will appear on the map after verification.
          </p>
          <div className="flex gap-3 justify-center">
            <Link 
              href="/beacons" 
              className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg"
            >
              View Beacons Map
            </Link>
            <button 
              onClick={() => { setSuccess(false); setForm({
                name: '', easting: '', northing: '', elevation: '',
                utmZone: '37', hemisphere: 'S', authority: '',
                beaconType: 'control', description: ''
              })}}
              className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] rounded-lg"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/beacons" className="text-[var(--accent)] hover:underline mb-4 inline-block">
          ← Back to Beacons Map
        </Link>
        
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Submit a Beacon</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Share control beacon information with the surveying community
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600 rounded text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Beacon Details</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Beacon Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  placeholder="KWL-102, TRIG-54"
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Beacon Type *</label>
                <select
                  value={form.beaconType}
                  onChange={e => setForm({...form, beaconType: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="trig">Trig Beacon</option>
                  <option value="control">Control Point</option>
                  <option value="boundary">Boundary Mark</option>
                  <option value="benchmark">Benchmark</option>
                  <option value="gnss">GNSS Point</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Authority / Organization</label>
              <select
                value={form.authority}
                onChange={e => setForm({...form, authority: e.target.value})}
                className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              >
                <option value="">Select authority...</option>
                <option value="Survey of Kenya">Survey of Kenya</option>
                <option value="Uganda ULIS">Uganda ULIS</option>
                <option value="Tanzania NBS">Tanzania NBS</option>
                <option value="Private">Private Surveyor</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Coordinates</h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Easting (m) *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={form.easting}
                  onChange={e => setForm({...form, easting: e.target.value})}
                  placeholder="500000.0000"
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] font-mono"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Northing (m) *</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={form.northing}
                  onChange={e => setForm({...form, northing: e.target.value})}
                  placeholder="4500000.0000"
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] font-mono"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Elevation (m)</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.elevation}
                  onChange={e => setForm({...form, elevation: e.target.value})}
                  placeholder="0.000"
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] font-mono"
                />
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">UTM Zone</label>
                <select
                  value={form.utmZone}
                  onChange={e => setForm({...form, utmZone: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  {[35,36,37,38,39,40,41,42,43,44,45,46,47,48].map((z: any) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-2">Hemisphere</label>
                <select
                  value={form.hemisphere}
                  onChange={e => setForm({...form, hemisphere: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
                >
                  <option value="N">Northern</option>
                  <option value="S">Southern</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Additional Information</h2>
            
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-2">Description / Notes</label>
              <textarea
                value={form.description}
                onChange={e => setForm({...form, description: e.target.value})}
                placeholder="Any additional details about this beacon..."
                rows={4}
                className="w-full px-4 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-bold rounded-lg disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Beacon'}
          </button>
        </form>
      </div>
    </div>
  )
}
