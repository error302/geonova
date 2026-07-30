'use client'

import { useState } from 'react'
import { apiPost, ApiError } from '@/lib/api/client'
import { z } from 'zod'

interface SecuritySectionProps {
  email: string
}

export default function SecuritySection({ email }: SecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<{ state: 'idle' | 'saving' | 'saved' | 'error'; message?: string }>({ state: 'idle' })
  const [showPasswords, setShowPasswords] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      setStatus({ state: 'error', message: 'New password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ state: 'error', message: 'New passwords do not match.' })
      return
    }
    if (newPassword === currentPassword) {
      setStatus({ state: 'error', message: 'New password must be different from the current one.' })
      return
    }

    setStatus({ state: 'saving' })

    try {
      await apiPost(
        '/api/auth/update-password',
        z.any(),
        {
          currentPassword,
          password: newPassword,
        }
      )

      setStatus({ state: 'saved', message: 'Password updated successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setStatus({
        state: 'error',
        message: err instanceof ApiError ? err.message : (err as Error).message || 'Password update failed',
      })
    }
  }

  const passwordStrength = (() => {
    if (!newPassword) return { score: 0, label: '', color: '' }
    let score = 0
    if (newPassword.length >= 8) score++
    if (newPassword.length >= 12) score++
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score++
    if (/\d/.test(newPassword)) score++
    if (/[^A-Za-z0-9]/.test(newPassword)) score++

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' }
    if (score <= 3) return { score, label: 'Good', color: 'bg-blue-500' }
    return { score, label: 'Strong', color: 'bg-green-500' }
  })()

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 p-5 sm:p-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]"
      >
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Change Password</h2>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Use at least 8 characters with a mix of letters, numbers, and symbols.
          </p>
        </div>

        <div>
          <label htmlFor="current_password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Current Password
          </label>
          <input
            id="current_password" aria-label="Current password"
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label htmlFor="new_password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            New Password
          </label>
          <input
            id="new_password" aria-label="New password"
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
          />
          {newPassword && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className={`h-full ${passwordStrength.color} transition-all`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-xs text-[var(--text-secondary)] font-medium min-w-[3.5rem]">
                {passwordStrength.label}
              </span>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Confirm New Password
          </label>
          <input
            id="confirm_password" aria-label="Confirm password"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={`w-full px-3 py-2 bg-[var(--bg-primary)] border rounded-lg text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)] ${
              confirmPassword && confirmPassword !== newPassword
                ? 'border-red-400 dark:border-red-700'
                : 'border-[var(--border-color)]'
            }`}
          />
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">Passwords do not match.</p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input aria-label="Showpasswords"
            type="checkbox"
            checked={showPasswords}
            onChange={(e) => setShowPasswords(e.target.checked)}
            className="rounded border-[var(--border-color)]"
          />
          Show passwords
        </label>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={status.state === 'saving' || !currentPassword || !newPassword || !confirmPassword}
            className="px-5 py-2 text-sm font-medium bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status.state === 'saving' ? 'Updating…' : 'Update Password'}
          </button>
          {status.state === 'saved' && (
            <span className="text-sm text-green-600 dark:text-green-400" role="status">
              {status.message}
            </span>
          )}
          {status.state === 'error' && (
            <span className="text-sm text-red-600 dark:text-red-400" role="alert">
              {status.message}
            </span>
          )}
        </div>
      </form>

      {/* Active Sessions */}
      <div className="p-5 sm:p-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Active Sessions</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          You&apos;re currently signed in on this device.
        </p>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-tertiary)]">
            <svg className="w-5 h-5 text-[var(--accent)] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Current device</p>
              <p className="text-xs text-[var(--text-muted)]">{email}</p>
            </div>
            <span className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
              Active now
            </span>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-5 sm:p-6 bg-[var(--bg-secondary)] rounded-xl border border-red-200 dark:border-red-900/50">
        <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">Danger Zone</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          These actions are permanent and cannot be undone.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--border-color)] flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-[var(--text-primary)]">Sign out of all other devices</p>
              <p className="text-xs text-[var(--text-muted)]">
                Revoke all active sessions except this one.
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-medium border border-[var(--border-color)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-tertiary)]"
              onClick={() => {
                // Defer to NextAuth signOut flow — not yet wired in this prototype
                alert('This will sign you out everywhere. Feature coming soon.')
              }}
            >
              Sign out everywhere
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-200 dark:border-red-900/50 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-medium text-red-700 dark:text-red-400">Delete account</p>
              <p className="text-xs text-[var(--text-muted)]">
                Permanently delete all projects, observations, and documents. This cannot be reversed.
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700"
              onClick={() => {
                if (confirm('Are you sure? This will permanently delete all your data.')) {
                  alert('Account deletion requires admin verification. Please contact support@metardu.com.')
                }
              }}
            >
              Delete account
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
