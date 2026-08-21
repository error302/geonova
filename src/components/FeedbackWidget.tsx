'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  type FeedbackCategory,
  buildFeedbackPayload,
  markFeedbackSubmitted,
  canSubmitFeedback,
} from '@/lib/feedback/feedbackCollector'
import { ChangelogPanel } from '@/components/feedback/ChangelogPanel'

type Tab = 'feedback' | 'changelog'

/**
 * FeedbackWidget — floating button that opens a feedback form.
 *
 * AUDIT FIX (2026-07-05): Complete rewrite. Previously:
 *   - Used the deprecated createClient() which tried dbClient.from('feedback')
 *     but no feedback table existed → insert failed silently
 *   - Fallback was console.warn() — feedback was lost
 *   - Screenshot capture tried to import html2canvas (not installed) → always null
 *
 * Now:
 *   - POSTs to /api/feedback (real endpoint that saves to the feedback table)
 *   - Uses useSession() for the user ID (not the deprecated auth.getSession())
 *   - Sends error logs from sessionStorage as JSON
 *   - Screenshot capture removed (was always failing silently — html2canvas
 *     not installed and is too heavy to add). Users can still describe
 *     what they see in the message field.
 *   - Rate limited server-side: 5 submissions per 15 minutes per user
 */
export default function FeedbackWidget() {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('feedback')
  const [type, setType] = useState<FeedbackCategory>('bug')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = useCallback(() => {
    setSubmitted(false)
    setMessage('')
    setEmail('')
    setError(null)
    setType('bug')
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    if (!canSubmitFeedback()) {
      setError('Please wait 30 seconds before submitting again.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = buildFeedbackPayload(type, message, email || undefined)

      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          email: email || undefined,
          includeErrors: true,
          errors: payload.errorEntries,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Server returned ${res.status}`)
      }

      markFeedbackSubmitted()
      setSubmitted(true)
      setTimeout(() => {
        setIsOpen(false)
        resetForm()
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        // AUDIT FIX (2026-07-05): Repositioned to avoid overlap with
        // QuickCompute (bottom-20 md:bottom-6 right-4) and FieldModeToggle
        // (bottom-6 right-6). The feedback button now sits ABOVE QuickCompute
        // on both mobile and desktop:
        //   Mobile:  bottom-[168px] (above MobileNav 64px + QuickCompute 104px)
        //   Desktop: bottom-32      (above QuickCompute at bottom-6 + its height)
        className="fixed bottom-[168px] right-4 md:bottom-32 bg-[var(--accent)] text-black px-3 py-2 rounded-full shadow-lg text-xs font-semibold z-40 hover:bg-[var(--accent-dim)] transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        Feedback
      </button>
    )
  }

  return (
    <div className="fixed bottom-[168px] right-4 left-4 sm:bottom-32 sm:left-auto bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-[calc(100vw-2rem)] sm:w-[22rem] max-h-[70vh] z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[var(--accent)] px-4 py-3 flex justify-between items-center flex-shrink-0">
        <h3 className="text-black font-bold text-sm">Feedback</h3>
        <div className="flex items-center gap-2">
          <div className="flex bg-black/10 rounded-md overflow-hidden">
            <button
              onClick={() => setTab('feedback')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'feedback' ? 'bg-black text-[var(--accent)]' : 'text-black/70 hover:text-black'
              }`}
            >
              Report
            </button>
            <button
              onClick={() => setTab('changelog')}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                tab === 'changelog' ? 'bg-black text-[var(--accent)]' : 'text-black/70 hover:text-black'
              }`}
            >
              What&apos;s New
            </button>
          </div>
          <button onClick={() => { setIsOpen(false); resetForm() }} className="text-black hover:text-black/60 ml-1" aria-label="Close feedback">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'changelog' ? (
          <ChangelogPanel />
        ) : submitted ? (
          <div className="text-center py-10 px-4">
            <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-green-400 font-semibold mb-1">Thank you!</p>
            <p className="text-[var(--text-muted)] text-xs">Your feedback has been submitted and will help improve METARDU.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Auth notice */}
            {!session?.user && (
              <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded-lg p-2">
                You need to be signed in to submit feedback.
              </p>
            )}

            {/* Type selector */}
            <div className="flex gap-1.5">
              {([
                { key: 'bug' as FeedbackCategory, label: 'Bug' },
                { key: 'feature' as FeedbackCategory, label: 'Feature' },
                { key: 'performance' as FeedbackCategory, label: 'Slow' },
                { key: 'general' as FeedbackCategory, label: 'Other' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setType(key)}
                  className={`flex-1 py-3 rounded-lg text-[10px] font-medium transition-all ${
                    type === key
                      ? 'bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/20'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border-color)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Message */}
            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  type === 'bug'
                    ? 'What went wrong? Steps to reproduce...'
                    : type === 'feature'
                      ? 'What feature would you like?'
                      : type === 'performance'
                        ? 'What is slow? When does it happen?'
                        : 'How can we improve METARDU?'
                }
                rows={5}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm resize-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] outline-none transition-all"
                required
                minLength={10}
                maxLength={2000}
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
                {message.length}/2000
              </p>
            </div>

            {/* Email (optional) */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Email (optional — for follow-up)"

                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--accent)_30%,transparent)] outline-none transition-all"
              />
            </div>

            {/* Error notice */}
            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !message.trim() || !session?.user}
              className="w-full py-2.5 bg-[var(--accent)] text-black font-bold rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 transition-colors text-sm"
            >
              {loading ? 'Sending...' : 'Submit Feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
