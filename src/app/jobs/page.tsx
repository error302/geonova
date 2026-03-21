'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getJobs, searchJobs, postJob, updateJobStatus, deleteJob,
  submitProposal, getProposalsForJob,
  SurveyJob, JobProposal, SurveyJobType, Currency,
  JOB_TYPES, CURRENCIES, COUNTRIES, COMMON_SKILLS, formatBudget,
} from '@/lib/marketplace/jobMarketplace'

// ── helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function daysLeft(deadline: string) {
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
  if (d < 0) return { label: 'Expired', cls: 'text-red-400' }
  if (d === 0) return { label: 'Today', cls: 'text-amber-400' }
  if (d <= 3) return { label: `${d}d left`, cls: 'text-amber-400' }
  return { label: `${d}d left`, cls: 'text-[var(--text-muted)]' }
}

function statusPill(s: SurveyJob['status']) {
  const map = {
    open:        'bg-green-900/40 text-green-300 border-green-700/40',
    in_progress: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    completed:   'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]',
    cancelled:   'bg-red-900/30 text-red-400 border-red-700/30',
  }
  return map[s]
}

const TODAY = new Date().toISOString().split('T')[0]

// ── Post job form ─────────────────────────────────────────────────────────────

const BLANK_POST = {
  title: '', description: '', surveyType: 'boundary' as SurveyJobType,
  country: 'Kenya', location: '', budget: '' as unknown as number,
  currency: 'KES' as Currency, deadline: '',
  requiredSkills: [] as string[], clientName: '', clientContact: '', postedBy: 'me',
}

function PostJobModal({ onSave, onClose }: { onSave: (j: SurveyJob) => void; onClose: () => void }) {
  const [form, setForm] = useState(BLANK_POST)
  const [skillInput, setSkillInput] = useState('')
  const [error, setError] = useState('')
  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const addSkill = (skill: string) => {
    const s = skill.trim()
    if (s && !form.requiredSkills.includes(s)) {
      f('requiredSkills', [...form.requiredSkills, s])
    }
    setSkillInput('')
  }

  const submit = () => {
    if (!form.title.trim()) { setError('Job title is required'); return }
    if (!form.location.trim()) { setError('Location is required'); return }
    if (!form.budget || Number(form.budget) <= 0) { setError('Budget is required'); return }
    if (!form.deadline) { setError('Deadline is required'); return }
    if (!form.clientName.trim()) { setError('Your name is required'); return }
    if (!form.clientContact.trim()) { setError('Contact details are required so surveyors can reach you'); return }
    setError('')
    const job = postJob({ ...form, budget: Number(form.budget) })
    onSave(job)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="font-semibold text-[var(--text-primary)]">Post a survey job</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl p-1">×</button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {error && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Job title *</label>
            <input value={form.title} onChange={e => f('title', e.target.value)}
              placeholder="e.g. Boundary Survey — 2 acre plot, Karen Estate"
              className="input w-full" />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Description *</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={3}
              placeholder="Describe the work: what needs to be done, site conditions, deliverables expected (PDF plan, DXF, beacons placed, etc.)"
              className="input w-full resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Survey type *</label>
              <select value={form.surveyType} onChange={e => f('surveyType', e.target.value as SurveyJobType)} className="input w-full">
                {JOB_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Country *</label>
              <select value={form.country} onChange={e => f('country', e.target.value)} className="input w-full">
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Location (town / area) *</label>
              <input value={form.location} onChange={e => f('location', e.target.value)}
                placeholder="e.g. Karen, Nairobi" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Deadline *</label>
              <input type="date" min={TODAY} value={form.deadline} onChange={e => f('deadline', e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Budget *</label>
              <input type="number" min={0} value={form.budget || ''} onChange={e => f('budget', e.target.value)}
                placeholder="Amount" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Currency</label>
              <select value={form.currency} onChange={e => f('currency', e.target.value as Currency)} className="input w-full">
                {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.id} — {c.country}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Required skills / equipment</label>
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillInput) } }}
                placeholder="Type skill + Enter" className="input flex-1 text-sm py-1.5" />
              <button onClick={() => addSkill(skillInput)} className="btn btn-secondary text-sm py-1.5 px-3">Add</button>
            </div>
            {/* Quick add common skills */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_SKILLS.filter(s => !form.requiredSkills.includes(s)).slice(0, 8).map(s => (
                <button key={s} onClick={() => addSkill(s)}
                  className="text-xs px-2 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)]/50 hover:text-[var(--accent)] transition-colors">
                  + {s}
                </button>
              ))}
            </div>
            {form.requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.requiredSkills.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] flex items-center gap-1">
                    {s}
                    <button onClick={() => f('requiredSkills', form.requiredSkills.filter(x => x !== s))} className="hover:text-red-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Your name / company *</label>
              <input value={form.clientName} onChange={e => f('clientName', e.target.value)}
                placeholder="ABC Properties Ltd" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Contact (phone or email) *</label>
              <input value={form.clientContact} onChange={e => f('clientContact', e.target.value)}
                placeholder="+254712345678" className="input w-full" />
            </div>
          </div>

          <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] rounded-lg px-3 py-2">
            METARDU charges 5% commission on completed jobs. Your contact details will be visible to surveyors who apply.
          </p>
        </div>
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={submit} className="btn btn-primary flex-1">Post job</button>
        </div>
      </div>
    </div>
  )
}

