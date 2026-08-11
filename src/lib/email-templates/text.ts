/**
 * Plain-text fallback for every email template.
 *
 * Required because some email clients (and accessibility tools) prefer plain
 * text, and many spam filters score messages without a text/plain part lower.
 * The plain text is auto-derived from the same data the HTML uses.
 */

import { formatCurrency, formatDate } from './utils'

export interface WelcomeTextArgs {
  name: string
  trialEndsAt: string
}
export function welcomeText({ name, trialEndsAt }: WelcomeTextArgs): string {
  return `Welcome to METARDU${name ? `, ${name}` : ''}!

Your 14-day Pro trial is now active — it ends on ${formatDate(trialEndsAt)}.

With Pro you can:
  - Create unlimited survey projects
  - Run Bowditch and least-squares traverse adjustments
  - Generate deed plans, Form No. 4, and statutory workbooks
  - Export to DXF, GeoJSON, Shapefile
  - Use GPS stakeout in the field
  - Connect to RTK GNSS receivers via Bluetooth

Get started:
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'}/dashboard

Questions? Reply to this email or write to support@metardu.com.

— METARDU
`
}

export interface TrialEndingTextArgs {
  name: string
  trialEndsAt: string
  planPriceNote: string
}
export function trialEndingText({ name, trialEndsAt, planPriceNote }: TrialEndingTextArgs): string {
  return `Hi${name ? ` ${name}` : ''} — your METARDU Pro trial ends on ${formatDate(trialEndsAt)}.

After the trial you'll move to the Free plan (1 project, 50 survey points, basic PDF reports).

Keep your Pro features (${planPriceNote}):
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'}/pricing

Questions? Reply to this email or write to support@metardu.com.

— METARDU
`
}

export interface TrialExpiringTextArgs {
  name: string
  trialEndsAt: string
  planPriceNote: string
}
export function trialExpiringText({ name, trialEndsAt, planPriceNote }: TrialExpiringTextArgs): string {
  return `Hi${name ? ` ${name}` : ''} — your METARDU Pro trial ends in under 24 hours (on ${formatDate(trialEndsAt)}).

After that you'll move to the Free plan automatically. Your projects, observations, and documents stay safe.

Keep Pro (${planPriceNote}):
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'}/pricing

— METARDU
`
}

export interface PasswordResetTextArgs {
  name: string
  resetUrl: string
  expiresAt: string
}
export function passwordResetText({ name, resetUrl, expiresAt }: PasswordResetTextArgs): string {
  return `Hi${name ? ` ${name}` : ''},

We received a request to reset your METARDU password. Open this link to choose a new password:

${resetUrl}

This link expires on ${formatDate(expiresAt)}.

If you didn't request this reset, you can safely ignore this email — your password is still secure.

— METARDU
`
}

export interface PaymentReceiptTextArgs {
  name: string
  planName: string
  amount: number
  currency: string
  paidAt: string
  receiptUrl?: string
}
export function paymentReceiptText(args: PaymentReceiptTextArgs): string {
  const lines = [
    `Hi${args.name ? ` ${args.name}` : ''},`,
    '',
    `Thanks for your payment — your ${args.planName} subscription is now active.`,
    '',
    `Amount paid: ${formatCurrency(args.amount, args.currency)}`,
    `Date: ${formatDate(args.paidAt)}`,
  ]
  if (args.receiptUrl) {
    lines.push('', `View receipt: ${args.receiptUrl}`)
  }
  lines.push(
    '',
    'You can manage your subscription from your account settings:',
    `  ${process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'}/settings/profile`,
    '',
    '— METARDU',
  )
  return lines.join('\n')
}

export interface PaymentFailedTextArgs {
  name: string
  planName: string
  amount: number
  currency: string
  failureReason: string
  retryUrl: string
}
export function paymentFailedText(args: PaymentFailedTextArgs): string {
  return `Hi${args.name ? ` ${args.name}` : ''},

We couldn't process your payment for the ${args.planName} plan.

Amount: ${formatCurrency(args.amount, args.currency)}
Reason: ${args.failureReason}

Your subscription is paused but your data is safe. Update your payment method and retry:

${args.retryUrl}

If this was a one-off issue, just try again. If your card is expired or you want to switch to M-Pesa, reply to this email and we'll help.

— METARDU
`
}

export interface SecurityAlertTextArgs {
  name: string
  eventName: string
  deviceInfo: string
  location: string
  timestamp: string
  reviewUrl: string
}
export function securityAlertText(args: SecurityAlertTextArgs): string {
  return `Hi${args.name ? ` ${args.name}` : ''},

We detected ${args.eventName} on your METARDU account.

  When: ${formatDate(args.timestamp)}
  Device: ${args.deviceInfo}
  Location: ${args.location}

If this was you, no action is needed. If not, please review your account activity and change your password:

${args.reviewUrl}

— METARDU Security
`
}

export interface ProjectSharedTextArgs {
  recipientName: string
  sharerName: string
  projectName: string
  role: string
  projectUrl: string
}
export function projectSharedText(args: ProjectSharedTextArgs): string {
  return `Hi${args.recipientName ? ` ${args.recipientName}` : ''},

${args.sharerName} shared the project "${args.projectName}" with you as ${args.role}.

Open the project:
${args.projectUrl}

You'll be able to view and contribute based on your role. Reply to this email if you have any questions.

— METARDU
`
}

export interface WeeklyDigestTextArgs {
  name: string
  weekStart: string
  weekEnd: string
  projectsActive: number
  projectsCompleted: number
  pointsCollected: number
  documentsGenerated: number
  pendingSubmissions: number
  dashboardUrl: string
}
export function weeklyDigestText(args: WeeklyDigestTextArgs): string {
  return `Hi${args.name ? ` ${args.name}` : ''},

Here's your METARDU activity for ${formatDate(args.weekStart)} — ${formatDate(args.weekEnd)}:

  Active projects: ${args.projectsActive}
  Completed: ${args.projectsCompleted}
  Survey points collected: ${args.pointsCollected}
  Documents generated: ${args.documentsGenerated}
  Pending submissions: ${args.pendingSubmissions}

Open your dashboard:
${args.dashboardUrl}

— METARDU
`
}
