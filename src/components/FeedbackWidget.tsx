'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FeedbackType = 'bug' | 'feature' | 'general'

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('general')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      await supabase.from('feedback').insert({
        type,
        message,
        email: email || null,
        page_url: window.location.href,
        user_id: user?.id || null,
      })

      setSubmitted(true)
      setTimeout(() => {
        setIsOpen(false)
        setSubmitted(false)
        setMessage('')
        setEmail('')
      }, 2000)
    } catch (error) {
      console.error('Feedback error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Send feedback"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-[var(--accent)] text-black px-3 py-2 rounded-full shadow-lg text-xs font-semibold z-40 hover:bg-[var(--accent-dim)] transition-colors flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
        </svg>
        Feedback
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 bg-[#111] border border-[#222] rounded-xl shadow-2xl w-80 z-50 overflow-hidden">
      <div className="bg-[#E8841A] px-4 py-3 flex justify-between items-center">
        <h3 className="text-black font-bold">Feedback</h3>
        <button onClick={() => setIsOpen(false)} className="text-black hover:text-gray-700">
          ✕
        </button>
      </div>

      <div className="p-4">
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            </div>
            <p className="text-green-500 font-medium">Thank you!</p>
            <p className="text-gray-400 text-sm">Your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              {(['bug', 'feature', 'general'] as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded text-xs font-medium capitalize transition-colors ${
                    type === t
                      ? 'bg-[#E8841A] text-black'
                      : 'bg-[#1e293b] text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'bug' ? 'Bug report' : t === 'feature' ? 'Feature idea' : 'General'}
                </button>
              ))}
            </div>

            <div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="How can we improve GeoNova?"
                rows={3}
                className="w-full bg-[#0a0a0f] border border-[#222] rounded-lg px-3 py-2 text-white text-sm resize-none"
                required
              />
            </div>

            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="w-full bg-[#0a0a0f] border border-[#222] rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="w-full py-2 bg-[#E8841A] text-black font-bold rounded hover:bg-[#d47619] disabled:opacity-50 transition-colors"
            >
              {loading ? 'Sending...' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
