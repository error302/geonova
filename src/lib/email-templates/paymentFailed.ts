/**
 * Payment failed email — sent when a subscription payment is declined.
 *
 * Triggered by: PayPal webhook BILLING.SUBSCRIPTION.PAYMENT.FAILED,
 * M-Pesa callback with non-success result, or Stripe invoice.payment_failed.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  CalloutBox,
  Accent,
  Divider,
  Link,
} from './components'
import { paymentFailedText, PaymentFailedTextArgs } from './text'
import { formatCurrency } from './utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface PaymentFailedEmail {
  to: string
  name: string
  planName: string
  amount: number
  currency: string
  failureReason: string
  /** Next automatic retry date (optional — provider-dependent). */
  retryAt?: string
}

export const paymentFailedEmail = {
  subject: 'We could not process your payment',
  render(args: PaymentFailedEmail) {
    const retryUrl = `${APP_URL}/settings/profile?tab=billing`
    const bodyHtml = `
      ${Heading('Payment did not go through')}
      ${Paragraph(`Hi${args.name ? ` ${args.name}` : ''}, we tried to charge your payment method for the ${args.planName} plan but it did not go through.`)}
      ${CalloutBox(
        'What happened',
        `${escapeOnce(formatCurrency(args.amount, args.currency))} for ${escapeOnce(args.planName)} — ${escapeOnce(args.failureReason)}`,
        { tone: 'warning' },
      )}
      ${RichParagraph(`Your projects, observations, and documents are ${Accent('safe')} — we do not delete any of your work. Your subscription is paused until you update your payment method.`)}
      ${args.retryAt
        ? Paragraph(`We will try again automatically on ${escapeOnce(args.retryAt)}. To avoid another failed charge, please update your details before then.`, { small: true, muted: true })
        : ''}
      ${PrimaryButton(retryUrl, 'Update payment method')}
      ${Divider()}
      ${Paragraph('Other options:', { small: true, muted: true })}
      <ul style="margin:0 0 16px;padding-left:22px;color:#cccccc;font-size:14px;line-height:1.6;">
        <li style="margin-bottom:6px;">Switch to ${Link(`${APP_URL}/pricing`, 'M-Pesa')} (no card required)</li>
        <li style="margin-bottom:6px;">${Link(`mailto:support@metardu.com?subject=Payment%20issue%20—%20${encodeURIComponent(args.planName)}`, 'Email us')} — we can extend your trial by a few days while you sort it out</li>
        <li style="margin-bottom:6px;">${Link(`${APP_URL}/pricing`, 'Downgrade to Free')} — keep your data, lose Pro features</li>
      </ul>
    `
    return {
      subject: paymentFailedEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: `Payment for ${args.planName} failed — your data is safe. Update your payment method to continue.`,
        showUnsubscribe: false,
      }),
      text: paymentFailedText({
        name: args.name,
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        failureReason: args.failureReason,
        retryUrl,
      }),
    }
  },
}

export type { PaymentFailedTextArgs }

// Minimal escape (for the inline failureReason insertion) — keeps the
// imported component list lean. The same escaping is already applied in
// the components module for full strings.
function escapeOnce(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
