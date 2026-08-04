/**
 * Welcome email — sent when a new user signs up.
 *
 * Triggered from: /api/auth/register after successful registration.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  List,
  PrimaryButton,
  Link,
  Accent,
} from './components'
import { welcomeText, WelcomeTextArgs } from './text'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface WelcomeEmail {
  to: string
  name: string
  trialEndsAt: string
}

export const welcomeEmail = {
  subject: 'Welcome to METARDU — your 14-day Pro trial has started',
  render(args: WelcomeEmail) {
    const bodyHtml = `
      ${Heading(`Welcome to METARDU${args.name ? `, ${args.name}` : ''}!`)}
      ${Paragraph('Your 14-day Pro trial is now active. You have full access to every feature — traverse adjustment, deed plans, GNSS stakeout, NLIMS export, and the toolbox of 40+ survey calculators.')}
      ${RichParagraph(`Your trial ends on ${Accent(formatTrialEnd(args.trialEndsAt))}. After that you'll automatically move to the Free plan (1 project, 50 survey points, basic PDF reports).`)}
      ${Paragraph('Here are a few things you can do right now:')}
      ${List([
        `${Link(`${APP_URL}/projects/new`, 'Create your first project')} — choose survey type, enter LR number, set UTM zone`,
        `${Link(`${APP_URL}/fieldbook`, 'Open the field book')} — record traverse and leveling observations`,
        `${Link(`${APP_URL}/tools/all`, 'Browse the toolbox')} — COGO, area, curve, earthworks, and more`,
        `${Link(`${APP_URL}/map`, 'Open the map')} — Cassini sheet lookup, parcel search, offline tiles`,
      ])}
      ${PrimaryButton(`${APP_URL}/dashboard`, 'Open your dashboard')}
      ${Paragraph('If you get stuck, the in-app help center has step-by-step guides. Reply to this email if you need a hand.', { small: true, muted: true })}
    `
    return {
      subject: welcomeEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: 'Your 14-day Pro trial is active — here is what to try first.',
      }),
      text: welcomeText(args),
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

export type { WelcomeTextArgs }
