'use client';

import { useState, useEffect, useCallback } from 'react'
import {
  getCPDRequirements,
  type CPDRequirement,
} from '@/lib/marketplace/cpdCertificates'

/**
 * /cpd — Continuing Professional Development tracking.
 *
 * END-TO-END REWORK (audit H9 follow-up "make it work", 2026-08-31):
 *  - Records come from /api/cpd → lib/cpd.ts → cpd_records (real DB), and
 *    now render the REAL field shape including the approval state that the
 *    API exposes (approved/rejectionReason) — pending manual entries show
 *    as "Pending approval" instead of masquerading as "Verified".
 *  - The page always promised "Manual entries can be added below" but no
 *    form existed and the POST /api/cpd endpoint had no caller. The form
 *    is here now (submitting creates a pending entry for admin approval).
 *  - A year selector was added (records exist across years; the page was
 *    hard-locked to the current year).
 *  - The summary card uses the server's ?action=summary (approved total,
 *    pending count, annual cap) instead of recomputing from raw rows.
 */

/** REAL /api/cpd response shape (CPDRecord from lib/cpd.ts → cpd_records). */
interface CpdActivityRow {
  id: string
  userId: string
  activity: string
  points: number
  earnedAt: string
  description: string
  referenceId?: string
  verifiable: boolean
  approved?: boolean
  rejectionReason?: string
}

interface CpdSummaryRow {
  total: number
  pending: number
  cap: number
  remaining: number
  percent: number
}

const MANUAL_ACTIVITY_OPTIONS = [
  { value: 'TRAINING_COMPLETED', label: 'Training completed' },
  { value: 'CONFERENCE_ATTENDED', label: 'Conference attended' },
  { value: 'MANUAL_ENTRY', label: 'Other CPD activity' },
] as const

