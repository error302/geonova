'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { SupabaseClient } from '@supabase/supabase-js'

export default function NavBar() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user as { email: string } | null)
      setLoading(false)
    }
    
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as { email: string } | null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstall(false)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <nav className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="text-2xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
            GEONOVA
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <NavLink href="/tools">Quick Tools</NavLink>
            <NavLink href="/tools/distance">Distance</NavLink>
            <NavLink href="/tools/bearing">Bearing</NavLink>
            <NavLink href="/tools/area">Area</NavLink>
            <NavLink href="/tools/traverse">Traverse</NavLink>
            <NavLink href="/tools/leveling">Leveling</NavLink>
            <NavLink href="/tools/coordinates">Coordinates</NavLink>
            <NavLink href="/tools/curves">Curves</NavLink>
            {showInstall && (
              <button
                onClick={handleInstall}
                className="text-sm border border-[#E8841A] text-[#E8841A] px-3 py-1 rounded hover:bg-[#E8841A] hover:text-black transition"
              >
                📲 Install
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="w-24 h-8 bg-gray-800 animate-pulse rounded"></div>
        ) : user ? (
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
              Dashboard
            </Link>
            <span className="text-sm text-gray-500">{user.email}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm border border-gray-600 text-gray-300 rounded hover:border-[#E8841A] hover:text-[#E8841A] transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link href="/login" className="px-4 py-2 text-sm border border-[#E8841A] text-[#E8841A] rounded hover:bg-[#E8841A]/10 transition-colors">
              Log In
            </Link>
            <Link href="/register" className="px-4 py-2 text-sm bg-[#E8841A] text-black font-semibold rounded hover:bg-[#d67715] transition-colors">
              Get Started
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
    >
      {children}
    </Link>
  )
}
