'use client'
import { useState } from 'react'

export default function CommunityPage() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.from('newsletter_subscribers').upsert(
        { email, source: 'community_page' },
        { onConflict: 'email' }
      )
    } catch {
      // Non-fatal
    }
    setSubscribed(true)
  }

  const channels = [
    { flag: 'KE', name: 'Kenya Surveyors', desc: 'Connect with Kenyan surveyors' },
    { flag: 'UG', name: 'Uganda Surveyors', desc: 'Uganda surveying community' },
    { flag: 'TZ', name: 'Tanzania Surveyors', desc: 'Tanzania land surveyors' },
    { flag: 'NG', name: 'Nigeria Surveyors', desc: 'West Africa surveyors' },
    { flag: '🌍', name: 'General Discussion', desc: 'All survey topics' },
    { flag: '💡', name: 'Tips & Tricks', desc: 'Share knowledge' },
    { flag: '🆘', name: 'Support', desc: 'Get help from community' },
    { flag: '📢', name: 'Announcements', desc: 'GeoNova updates' },
  ]

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            Join the GeoNova Community
          </h1>
          <p className="text-[var(--text-secondary)] text-lg">
            Connect with surveyors across Africa and beyond
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-8 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">WhatsApp Community</h2>
            <p className="text-[var(--text-secondary)] mb-6">
              Join thousands of surveyors sharing tips, asking questions, and helping each other grow.
            </p>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000'}?text=${encodeURIComponent('Hello! I want to join the GeoNova Surveyors community.')}`}
              className="inline-block px-8 py-4 bg-[var(--accent)] text-black font-bold rounded-lg hover:bg-[var(--accent-dim)] transition-colors"
            >
              Join GeoNova Surveyors →
            </a>
          </div>

          <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-8">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Community Channels</h2>
            <div className="space-y-3">
              {channels.map((channel) => (
                <div key={channel.name} className="flex items-center gap-3">
                  <span className="text-2xl">{channel.flag}</span>
                  <div>
                    <p className="text-[var(--text-primary)] font-medium text-sm">{channel.name}</p>
                    <p className="text-[var(--text-muted)] text-xs">{channel.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-8 mb-12">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Community Guidelines</h2>
          <ul className="space-y-3 text-[var(--text-secondary)]">
            <li className="flex items-start gap-3">
              <span className="text-[var(--accent)]">✓</span>
              Share knowledge freely — help others learn
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--accent)]">✓</span>
              Respect all members regardless of experience level
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--accent)]">✓</span>
              No spam or self-promotion
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--accent)]">✓</span>
              Help junior surveyors learn the craft
            </li>
            <li className="flex items-start gap-3">
              <span className="text-[var(--accent)]">✓</span>
              Report bugs and suggestions to GeoNova team
            </li>
          </ul>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-6 mb-12">
          <h3 className="text-amber-500 font-bold mb-2">Stay Updated</h3>
          <p className="text-[var(--text-secondary)] text-sm mb-4">Get weekly surveying tips and GeoNova updates</p>
          {subscribed ? (
            <p className="text-green-500">Thanks for subscribing!</p>
          ) : (
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="flex-1 bg-[var(--bg-tertiary)] text-white px-3 py-2 rounded text-sm"
              />
              <button
                type="submit"
                className="bg-amber-500 text-black px-4 py-2 rounded text-sm font-bold"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-6">Follow GeoNova</h2>
          <div className="flex justify-center gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">𝕏</div>
              <p className="text-[var(--text-secondary)] text-sm">Twitter/X</p>
              <p className="text-[var(--text-muted)] text-xs">Coming soon</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">in</div>
              <p className="text-[var(--text-secondary)] text-sm">LinkedIn</p>
              <p className="text-[var(--text-muted)] text-xs">Coming soon</p>
            </div>
            <div className="text-center">
              <div className="text-3xl mb-2">▶</div>
              <p className="text-[var(--text-secondary)] text-sm">YouTube</p>
              <p className="text-[var(--text-muted)] text-xs">Coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
