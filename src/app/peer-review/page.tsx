'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getRequests, postRequest, postComment, closeRequest, deleteRequest,
  ReviewRequest, ReviewComment,
  SURVEY_TYPES, CATEGORIES, COUNTRIES,
} from '@/lib/marketplace/peerReview'

// ── helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d} days ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function statusPill(s: ReviewRequest['status']) {
  if (s === 'open')     return 'bg-green-900/40 text-green-300 border-green-700/40'
  if (s === 'reviewed') return 'bg-blue-900/40 text-blue-300 border-blue-700/40'
  return 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]'
}

function ratingStars(r: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < r ? 'text-[var(--accent)]' : 'text-[var(--border-color)]'}>★</span>
  ))
}

const catBadge: Record<ReviewComment['category'], string> = {
  precision:      'bg-purple-900/30 text-purple-300 border-purple-700/30',
  compliance:     'bg-red-900/30 text-red-400 border-red-700/30',
  methodology:    'bg-blue-900/30 text-blue-300 border-blue-700/30',
  documentation:  'bg-amber-900/30 text-amber-400 border-amber-700/30',
  general:        'bg-[var(--bg-tertiary)] text-[var(--text-muted)] border-[var(--border-color)]',
}

// ── Post request modal ────────────────────────────────────────────────────────

const BLANK_REQ = {
  projectName: '', surveyType: 'traverse' as ReviewRequest['surveyType'],
  description: '', country: 'Kenya', submitterName: '',
  submitterContact: '', attachmentNote: '',
}

