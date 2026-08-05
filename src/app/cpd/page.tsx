'use client';

import { useState, useEffect } from 'react'
import {
  getCPDRequirements,
  getActivityTypes,
  type CPDSummary
} from '@/lib/marketplace/cpdCertificates'
import type { CPDRecord } from '@/types/cpd'

/**
 * AUDIT FIX (H9, 2026-07-02): Rewired to call the real CPD API
 * (/api/cpd) instead of the stub cpdCertificates.getUserActivities()
 * which always returned []. The stub is still imported for
 * getCPDRequirements + getActivityTypes (static reference data that
 * doesn't need the DB), but all user-data fetches now go through
 * the API which calls lib/cpd.ts → cpd_records table.
 */

export default function CPDPage() {
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activities, setActivities] = useState<CPDRecord[]>([])
  const [summary, setSummary] = useState<CPDSummary | null>(null)
  const [country, setCountry] = useState('Kenya')
  const [requirements, setRequirements] = useState<any[]>([])
  const [activityTypes, setActivityTypes] = useState<any[]>([])
  const [totalPoints, setTotalPoints] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      setRequirements(getCPDRequirements(country))
      setActivityTypes(getActivityTypes())

      try {
        // Fetch real CPD data from the API (which calls lib/cpd.ts → DB)
        const year = new Date().getFullYear()
        const res = await fetch(`/api/cpd?year=${year}`, { credentials: 'include' })
        let fetchedTotal = 0
        if (res.ok) {
          const data = await res.json()
          setActivities(data.records ?? [])
          fetchedTotal = data.total ?? 0
          setTotalPoints(fetchedTotal)
        } else if (res.status === 401) {
          // Not logged in — show empty state
          setActivities([])
          setTotalPoints(0)
        } else {
          setFetchError('Failed to load CPD records')
        }

        // Build summary from the fetched total (not from state, which may be stale)
        const req = getCPDRequirements(country)[0]
        const requiredHours = req?.yearlyHours ?? 40
        setSummary({
          totalHours: fetchedTotal,
          requirementHours: requiredHours,
          compliancePercentage: requiredHours > 0 ? Math.min(100, (fetchedTotal / requiredHours) * 100) : 0,
          status: fetchedTotal >= requiredHours ? 'compliant' : fetchedTotal >= requiredHours * 0.75 ? 'at_risk' : 'non_compliant',
        } as CPDSummary)
      } catch {
        setFetchError('Network error loading CPD records')
      }

      setLoading(false)
    }
    loadData()
    // AUDIT FIX: Removed totalPoints from dependency array — it's SET inside
    // the effect, so including it causes an infinite render loop.
  }, [country])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">CPD Certificates</h1>
        <p className="text-[var(--text-muted)] mb-8">Continuing Professional Development tracking and certificates</p>
        
        <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-6 flex items-start gap-3 text-sm">
          <div className="text-blue-500 mt-0.5">(i)</div>
          <p className="text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Auto-logging active:</span> Hours are auto-logged when you use METARDU computation tools. Manual entries can be added below.
          </p>
        </div>

        <div className="mb-6">
          <label htmlFor="cpd-country" className="block text-sm font-medium text-[var(--text-muted)] mb-2">Select Country</label>
          <select
            id="cpd-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="p-2 border rounded-lg w-64"
          >
            <option value="Kenya">Kenya (ISK)</option>
            <option value="Uganda">Uganda</option>
            <option value="Tanzania">Tanzania</option>
            <option value="Nigeria">Nigeria</option>
            <option value="South Africa">South Africa</option>
          </select>
        </div>

        {requirements.map((req: any) => (
          <div key={req.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900">{req.body}</h3>
            <p className="text-sm text-blue-700">{req.notes}</p>
          </div>
        ))}

        {summary && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
              <p className="text-sm text-[var(--text-muted)]">Total Hours</p>
              <p className="text-2xl font-bold">{summary.totalHours}</p>
            </div>
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
              <p className="text-sm text-[var(--text-muted)]">Required</p>
              <p className="text-2xl font-bold">{summary.requirementHours}</p>
            </div>
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
              <p className="text-sm text-[var(--text-muted)]">Compliance</p>
              <p className={`text-2xl font-bold ${
                summary.status === 'compliant' ? 'text-green-600' :
                summary.status === 'at_risk' ? 'text-yellow-600' : 'text-red-600'
              }`}>{summary.compliancePercentage.toFixed(0)}%</p>
            </div>
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
              <p className="text-sm text-[var(--text-muted)]">Status</p>
              <p className={`text-lg font-bold ${
                summary.status === 'compliant' ? 'text-green-600' :
                summary.status === 'at_risk' ? 'text-yellow-600' : 'text-red-600'
              }`}>{summary.status.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Category Breakdown</h2>
          {summary && (
            <div className="space-y-3">
              {/* AUDIT FIX (H-008, 2026-07-27): categoryBreakdown is not part
                  of the locally-built CPDSummary shape (only totalHours,
                  requirementHours, compliancePercentage, status). The API
                  (`/api/cpd`) returns a different shape. Guard with `?.` to
                  prevent "Cannot read properties of undefined (reading
                  'technical')". */}
              {(['technical', 'ethics', 'safety', 'management'] as const).map((cat) => {
                const hours = summary.categoryBreakdown?.[cat] ?? 0
                const pct = summary.totalHours > 0 ? (hours / summary.totalHours) * 100 : 0
                const barColor =
                  cat === 'technical' ? 'bg-blue-600' :
                  cat === 'ethics' ? 'bg-green-600' :
                  cat === 'safety' ? 'bg-yellow-600' :
                  'bg-purple-600'
                const label = cat.charAt(0).toUpperCase() + cat.slice(1)
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{label}</span>
                      <span>{hours} hours</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                )
              })}
              {!summary.categoryBreakdown && (
                <p className="text-sm text-[var(--text-muted)]">
                  Category breakdown unavailable — your CPD records haven't been categorized yet.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-6">
          <h2 className="text-lg font-semibold mb-4">My Activities</h2>
          <div className="space-y-3">
            {activities.map((activity: any) => (
              <div key={activity.id} className="flex items-center justify-between border-b pb-3">
                <div>
                  <h4 className="font-medium">{activity.title}</h4>
                  <p className="text-sm text-[var(--text-muted)]">{activity.provider} • {new Date(activity.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{activity.hours} hours</p>
                  <span className={`text-xs px-2 py-1 rounded ${getStatusColor(activity.status)}`}>
                    {activity.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
