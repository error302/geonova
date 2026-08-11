/**
 * Trial-ending email — sent 3 days before trial expiry.
 *
 * Triggered by: scheduled job (cron) checking user_subscriptions.trial_ends_at.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  List,
  PrimaryButton,
  Accent,
  Divider,
  Link,
  escapeHtml,
} from './components'
import { trialEndingText, TrialEndingTextArgs } from './text'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface TrialEndingEmail {
  to: string
  name: string
  trialEndsAt: string
  planPriceNote: string
}

export const trialEndingEmail = {
  subject: 'Your METARDU Pro trial ends in 3 days',
  render(args: TrialEndingEmail) {
    const bodyHtml = `
      ${Heading('Your Pro trial ends soon')}
      ${RichParagraph(`Hi${args.name ? ` ${escapeHtml(args.name)}` : ''}, your 14-day Pro trial ends on ${Accent(formatTrialEnd(args.trialEndsAt))}.`)}
      ${Paragraph('After the trial you will move to the Free plan, which includes:')}
      ${List([
        '<strong style="color:#e5e5e5;">1 project</strong> (vs. unlimited on Pro)',
        '<strong style="color:#e5e5e5;">50 survey points</strong> (vs. unlimited on Pro)',
        'Basic PDF reports only',
      ])}
      ${Divider()}
      ${RichParagraph(`Keep everything you have built — projects, observations, documents — and continue with ${Accent('unlimited')} projects, DXF/GeoJSON export, GPS stakeout, RTK GNSS, and priority support.`)}
      ${RichParagraph(`Pro is ${Accent(args.planPriceNote)}. Cancel any time — no lock-in.`)}
      ${PrimaryButton(`${APP_URL}/pricing`, 'Choose your plan')}
      ${Paragraph(`Prefer to keep using the Free plan? No action needed — we will move you automatically on ${formatTrialEnd(args.trialEndsAt)}. You can always upgrade later from ${Link(`${APP_URL}/settings/profile`, 'your settings')}.`, { small: true, muted: true })}
    `
    return {
      subject: trialEndingEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: `Your Pro trial ends on ${formatTrialEnd(args.trialEndsAt)} — keep your projects and features.`,
      }),
      text: trialEndingText(args),
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

export type { TrialEndingTextArgs }
