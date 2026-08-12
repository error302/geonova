/**
 * Africa's Talking SMS/WhatsApp notification service for METARDU.
 *
 * SMS and WhatsApp notifications via Africa's Talking API (africastalking.com).
 * Used for:
 *   - Survey lock/approval alerts
 *   - Submission status updates
 *   - Peer review notifications
 *   - System alerts (subscription expiry, etc.)
 *
 * Environment variables:
 *   AFRICASTALKING_USERNAME    — Africa's Talking username
 *   AFRICASTALKING_API_KEY    — Africa's Talking API key
 *   AFRICASTALKING_SENDER_ID  — Registered sender ID (or defaults to sandbox)
 *   AFRICASTALKING_ENABLED    — 'true' to enable, any other value to disable
 */

import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────

export type NotificationChannel = 'sms' | 'whatsapp'

export interface NotificationPayload {
  to: string           // Phone number in E.164 format (e.g. +254712345678)
  channel: NotificationChannel
  message: string
  reference?: string   // Optional reference ID for tracking (e.g. projectId)
}

export interface NotificationResult {
  success: boolean
  messageId?: string
  cost?: string
  error?: string
}

export type NotificationEventType =
  | 'project:locked'
  | 'project:submitted'
  | 'peer_review:assigned'
  | 'peer_review:completed'
  | 'subscription:expiring'
  | 'subscription:expired'
  | 'system:maintenance'

// ── Templates ──────────────────────────────────────────────────

const TEMPLATES: Record<NotificationEventType, (data: Record<string, string>) => string> = {
  'project:locked': (d) =>
    `METARDU: Project "${d.projectName}" (LR ${d.lrNumber || 'N/A'}) has been approved and locked by ${d.surveyorName}. Seal: ${d.seal?.substring(0, 12)}...`,

  'project:submitted': (d) =>
    `METARDU: Submission for "${d.projectName}" (LR ${d.lrNumber || 'N/A'}) has been submitted for review.`,

  'peer_review:assigned': (d) =>
    `METARDU: You have been assigned a peer review for "${d.projectName}" by ${d.surveyorName}. Please log in to review.`,

  'peer_review:completed': (d) =>
    `METARDU: Peer review for "${d.projectName}" is complete. Verdict: ${d.verdict}.`,

  'subscription:expiring': (d) =>
    `METARDU: Your ${d.plan} subscription expires in ${d.daysRemaining} days. Renew to avoid service interruption.`,

  'subscription:expired': (d) =>
    `METARDU: Your ${d.plan} subscription has expired. Your data is safe — renew to regain full access.`,

  'system:maintenance': (d) =>
    `METARDU: Scheduled maintenance on ${d.date} from ${d.startTime} to ${d.endTime}. Expect brief downtime.`,
}

// ── Service ────────────────────────────────────────────────────

function isConfigured(): boolean {
  return !!(env.AFRICASTALKING_USERNAME && env.AFRICASTALKING_API_KEY)
}

function isEnabled(): boolean {
  if (env.AFRICASTALKING_ENABLED === 'true' && isConfigured()) return true
  // In development, allow when configured but not explicitly enabled
  if (process.env.NODE_ENV === 'development' && isConfigured()) return true
  return false
}

/**
 * Send an SMS via Africa's Talking.
 */
export async function sendSMS(to: string, message: string): Promise<NotificationResult> {
  if (!isEnabled()) {
    return { success: true, messageId: 'dev-skip', error: 'Notifications disabled' }
  }

  try {
    const username = env.AFRICASTALKING_USERNAME
    const apiKey = env.AFRICASTALKING_API_KEY
    if (!username || !apiKey) {
      return { success: false, error: 'Africa\'s Talking credentials not configured' }
    }
    const senderId = env.AFRICASTALKING_SENDER_ID || 'METARDU'

    // Africa's Talking SMS API v1
    const response = await fetch('https://api.africastalking.com/v1/messaging', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'apikey': apiKey,
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        username,
        to,
        message,
        from: senderId,
      }).toString(),
    })

    const data = (await response.json()) as {
      SMSMessageData?: { Recipients?: Array<{ status: string; messageId?: string; cost?: string }> }
    }

    const recipients = data.SMSMessageData?.Recipients
    if (recipients && recipients.length > 0) {
      const recipient = recipients[0]
      return {
        success: recipient.status === 'Success',
        messageId: recipient.messageId,
        cost: recipient.cost,
        error: recipient.status !== 'Success' ? recipient.status : undefined,
      }
    }

    return { success: false, error: JSON.stringify(data) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Unknown error'
    logger.error('[Notification] SMS send failed:', { error: msg })
    return { success: false, error: msg }
  }
}

/**
 * Send a WhatsApp message via Africa's Talking.
 */
export async function sendWhatsApp(to: string, message: string): Promise<NotificationResult> {
  if (!isEnabled()) {
    return { success: true, messageId: 'dev-skip', error: 'Notifications disabled' }
  }

  try {
    const username = env.AFRICASTALKING_USERNAME
    const apiKey = env.AFRICASTALKING_API_KEY
    if (!username || !apiKey) {
      return { success: false, error: 'Africa\'s Talking credentials not configured' }
    }

    // Africa's Talking WhatsApp sandbox API
    const response = await fetch(`https://api.africastalking.com/v1/africastalking/${username}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: `whatsapp:${to}`,
        type: 'text',
        message,
      }),
    })

    const data = await response.json() as unknown as Record<string, unknown>
    const msgId = data.messageId as string | undefined

    if (data.status === 'Success' || msgId) {
      return {
        success: true,
        messageId: msgId,
      }
    }

    return { success: false, error: JSON.stringify(data) }
  } catch (err: unknown) {
    const msg = err instanceof Error ? (err as Error).message : 'Unknown error'
    logger.error('[Notification] WhatsApp send failed:', { error: msg })
    return { success: false, error: msg }
  }
}

/**
 * Send a notification through the specified channel.
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  if (payload.channel === 'whatsapp') {
    return sendWhatsApp(payload.to, payload.message)
  }
  return sendSMS(payload.to, payload.message)
}

/**
 * Convenience: send a templated notification.
 */
export async function sendTemplatedNotification(
  eventType: NotificationEventType,
  to: string,
  channel: NotificationChannel = 'sms',
  templateData: Record<string, string> = {},
): Promise<NotificationResult> {
  const templateFn = TEMPLATES[eventType]
  if (!templateFn) {
    return { success: false, error: `Unknown notification event type: ${eventType}` }
  }

  const message = templateFn(templateData)
  return sendNotification({ to, channel, message, reference: templateData.projectId })
}

/**
 * Notify project team when a project is approved & locked.
 * Sends to the project surveyor's phone number if available.
 */
export async function notifyProjectLocked(data: {
  projectName: string
  lrNumber?: string
  surveyorName: string
  surveyorPhone?: string
  seal?: string
  projectId?: string
}): Promise<void> {
  if (!data.surveyorPhone) return

  await sendTemplatedNotification('project:locked', data.surveyorPhone, 'sms', {
    projectName: data.projectName,
    lrNumber: data.lrNumber || '',
    surveyorName: data.surveyorName,
    seal: data.seal || '',
    projectId: data.projectId || '',
  })
}
