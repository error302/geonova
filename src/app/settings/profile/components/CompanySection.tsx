'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ProfileData } from './SettingsTabs'

interface CompanySectionProps {
  profile: ProfileData | null
  onPatch: (patch: Partial<ProfileData>) => Promise<void>
}

export default function CompanySection({ profile, onPatch }: CompanySectionProps) {
  const [form, setForm] = useState({
    firm_name: profile?.firm_name ?? '',
    isk_number: profile?.isk_number ?? '',
    license_number: profile?.license_number ?? '',
  })
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setForm({
      firm_name: profile?.firm_name ?? profile?.sp_firm_name ?? '',
      isk_number: profile?.isk_number ?? profile?.sp_isk_number ?? '',
      license_number: profile?.license_number ?? '',
    })
    setDirty(false)
  }, [profile?.firm_name, profile?.isk_number, profile?.license_number, profile?.sp_firm_name, profile?.sp_isk_number])

  const handleChange = useCallback((field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setDirty(true)
  }, [])

  const handleSave = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onPatch(form)
    },
    [form, onPatch],
  )

  return (
    <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Company / Firm Information</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          This information appears on Deed Plans, Form No. 4 certificates, and statutory workbooks
          submitted to the Survey of Kenya. Keep it accurate and up to date.
        </p>
      </div>

      <Field
        label="Firm / Company Name"
        value={form.firm_name}
        onChange={(v) => handleChange('firm_name', v)}
        placeholder="e.g. XYZ Surveyors Ltd"
        maxLength={255}
        hint="Registered business name. Appears on the surveyor declaration block of every deed plan."
      />

      <Field
        label="ISK Registration Number"
        value={form.isk_number}
        onChange={(v) => handleChange('isk_number', v)}
        placeholder="e.g. ISK/1234"
        maxLength={50}
        hint="Your Institution of Surveyors of Kenya registration number."
      />

      <div className="flex items-center gap-2">
        <Field
          label="Survey of Kenya License Number"
          value={form.license_number}
          onChange={(v) => handleChange('license_number', v)}
          placeholder="e.g. LS/456/2024"
          maxLength={100}
          hint="Your practicing license from the Survey of Kenya."
        />
        {profile?.verified_isk ? (
          <span className="mt-6 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-800">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        ) : (
          <span className="mt-6 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium border border-amber-200 dark:border-amber-800">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Pending verification
          </span>
        )}
      </div>

      {profile?.is_suspended && (
        <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
          <strong>Account suspended.</strong> Your surveyor privileges are currently revoked.
          Contact the administrator for reinstatement.
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!dirty}
          className="px-5 py-2 text-sm font-medium bg-[var(--accent)] text-black rounded-lg hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save Company Info
        </button>
        {dirty && (
          <span className="text-xs text-[var(--text-muted)]">Unsaved changes</span>
        )}
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  hint?: string
}) {
  return (
    <div>
      <label
        htmlFor={label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
        className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
      >
        {label}
      </label>
      <input
        id={label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]"
      />
      {hint && <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>}
    </div>
  )
}
