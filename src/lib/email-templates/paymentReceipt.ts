/**
 * Payment receipt email — sent on successful payment capture.
 *
 * Triggered by: /api/payments/mpesa/callback or PayPal webhook handler.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  StatTable,
  StatRow,
  Accent,
} from './components'
import { paymentReceiptText, PaymentReceiptTextArgs } from './text'
import { formatCurrency, formatDate } from './utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface PaymentReceiptEmail {
  to: string
  name: string
  planName: string
  amount: number
  currency: string
  paidAt: string
  /** Payment provider transaction ID shown on the receipt. */
  transactionId: string
  /** Payment method description (e.g. "M-Pesa · 0712••••••" or "Visa ending 4242"). */
  paymentMethod: string
  /** Optional hosted receipt URL from the provider. */
  receiptUrl?: string
}

export const paymentReceiptEmail = {
  subject: 'Payment received — your METARDU receipt',
  render(args: PaymentReceiptEmail) {
    const bodyHtml = `
      ${Heading('Thanks for your payment!')}
      ${Paragraph(`Hi${args.name ? ` ${args.name}` : ''}, we have received your payment for the ${args.planName} plan. Your subscription is now active.`)}
      ${StatTable(
        StatRow('Plan', args.planName) +
        StatRow('Amount paid', formatCurrency(args.amount, args.currency)) +
        StatRow('Date', formatDate(args.paidAt)) +
        StatRow('Payment method', args.paymentMethod) +
        StatRow('Transaction ID', args.transactionId),
      )}
      ${RichParagraph(`A copy of this receipt is saved in your account under ${Accent('Billing history')}.`)}
      ${PrimaryButton(`${APP_URL}/settings/profile`, 'View billing history')}
      ${Paragraph('If you have any questions about this charge, reply to this email with the transaction ID above and we will get back to you within one business day.', { small: true, muted: true })}
    `
    return {
      subject: paymentReceiptEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: `Receipt for your ${args.planName} subscription — ${formatCurrency(args.amount, args.currency)}.`,
        showUnsubscribe: false,
      }),
      text: paymentReceiptText({
        name: args.name,
        planName: args.planName,
        amount: args.amount,
        currency: args.currency,
        paidAt: args.paidAt,
        receiptUrl: args.receiptUrl,
      }),
    }
  },
}

export type { PaymentReceiptTextArgs }
