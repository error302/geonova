/**
 * Trial expiring email — final reminder sent in the last 24 hours before
 * trial expiry, to users who never upgraded.
 *
 * Triggered by: scheduled job (cron) checking user_subscriptions.trial_ends_at.
 * This is the second touch — the 3-day reminder (trialEnding) is the primary;
 * this one is deliberately shorter and more urgent.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  Accent,
  Link,
  escapeHtml,
} from './components'
import { trialExpiringText, TrialExpiringTextArgs } from './text'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface TrialExpiringEmail {
  to: string
  name: string
  trialEndsAt: string
  planPriceNote: string
}

export const trialExpiringEmail = {
  subject: '24 hours left on your METARDU Pro trial',
  render(args: TrialExpiringEmail) {
    const bodyHtml = `
      ${Heading('24 hours left')}
      ${RichParagraph(`Hi${args.name ? ` ${escapeHtml(args.name)}` : ''}, your Pro trial ends ${Accent(formatTrialEnd(args.trialEndsAt))} — in under 24 hours.`)}
      ${Paragraph('When it ends you will move to the Free plan automatically. Your projects, observations, and documents stay safe — nothing is deleted.')}
      ${PrimaryButton(`${APP_URL}/pricing`, 'Upgrade to Pro')}
      ${Paragraph(`Pro is ${Accent(args.planPriceNote)}. No action needed? We will move you to Free automatically — you can upgrade anytime from ${Link(`${APP_URL}/settings/profile`, 'your settings')}.`, { small: true, muted: true })}
    `
    return {
      subject: trialExpiringEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: `Your Pro trial ends ${formatTrialEnd(args.trialEndsAt)} — keep unlimited projects and features.`,
      }),
      text: trialExpiringText(args),
    }
  },
}

function formatTrialEnd(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export type { TrialExpiringTextArgs }
