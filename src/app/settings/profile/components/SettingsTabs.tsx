'use client'

import { useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import AvatarUploader from './AvatarUploader'
import ProfileSection from './ProfileSection'
import CompanySection from './CompanySection'
import NotificationsSection from './NotificationsSection'
import SecuritySection from './SecuritySection'
import { apiPatch, ApiError } from '@/lib/api/client'
import { z } from 'zod'

export interface ProfileData {
  id: string
  full_name?: string
  firm_name?: string
  isk_number?: string
  phone?: string
  address?: string
  bio?: string
  avatar_url?: string
  notification_preferences?: NotificationPreferences
  notification_preferences_updated_at?: string
  license_number?: string
  verified_isk?: boolean
  is_suspended?: boolean
  sp_firm_name?: string
  sp_isk_number?: string
  sp_phone?: string
  email?: string
  role?: string
  created_at?: string
}

export interface NotificationPreferences {
  email?: Record<string, boolean>
  sms?: Record<string, boolean>
  push?: Record<string, boolean>
  in_app?: Record<string, boolean>
}

interface SettingsTabsProps {
  initialProfile: ProfileData | null
  sessionEmail: string
}

type TabId = 'profile' | 'company' | 'notifications' | 'security'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'company', label: 'Company', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { id: 'security', label: 'Security', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
]

export default function SettingsTabs({ initialProfile, sessionEmail }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile)
  const [saveState, setSaveState] = useState<{ status: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ status: 'idle' })
  const { update: updateSession } = useSession()
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handlePatch = useCallback(async (patch: Partial<ProfileData>) => {
    setSaveState({ status: 'saving' })
    try {
      const result = await apiPatch(
        '/api/profile/settings',
        z.object({ data: z.any() }).passthrough(),
        patch
      )
      setProfile(prev => ({ ...prev, ...result.data }))
      setSaveState({ status: 'saved', message: 'Changes saved' })

      // Refresh session so navbar avatar/name updates immediately
      await updateSession()

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaveState({ status: 'idle' }), 2500)
    } catch (err) {
      setSaveState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      })
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaveState({ status: 'idle' }), 4000)
    }
  }, [updateSession])

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <nav
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 sm:gap-2 border-b border-[var(--border-color)] overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
              </svg>
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Save status banner */}
      {saveState.status !== 'idle' && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm border ${
            saveState.status === 'saving'
              ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
              : saveState.status === 'saved'
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'
              : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
          }`}
        >
          {saveState.status === 'saving' && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {saveState.status === 'saved' && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {saveState.status === 'error' && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>
            {saveState.status === 'saving' ? 'Saving…' : saveState.message}
          </span>
        </div>
      )}

      {/* Tab Panels */}
      <div
        id="panel-profile"
        role="tabpanel"
        aria-labelledby="tab-profile"
        hidden={activeTab !== 'profile'}
        className={activeTab === 'profile' ? 'block' : 'hidden'}
      >
        <AvatarUploader
          currentAvatar={profile?.avatar_url ?? null}
          fullName={profile?.full_name ?? ''}
          email={sessionEmail}
          userId={profile?.id ?? ''}
          onUploaded={(url) => handlePatch({ avatar_url: url })}
        />
        <ProfileSection profile={profile} onPatch={handlePatch} />
      </div>

      <div
        id="panel-company"
        role="tabpanel"
        aria-labelledby="tab-company"
        hidden={activeTab !== 'company'}
        className={activeTab === 'company' ? 'block' : 'hidden'}
      >
        <CompanySection profile={profile} onPatch={handlePatch} />
      </div>

      <div
        id="panel-notifications"
        role="tabpanel"
        aria-labelledby="tab-notifications"
        hidden={activeTab !== 'notifications'}
        className={activeTab === 'notifications' ? 'block' : 'hidden'}
      >
        <NotificationsSection
          preferences={profile?.notification_preferences ?? null}
          lastUpdated={profile?.notification_preferences_updated_at ?? null}
          onPatch={(prefs) => handlePatch({ notification_preferences: prefs })}
        />
      </div>

      <div
        id="panel-security"
        role="tabpanel"
        aria-labelledby="tab-security"
        hidden={activeTab !== 'security'}
        className={activeTab === 'security' ? 'block' : 'hidden'}
      >
        <SecuritySection email={sessionEmail} />
      </div>
    </div>
  )
}
