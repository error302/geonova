/**
 * Security alert email — sent on suspicious account activity.
 *
 * Triggers include:
 *   - New device / new browser login (fingerprint change)
 *   - Password changed
 *   - Email changed
 *   - 2FA disabled (if/when 2FA ships)
 *   - API key created
 *
 * Always sent — security events are not subject to notification preferences
 * (per NIST 800-63B and Kenya DPA 2019 best practice).
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  CalloutBox,
  Accent,
  Link,
} from './components'
import { securityAlertText, SecurityAlertTextArgs } from './text'
import { formatDateTime } from './utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface SecurityAlertEmail {
  to: string
  name: string
  /** What happened — e.g. "a new device signed in to your account". */
  eventName: string
  /** Short description of the device (UA-derived). */
  deviceInfo: string
  /** Approximate location (city, country) — derived from IP geolocation. */
  location: string
  /** ISO timestamp of the event. */
  timestamp: string
}

export const securityAlertEmail = {
  subject: 'Security alert — new activity on your METARDU account',
  render(args: SecurityAlertEmail) {
    const reviewUrl = `${APP_URL}/settings/profile?tab=security`
    const bodyHtml = `
      ${Heading('New activity on your account')}
      ${Paragraph(`Hi${args.name ? ` ${args.name}` : ''}, we are letting you know that ${escapeOnce(args.eventName)}.`)}
      ${CalloutBox(
        'Event details',
        `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#8a8a96;font-size:12px;padding:2px 0;">When</td><td style="color:#e5e5e5;font-size:13px;text-align:right;padding:2px 0;">${formatDateTime(args.timestamp)}</td></tr>
            <tr><td style="color:#8a8a96;font-size:12px;padding:2px 0;">Device</td><td style="color:#e5e5e5;font-size:13px;text-align:right;padding:2px 0;">${escapeOnce(args.deviceInfo)}</td></tr>
            <tr><td style="color:#8a8a96;font-size:12px;padding:2px 0;">Approx. location</td><td style="color:#e5e5e5;font-size:13px;text-align:right;padding:2px 0;">${escapeOnce(args.location)}</td></tr>
          </table>
        `,
        { tone: 'info' },
      )}
      ${RichParagraph(`If this was you, ${Accent('no action is needed')}. You can ignore this email.`)}
      ${RichParagraph(`If you do not recognize this activity, please:`)}
      <ol style="margin:0 0 16px;padding-left:22px;color:#cccccc;font-size:14px;line-height:1.8;">
        <li>${Link(reviewUrl, 'Review your recent account activity')}</li>
        <li>Change your password immediately</li>
        <li>Sign out of all other devices from your security settings</li>
      </ol>
      ${PrimaryButton(reviewUrl, 'Review account activity')}
      ${Paragraph('You are receiving this email because we send security alerts for every new sign-in on an unrecognized device. This helps protect your account even if someone learns your password.', { small: true, muted: true })}
    `
    return {
      subject: securityAlertEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: `${args.eventName} — ${formatDateTime(args.timestamp)}. If this was not you, please review your account.`,
        showUnsubscribe: false,
      }),
      text: securityAlertText({
        name: args.name,
        eventName: args.eventName,
        deviceInfo: args.deviceInfo,
        location: args.location,
        timestamp: args.timestamp,
        reviewUrl,
      }),
    }
  },
}

export type { SecurityAlertTextArgs }

function escapeOnce(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