function prettifyActivity(activity: string): string {
  return activity
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function CPDPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<CpdActivityRow[]>([])
  const [summary, setSummary] = useState<CpdSummaryRow | null>(null)
  const [country, setCountry] = useState('Kenya')
  const [requirements, setRequirements] = useState<CPDRequirement[]>([])
  const [error, setError] = useState<string | null>(null)

  // manual entry form state
  const [formOpen, setFormOpen] = useState(false)
  const [formActivity, setFormActivity] = useState<string>('TRAINING_COMPLETED')
  const [formDescription, setFormDescription] = useState('')
  const [formPoints, setFormPoints] = useState(1)
  const [formReference, setFormReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<string | null>(null)

  const loadData = useCallback(async (selectedYear: number) => {
    setLoading(true)
    setError(null)
    setRequirements(getCPDRequirements(country))

    try {
      const [recordsRes, summaryRes] = await Promise.all([
        fetch(`/api/cpd?year=${selectedYear}`, { credentials: 'include' }),
        fetch(`/api/cpd?action=summary&year=${selectedYear}`, { credentials: 'include' }),
      ])

      if (recordsRes.ok) {
        const data = (await recordsRes.json()) as { records?: CpdActivityRow[] }
        setActivities(data.records ?? [])
      } else if (recordsRes.status === 401) {
        setActivities([]) // not signed in — empty state below explains it
      } else {
        setError('Failed to load CPD records')
      }

      if (summaryRes.ok) {
        const data = (await summaryRes.json()) as { summary?: CpdSummaryRow }
        setSummary(data.summary ?? null)
      }
    } catch {
      setError('Network error loading CPD records')
    }
    setLoading(false)
  }, [country])

  useEffect(() => {
    loadData(year)
  }, [year, loadData])

  const submitManualEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormMessage(null)
    try {
      const res = await fetch('/api/cpd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          activity: formActivity,
          description: formDescription,
          points: formPoints,
          referenceId: formReference || undefined,
        }),
      })
      const data = (await res.json()) as { error?: string; message?: string }
      if (!res.ok) {
        throw new Error(data.error || `Submission failed (${res.status})`)
      }
      setFormMessage(data.message || 'Entry submitted for approval.')
      setFormDescription('')
      setFormPoints(1)
      setFormReference('')
      await loadData(year) // refresh — the pending entry appears immediately
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const pendingCount = activities.filter(a => a.approved === false && !a.rejectionReason).length
  const approvedTotal = summary?.total ?? activities.filter(a => a.approved !== false).reduce((s, a) => s + a.points, 0)
  const req = getCPDRequirements(country)[0]
  const requiredHours = req?.yearlyHours ?? 40
  const compliancePct = requiredHours > 0 ? Math.min(100, (approvedTotal / requiredHours) * 100) : 0
  const status = approvedTotal >= requiredHours ? 'compliant'
    : approvedTotal >= requiredHours * 0.75 ? 'at_risk' : 'non_compliant'

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
          <div className="text-blue-500 mt-0.5" aria-hidden>(i)</div>
          <p className="text-[var(--text-secondary)]">
            <span className="font-medium text-[var(--text-primary)]">Auto-logging active:</span> hours are
            auto-logged when you use METARDU computation tools. Manual entries are submitted below and count
            once an admin approves them.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cpd-country" className="block text-sm font-medium text-[var(--text-muted)] mb-2">Select Country</label>
            <select
              id="cpd-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="p-2 border rounded-lg w-64 bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              <option value="Kenya">Kenya (ISK)</option>
              <option value="Uganda">Uganda</option>
              <option value="Tanzania">Tanzania</option>
              <option value="Nigeria">Nigeria</option>
              <option value="South Africa">South Africa</option>
            </select>
          </div>
          <div>
            <label htmlFor="cpd-year" className="block text-sm font-medium text-[var(--text-muted)] mb-2">Year</label>
            <select
              id="cpd-year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="p-2 border rounded-lg w-32 bg-[var(--bg-card)] text-[var(--text-primary)]"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6 text-sm text-red-500" role="alert">
            {error}
          </div>
        )}

        {requirements.map((r) => (
          <div key={r.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900">{r.body}</h3>
            <p className="text-sm text-blue-700">{r.notes}</p>
          </div>
        ))}

        {/* Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Approved Hours</p>
            <p className="text-2xl font-bold">{approvedTotal}</p>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-600">{pendingCount} pending approval</p>
            )}
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Required</p>
            <p className="text-2xl font-bold">{requiredHours}</p>
            <p className="text-xs text-[var(--text-muted)]">per year ({country})</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Compliance</p>
            <p className={`text-2xl font-bold ${
              status === 'compliant' ? 'text-green-600' :
              status === 'at_risk' ? 'text-yellow-600' : 'text-red-600'
            }`}>{compliancePct.toFixed(0)}%</p>
          </div>
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-4">
            <p className="text-sm text-[var(--text-muted)]">Status</p>
            <p className={`text-lg font-bold ${
              status === 'compliant' ? 'text-green-600' :
              status === 'at_risk' ? 'text-yellow-600' : 'text-red-600'
            }`}>{status.replace('_', ' ').toUpperCase()}</p>
            {summary && <p className="text-xs text-[var(--text-muted)]">annual cap: {summary.cap}</p>}
          </div>
        </div>

        {/* Manual entry form */}
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Add a Manual Entry</h2>
            <button
              type="button"
              onClick={() => setFormOpen(o => !o)}
              className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              aria-expanded={formOpen}
            >
              {formOpen ? 'Hide form' : 'Show form'}
            </button>
          </div>
          {formOpen && (
            <form onSubmit={submitManualEntry} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="cpd-entry-type" className="block text-xs text-[var(--text-muted)] mb-1">Activity type</label>
                  <select
                    id="cpd-entry-type"
                    value={formActivity}
                    onChange={(e) => setFormActivity(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  >
                    {MANUAL_ACTIVITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="cpd-entry-points" className="block text-xs text-[var(--text-muted)] mb-1">Hours (points) — max 50</label>
                  <input
                    id="cpd-entry-points"
                    type="number"
                    min={0.5}
                    max={50}
                    step={0.5}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="cpd-entry-ref" className="block text-xs text-[var(--text-muted)] mb-1">Reference (optional)</label>
                  <input
                    id="cpd-entry-ref"
                    type="text"
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    placeholder="Certificate no., event ID…"
                    className="w-full p-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="cpd-entry-desc" className="block text-xs text-[var(--text-muted)] mb-1">
                  Description (min 10 characters)
                </label>
                <textarea
                  id="cpd-entry-desc"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full p-2 border rounded-lg bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
                  required
                />
              </div>
              {formMessage && (
                <p className={`text-sm ${formMessage.includes('failed') || formMessage.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                  {formMessage}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || formDescription.trim().length < 10}
                className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit for approval'}
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                Manual entries are reviewed by an administrator before they count toward your total —
                this is an anti-fraud control, and the audit chain logs the submission.
              </p>
            </form>
          )}
        </div>

        {/* Activities */}
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)] p-6">
          <h2 className="text-lg font-semibold mb-4">My Activities ({year})</h2>
          <div className="space-y-3">
            {activities.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] py-4">
                No CPD activities recorded for {year}. Hours are auto-logged when you use METARDU
                computation tools, and manual entries can be submitted above — they appear here once
                recorded.
              </p>
            )}
            {activities.map((activity) => {
              const pending = activity.approved === false && !activity.rejectionReason
              const rejected = Boolean(activity.rejectionReason)
              const badge = rejected
                ? { cls: 'bg-red-100 text-red-800', text: 'Rejected' }
                : pending
                  ? { cls: 'bg-yellow-100 text-yellow-800', text: 'Pending approval' }
                  : { cls: 'bg-green-100 text-green-800', text: 'Counted' }
              return (
                <div key={activity.id} className="flex items-center justify-between border-b pb-3">
                  <div className="min-w-0">
                    <h4 className="font-medium">{prettifyActivity(activity.activity)}</h4>
                    {activity.description && (
                      <p className="text-sm text-[var(--text-muted)] max-w-xl truncate" title={activity.description}>
                        {activity.description}
                      </p>
                    )}
                    <p className="text-xs text-[var(--text-muted)]">
                      Earned {new Date(activity.earnedAt).toLocaleDateString()}
                      {activity.referenceId ? ` • Ref ${activity.referenceId}` : ''}
                      {pending ? ' • not yet counted toward the total' : ''}
                    </p>
                    {rejected && (
                      <p className="text-xs text-red-600">Reason: {activity.rejectionReason}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-semibold">
                      {activity.points} {activity.points === 1 ? 'pt' : 'pts'}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${badge.cls}`}>{badge.text}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] mt-6">
          Hours shown are derived from activity points (1 point ≈ 1 hour of qualifying activity) and
          only approved entries count toward the requirement.
        </p>
      </div>
    </div>
  )
}