function PostModal({ onSave, onClose }: { onSave: (r: ReviewRequest) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...BLANK_REQ })
  const [err, setErr] = useState('')
  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  const submit = () => {
    if (!form.projectName.trim())     { setErr('Project name is required'); return }
    if (!form.description.trim())     { setErr('Describe what you want reviewed'); return }
    if (!form.submitterName.trim())   { setErr('Your name is required'); return }
    if (!form.submitterContact.trim()){ setErr('Contact details required so reviewers can reach you'); return }
    onSave(postRequest(form))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Submit for peer review</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Get feedback from other surveyors in the community</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xl p-1">×</button>
        </div>
        <div className="overflow-y-auto p-6 space-y-4">
          {err && <p className="text-sm text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2">{err}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-[var(--text-muted)] mb-1">Project / survey name *</label>
              <input value={form.projectName} onChange={e => f('projectName', e.target.value)}
                placeholder="e.g. Karen Estate Boundary Survey" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Survey type</label>
              <select value={form.surveyType} onChange={e => f('surveyType', e.target.value as any)} className="input w-full">
                {SURVEY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Country</label>
              <select value={form.country} onChange={e => f('country', e.target.value)} className="input w-full">
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">What do you want reviewed? *</label>
            <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={4}
              placeholder="Describe your survey, the results you got, and what specifically you want feedback on. E.g. 'Closed traverse — precision came out 1:4,200. Not sure if my angle observations are correct. Closing error is higher than expected for this distance.'"
              className="input w-full resize-none" />
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Link to your GeoNova project or computation (optional)</label>
            <input value={form.attachmentNote} onChange={e => f('attachmentNote', e.target.value)}
              placeholder="GeoNova project URL, Google Drive link, or other reference" className="input w-full" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Your name *</label>
              <input value={form.submitterName} onChange={e => f('submitterName', e.target.value)}
                placeholder="Your name or initials" className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Contact (email / phone) *</label>
              <input value={form.submitterContact} onChange={e => f('submitterContact', e.target.value)}
                placeholder="+254712345678" className="input w-full" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5 pt-2 border-t border-[var(--border-color)]">
          <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
          <button onClick={submit} className="btn btn-primary flex-1">Post for review</button>
        </div>
      </div>
    </div>
  )
}

// ── Review detail panel ───────────────────────────────────────────────────────

function ReviewDetail({ request, onClose, onRefresh }: {
  request: ReviewRequest; onClose: () => void; onRefresh: () => void
}) {
  const [showCommentForm, setShowCommentForm] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [form, setForm] = useState({
    reviewerName: '', reviewerTitle: '', comment: '',
    category: 'general' as ReviewComment['category'], rating: 5 as ReviewComment['rating'],
  })
  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }))

  const typeLabel = SURVEY_TYPES.find(t => t.id === request.surveyType)?.label ?? request.surveyType

  const submitComment = () => {
    if (!form.reviewerName.trim()) { setErr('Your name is required'); return }
    if (!form.comment.trim())     { setErr('Write your review comment'); return }
    postComment({ requestId: request.id, ...form })
    setSent(true); onRefresh()
  }

  // Sort comments newest first
  const comments = [...(request.comments || [])].sort((a,b) => b.postedAt.localeCompare(a.postedAt))

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="flex-1" />
      <div className="w-full max-w-lg bg-[var(--bg-card)] border-l border-[var(--border-color)] h-full overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-card)] z-10">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--text-primary)] text-sm truncate">{request.projectName}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{typeLabel} · {request.country} · {relTime(request.postedAt)}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 ml-3">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border ${statusPill(request.status)}`}>
              {request.status === 'open' ? 'Awaiting review' : request.status === 'reviewed' ? 'Has reviews' : 'Closed'}
            </span>
            <span className="text-xs text-[var(--text-muted)]">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
          </div>

          {/* What they want reviewed */}
          <div>
            <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Survey description</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{request.description}</p>
          </div>

          {/* Attachment note */}
          {request.attachmentNote && (
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">Reference / attachment</p>
              <p className="text-sm text-[var(--accent)] break-all">{request.attachmentNote}</p>
            </div>
          )}

          {/* Submitter */}
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
            <p className="text-xs text-[var(--text-muted)] mb-1">Posted by</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{request.submitterName}</p>
            <p className="text-sm text-[var(--accent)]">{request.submitterContact}</p>
          </div>

          {/* Leave a review */}
          {!sent && !showCommentForm && request.status !== 'closed' && (
            <button onClick={() => setShowCommentForm(true)} className="btn btn-primary w-full">
              Leave a review
            </button>
          )}
          {sent && (
            <div className="bg-green-900/20 border border-green-700/30 rounded-xl p-4 text-center">
              <p className="text-green-400 font-semibold text-sm">Review posted</p>
              <p className="text-xs text-green-500 mt-1">The surveyor will see your feedback and can contact you.</p>
            </div>
          )}
          {showCommentForm && !sent && (
            <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your review</h3>
              {err && <p className="text-xs text-red-400">{err}</p>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Your name *</label>
                  <input value={form.reviewerName} onChange={e => f('reviewerName', e.target.value)}
                    placeholder="J. Kamau" className="input w-full text-sm py-1.5" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Your title / qualification</label>
                  <input value={form.reviewerTitle} onChange={e => f('reviewerTitle', e.target.value)}
                    placeholder="Reg. Surveyor, LSK Member" className="input w-full text-sm py-1.5" />
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Category</label>
                <select value={form.category} onChange={e => f('category', e.target.value as any)} className="input w-full text-sm">
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">
                  Overall rating (5 = no issues found)
                </label>
                <div className="flex gap-2">
                  {([1,2,3,4,5] as const).map(r => (
                    <button key={r} onClick={() => f('rating', r)}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                        form.rating === r
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40 text-[var(--accent)]'
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-color)] text-[var(--text-muted)]'
                      }`}>{r}★</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[var(--text-muted)] block mb-1">Your feedback *</label>
                <textarea value={form.comment} onChange={e => f('comment', e.target.value)} rows={4}
                  placeholder="Describe what you found: is the closure acceptable? Is the method correct? What should be checked or redone?"
                  className="input w-full resize-none text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCommentForm(false)} className="btn btn-secondary flex-1 text-sm py-2">Cancel</button>
                <button onClick={submitComment} className="btn btn-primary flex-1 text-sm py-2">Post review</button>
              </div>
            </div>
          )}

          {/* Comments */}
          {comments.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-3">
                Reviews ({comments.length})
              </p>
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{c.reviewerName}</p>
                        {c.reviewerTitle && <p className="text-xs text-[var(--text-muted)]">{c.reviewerTitle}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex text-xs">{ratingStars(c.rating)}</div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{relTime(c.postedAt)}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${catBadge[c.category]} inline-block mb-2`}>
                      {CATEGORIES.find(cat => cat.id === c.category)?.label}
                    </span>
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{c.comment}</p>
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

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ request, onClick }: { request: ReviewRequest; onClick: () => void }) {
  const typeLabel = SURVEY_TYPES.find(t => t.id === request.surveyType)?.label ?? request.surveyType
  const avgRating = request.comments.length > 0
    ? (request.comments.reduce((s, c) => s + c.rating, 0) / request.comments.length).toFixed(1)
    : null

  return (
    <div onClick={onClick}
      className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:border-[var(--accent)]/30 transition-colors cursor-pointer group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
            {request.projectName}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {typeLabel} · {request.country} · {request.submitterName}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusPill(request.status)}`}>
          {request.status === 'open' ? 'Needs review' : request.status === 'reviewed' ? 'Reviewed' : 'Closed'}
        </span>
      </div>

      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4 leading-relaxed">
        {request.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-3">
          <span>{request.comments.length} review{request.comments.length !== 1 ? 's' : ''}</span>
          {avgRating && (
            <span className="flex items-center gap-0.5">
              <span className="text-[var(--accent)]">★</span> {avgRating}
            </span>
          )}
        </div>
        <span>{relTime(request.postedAt)}</span>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PeerReviewPage() {
  const [requests, setRequests] = useState<ReviewRequest[]>([])
  const [filterStatus, setFilterStatus] = useState<'' | 'open' | 'reviewed'>('open')
  const [filterType, setFilterType]     = useState('')
  const [showPost, setShowPost]         = useState(false)
  const [activeReq, setActiveReq]       = useState<ReviewRequest | null>(null)

  const reload = useCallback(() => {
    setRequests(getRequests(filterStatus || undefined as any))
  }, [filterStatus])

  useEffect(() => { reload() }, [reload])

  const filtered = filterType ? requests.filter(r => r.surveyType === filterType) : requests

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Peer review</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Post your survey computations for community review. Help other surveyors by reviewing their work.
            </p>
          </div>
          <button onClick={() => setShowPost(true)} className="btn btn-primary flex-shrink-0">
            + Submit for review
          </button>
        </div>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { n:'1', title:'Post your survey', desc:'Describe what you need reviewed — traverse closure, leveling check, methodology.' },
            { n:'2', title:'Community reviews', desc:'Other surveyors leave structured feedback with ratings and specific comments.' },
            { n:'3', title:'Improve your work', desc:'Use the feedback before submitting to clients or land registries.' },
          ].map(({ n, title, desc }) => (
            <div key={n} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-black text-sm font-bold flex items-center justify-center mb-3">{n}</div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {([
            { key: 'open',     label: 'Needs review', count: getRequests('open').length },
            { key: 'reviewed', label: 'Reviewed',      count: getRequests('reviewed').length },
            { key: '',         label: 'All',            count: getRequests().length },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilterStatus(key as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                filterStatus === key
                  ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border-[var(--border-color)]'
              }`}>
              {label}{count > 0 && <span className="ml-1.5 text-xs opacity-70">({count})</span>}
            </button>
          ))}
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] rounded-lg px-3 py-1.5 text-sm">
            <option value="">All types</option>
            {SURVEY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-24 border border-dashed border-[var(--border-color)] rounded-2xl">
            <div className="w-14 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              {filterStatus === 'open' ? 'No surveys awaiting review' : 'Nothing here yet'}
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-sm mx-auto">
              {filterStatus === 'open'
                ? 'All caught up! Be the first to post your survey for community review.'
                : 'Post a survey computation for review or come back to help others.'}
            </p>
            <button onClick={() => setShowPost(true)} className="btn btn-primary">Submit a survey for review</button>
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {filtered.map(req => (
              <RequestCard key={req.id} request={req}
                onClick={() => setActiveReq(req)} />
            ))}
          </div>
        )}
      </div>

      {showPost && (
        <PostModal
          onSave={r => { reload(); setShowPost(false); setActiveReq(r) }}
          onClose={() => setShowPost(false)}
        />
      )}

      {activeReq && (
        <ReviewDetail
          request={requests.find(r => r.id === activeReq.id) ?? activeReq}
          onClose={() => setActiveReq(null)}
          onRefresh={reload}
        />
      )}
    </div>
  )
}
