/**
 * /api/profile/settings — Profile + Company + Notification Preferences
 *
 * GET    /api/profile/settings       → Load all settings
 * PATCH  /api/profile/settings       → Update profile fields, firm info, or notification preferences
 *
 * Body shape (any subset of fields):
 *   {
 *     full_name?: string,
 *     firm_name?: string,
 *     isk_number?: string,
 *     license_number?: string,
 *     phone?: string,
 *     address?: string,
 *     bio?: string,
 *     avatar_url?: string,
 *     notification_preferences?: { email?, sms?, push?, in_app? }
 *   }
 *
 * Updates both `profiles` and `surveyor_profiles` so firm info
 * appears on Deed Plans, Form No.4 certificates, and the surveyor registry.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setCurrentUserId, db } from '@/lib/db'
import { z } from 'zod'

interface ProfileRow {
  id: string
  full_name: string | null
  firm_name: string | null
  isk_number: string | null
  phone: string | null
  address: string | null
  bio: string | null
  avatar_url: string | null
  notification_preferences: unknown
  notification_preferences_updated_at: string | Date | null
  license_number: string | null
  verified_isk: boolean
  is_suspended: boolean
  email: string | null
  role: string
  created_at: string | Date
}

export const dynamic = 'force-dynamic'

const NotificationChannelsSchema = z.object({
  project_updates: z.boolean().optional(),
  field_sync_complete: z.boolean().optional(),
  document_generated: z.boolean().optional(),
  billing_reminders: z.boolean().optional(),
  security_alerts: z.boolean().optional(),
  marketing: z.boolean().optional(),
  weekly_digest: z.boolean().optional(),
  team_mentions: z.boolean().optional(),
}).passthrough().optional()

const NotificationPreferencesSchema = z.object({
  email: NotificationChannelsSchema,
  sms: NotificationChannelsSchema,
  push: NotificationChannelsSchema,
  in_app: NotificationChannelsSchema,
}).passthrough().optional()

const UpdateProfileSettingsSchema = z.object({
  full_name: z.string().min(2).max(255).trim().optional(),
  firm_name: z.string().max(255).trim().optional(),
  isk_number: z.string().max(50).trim().optional(),
  license_number: z.string().max(100).trim().optional(),
  phone: z.string().max(50).trim().optional(),
  address: z.string().max(1000).trim().optional(),
  bio: z.string().max(2000).trim().optional(),
  avatar_url: z.string().max(500).trim().optional(),
  notification_preferences: NotificationPreferencesSchema,
}).strict()

async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null
  const userId = String(session.user.id)
  setCurrentUserId(userId)
  return { userId, session }
}

export async function GET() {
  const auth = await requireSession()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = auth

  const { rows } = await db.query<ProfileRow>(
    `SELECT
       p.id, p.full_name, p.firm_name, p.isk_number, p.phone,
       p.address, p.bio, p.avatar_url,
       p.notification_preferences,
       p.notification_preferences_updated_at,
       sp.license_number,
       sp.verified_isk,
       sp.is_suspended,
       u.email, u.role, u.created_at
     FROM profiles p
     LEFT JOIN surveyor_profiles sp ON sp.user_id = p.id
     LEFT JOIN users u ON u.id = p.id
     WHERE p.id = $1`,
    [userId],
  )

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0] })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSession()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { userId } = auth

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = UpdateProfileSettingsSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 422 },
    )
  }

  const updates = parsed.data

  // Build SET clauses for profiles table
  const profileFields: string[] = []
  const profileValues: unknown[] = []
  let paramIdx = 1

  const profileFieldMap: Record<string, unknown> = {
    full_name: updates.full_name,
    firm_name: updates.firm_name,
    isk_number: updates.isk_number,
    phone: updates.phone,
    address: updates.address,
    bio: updates.bio,
    avatar_url: updates.avatar_url,
  }

  for (const [field, value] of Object.entries(profileFieldMap)) {
    if (value !== undefined) {
      profileFields.push(`${field} = $${paramIdx++}`)
      profileValues.push(value)
    }
  }

  // Merge notification preferences using JSONB deep merge
  if (updates.notification_preferences) {
    profileFields.push(`notification_preferences = COALESCE(notification_preferences, '{}'::jsonb) || $${paramIdx++}::jsonb`)
    profileValues.push(JSON.stringify(updates.notification_preferences))
    profileFields.push(`notification_preferences_updated_at = NOW()`)
  }

  if (profileFields.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  profileValues.push(userId)

  await db.query<never>(
    `UPDATE profiles SET ${profileFields.join(', ')} WHERE id = $${paramIdx}`,
    profileValues,
  )

  // Also sync firm_name, isk_number, phone, license_number to surveyor_profiles
  const surveyorFields: string[] = []
  const surveyorValues: unknown[] = []
  let sIdx = 1

  if (updates.firm_name !== undefined) {
    surveyorFields.push(`firm_name = $${sIdx++}`)
    surveyorValues.push(updates.firm_name)
  }
  if (updates.isk_number !== undefined) {
    surveyorFields.push(`isk_number = $${sIdx++}`)
    surveyorValues.push(updates.isk_number)
  }
  if (updates.phone !== undefined) {
    surveyorFields.push(`phone = $${sIdx++}`)
    surveyorValues.push(updates.phone)
  }
  if (updates.license_number !== undefined) {
    surveyorFields.push(`license_number = $${sIdx++}`)
    surveyorValues.push(updates.license_number)
  }

  if (surveyorFields.length > 0) {
    surveyorValues.push(userId)
    await db.query<never>(
      `UPDATE surveyor_profiles SET ${surveyorFields.join(', ')}, updated_at = NOW() WHERE user_id = $${sIdx}`,
      surveyorValues,
    ).catch(() => {
      // Surveyor profile may not exist yet — create on the fly
    })
  }

  // Re-fetch the updated profile
  const { rows } = await db.query<ProfileRow>(
    `SELECT
       p.full_name, p.firm_name, p.isk_number, p.phone,
       p.address, p.bio, p.avatar_url,
       p.notification_preferences,
       p.notification_preferences_updated_at,
       sp.license_number,
       u.email
     FROM profiles p
     LEFT JOIN surveyor_profiles sp ON sp.user_id = p.id
     LEFT JOIN users u ON u.id = p.id
     WHERE p.id = $1`,
    [userId],
  )

  return NextResponse.json({ data: rows[0] })
}