// ── Job detail + proposal ─────────────────────────────────────────────────────

function JobDetail({ job, onClose, onRefresh }: { job: SurveyJob; onClose: () => void; onRefresh: () => void }) {
  const [showPropose, setShowPropose] = useState(false)
  const [proposals, setProposals] = useState<JobProposal[]>([])
  const [propForm, setPropForm] = useState({ surveyorName: '', contact: '', message: '', quotedAmount: '' as unknown as number, currency: job.currency })
  const [propSent, setPropSent] = useState(false)
  const [propError, setPropError] = useState('')

  useEffect(() => { setProposals(getProposalsForJob(job.id)) }, [job.id])

  const typeLabel = JOB_TYPES.find(t => t.id === job.surveyType)?.label ?? job.surveyType
  const dl = daysLeft(job.deadline)

  const sendProposal = () => {
    if (!propForm.surveyorName) { setPropError('Your name is required'); return }
    if (!propForm.contact) { setPropError('Your contact is required'); return }
    if (!propForm.message.trim()) { setPropError('A message to the client is required'); return }
    if (!propForm.quotedAmount || Number(propForm.quotedAmount) <= 0) { setPropError('Enter your quoted amount'); return }
    submitProposal({ jobId: job.id, ...propForm, quotedAmount: Number(propForm.quotedAmount) })
    setPropSent(true)
    onRefresh()
  }

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border-color)] h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-card)] z-10">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--text-primary)] text-base leading-snug">{job.title}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{typeLabel} · {job.location}, {job.country}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 ml-3">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Key stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Budget', value: formatBudget(job.budget, job.currency), cls: 'text-[var(--accent)] font-bold' },
              { label: 'Deadline', value: dl.label, cls: dl.cls + ' font-semibold' },
              { label: 'Proposals', value: String(job.proposals), cls: 'text-[var(--text-primary)] font-semibold' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-[var(--bg-secondary)] rounded-lg p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">{label}</p>
                <p className={`text-sm ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${statusPill(job.status)}`}>
              {job.status.replace('_', ' ')}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Posted {relTime(job.postedAt)}</span>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Job description</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{job.description || 'No description provided.'}</p>
          </div>

          {/* Skills */}
          {job.requiredSkills.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Required skills</p>
              <div className="flex flex-wrap gap-1.5">
                {job.requiredSkills.map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)]">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Client contact */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Posted by</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{job.clientName}</p>
            <p className="text-sm text-[var(--accent)] mt-0.5">{job.clientContact}</p>
          </div>

          {/* Apply section */}
          {job.status === 'open' && (
            <div>
              {!showPropose && !propSent && (
                <button onClick={() => setShowPropose(true)} className="btn btn-primary w-full">
                  Submit a proposal
                </button>
              )}

              {propSent && (
                <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 text-center">
                  <p className="text-green-400 font-semibold">Proposal sent</p>
                  <p className="text-xs text-green-500 mt-1">The client will contact you directly via the details you provided.</p>
                </div>
              )}

              {showPropose && !propSent && (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your proposal</h3>
                  {propError && <p className="text-xs text-red-400">{propError}</p>}

                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Your name *</label>
                    <input value={propForm.surveyorName} onChange={e => setPropForm(p => ({ ...p, surveyorName: e.target.value }))}
                      placeholder="Your full name" className="input w-full text-sm py-1.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Your contact (phone/email) *</label>
                    <input value={propForm.contact} onChange={e => setPropForm(p => ({ ...p, contact: e.target.value }))}
                      placeholder="+254712345678 or email" className="input w-full text-sm py-1.5" />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Your quote *</label>
                    <div className="flex gap-2">
                      <input type="number" value={propForm.quotedAmount || ''} onChange={e => setPropForm(p => ({ ...p, quotedAmount: Number(e.target.value) }))}
                        placeholder="Amount" className="input flex-1 text-sm py-1.5" />
                      <select value={propForm.currency} onChange={e => setPropForm(p => ({ ...p, currency: e.target.value as Currency }))}
                        className="input w-24 text-sm py-1.5">
                        {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.id}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Message to client *</label>
                    <textarea value={propForm.message} onChange={e => setPropForm(p => ({ ...p, message: e.target.value }))} rows={3}
                      placeholder="Briefly describe your experience with this type of work, your availability, and any questions about the job..."
                      className="input w-full resize-none text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowPropose(false)} className="btn btn-secondary flex-1 text-sm py-2">Cancel</button>
                    <button onClick={sendProposal} className="btn btn-primary flex-1 text-sm py-2">Send proposal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proposals received (if this is your job) */}
          {proposals.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Proposals received ({proposals.length})
              </p>
              <div className="space-y-3">
                {proposals.map(p => (
                  <div key={p.id} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-3">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{p.surveyorName}</p>
                      <span className="text-sm font-bold text-[var(--accent)]">{formatBudget(p.quotedAmount, p.currency)}</span>
                    </div>
                    <p className="text-xs text-[var(--accent)] mb-2">{p.contact}</p>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{p.message}</p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-2">{relTime(p.submittedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job, onClick }: { job: SurveyJob; onClick: () => void }) {
  const typeLabel = JOB_TYPES.find(t => t.id === job.surveyType)?.label ?? job.surveyType
  const dl = daysLeft(job.deadline)

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:border-[var(--accent)]/30 transition-colors cursor-pointer group"
      onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--accent)] transition-colors">
            {job.title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-1">{job.clientName} · {job.location}, {job.country}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusPill(job.status)}`}>
          {job.status.replace('_', ' ')}
        </span>
      </div>

      {job.description && (
        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3 leading-relaxed">{job.description}</p>
      )}

      {job.requiredSkills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {job.requiredSkills.slice(0, 4).map(s => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">{s}</span>
          ))}
          {job.requiredSkills.length > 4 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">+{job.requiredSkills.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-[var(--accent)] font-bold text-sm">{formatBudget(job.budget, job.currency)}</span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-muted)]">{typeLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className={dl.cls}>{dl.label}</span>
          <span>{job.proposals} proposal{job.proposals !== 1 ? 's' : ''}</span>
          <span>{relTime(job.postedAt)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const [jobs, setJobs] = useState<SurveyJob[]>([])
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState<'' | 'open' | 'in_progress' | 'completed'>('open')
  const [showPost, setShowPost] = useState(false)
  const [activeJob, setActiveJob] = useState<SurveyJob | null>(null)

  const reload = useCallback(() => {
    if (search.trim()) {
      setJobs(searchJobs(search))
    } else {
      setJobs(getJobs({
        country: filterCountry || undefined,
        surveyType: filterType || undefined,
        status: filterStatus || undefined,
      }))
    }
  }, [search, filterCountry, filterType, filterStatus])

  useEffect(() => { reload() }, [reload])

  const shown = jobs
  const openCount = getJobs({ status: 'open' }).length

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Survey job board</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Post a survey job or find work. METARDU charges 5% commission on completed jobs.
            </p>
          </div>
          <button onClick={() => setShowPost(true)} className="btn btn-primary flex-shrink-0">
            + Post a job
          </button>
        </div>

        {/* Stats bar */}
        {openCount > 0 && (
          <div className="flex items-center gap-4 mb-5 text-sm">
            <span className="text-[var(--text-secondary)]">
              <span className="text-[var(--accent)] font-semibold">{openCount}</span> open job{openCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs..."
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:border-[var(--accent)]" />

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-sm">
            <option value="">All status</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </select>

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-sm">
            <option value="">All types</option>
            {JOB_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>

          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-2 text-sm">
            <option value="">All countries</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Empty state */}
        {shown.length === 0 && (
          <div className="text-center py-24 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {search || filterCountry || filterType ? 'No matching jobs' : 'No jobs posted yet'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              {search || filterCountry || filterType
                ? 'Try adjusting your filters'
                : 'Be the first to post a survey job. Connect with licensed surveyors across Africa.'}
            </p>
            {!search && !filterCountry && !filterType && (
              <button onClick={() => setShowPost(true)} className="btn btn-primary">Post the first job</button>
            )}
          </div>
        )}

        {/* Job grid */}
        {shown.length > 0 && (
          <div className="space-y-3">
            {shown.map(job => (
              <JobCard key={job.id} job={job} onClick={() => setActiveJob(job)} />
            ))}
          </div>
        )}
      </div>

      {showPost && (
        <PostJobModal
          onSave={j => { reload(); setShowPost(false); setActiveJob(j) }}
          onClose={() => setShowPost(false)}
        />
      )}

      {activeJob && (
        <JobDetail
          job={jobs.find(j => j.id === activeJob.id) ?? activeJob}
          onClose={() => setActiveJob(null)}
          onRefresh={reload}
        />
      )}
    </div>
  )
}
