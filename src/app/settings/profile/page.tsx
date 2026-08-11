/**
 * GET /settings/profile — Server-side settings page
 *
 * Renders the new unified Settings UI with tabs:
 *   - Profile (name, phone, address, bio, avatar)
 *   - Company / Firm (firm name, ISK, license number — appears on Deed Plans)
 *   - Notifications (per-channel + per-event preferences)
 *   - Security (change password, account deletion)
 *
 * All four tabs share the same data source — fetched server-side via
 * direct DB query — and are patched in-place via /api/profile/settings.
 */

import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import SettingsTabs from './components/SettingsTabs'
import type { ProfileData } from './components/SettingsTabs'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — METARDU',
  description: 'Manage your profile, company info, notification preferences, and security settings.',
}

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const userId = String(session.user.id)

  // Fetch full profile with firm info from joined surveyor_profiles
  const { rows } = await db.query<ProfileData>(
    `SELECT
       p.id, p.full_name, p.firm_name, p.isk_number, p.phone,
       p.address, p.bio, p.avatar_url,
       p.notification_preferences,
       p.notification_preferences_updated_at,
       sp.license_number,
       sp.verified_isk,
       sp.is_suspended,
       sp.firm_name AS sp_firm_name,
       sp.isk_number AS sp_isk_number,
       sp.phone AS sp_phone,
       u.email, u.role, u.created_at
     FROM profiles p
     LEFT JOIN surveyor_profiles sp ON sp.user_id = p.id
     LEFT JOIN users u ON u.id = p.id
     WHERE p.id = $1`,
    [userId],
  )

  const profile = rows[0] ?? null
  const dbError = rows.length === 0

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-1">
          Account Settings
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-secondary)]">
          Manage your profile, company info, notifications, and security in one place.
        </p>
      </header>

      {dbError ? (
        <div className="mb-6 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 text-sm">
          <strong className="font-semibold">Couldn&apos;t load your profile.</strong>{' '}
          The database may be temporarily unavailable. You can still update fields below —
          they will be saved when the connection is restored.
        </div>
      ) : null}

      <SettingsTabs initialProfile={profile} sessionEmail={session.user.email ?? ''} />
    </div>
  )
}
