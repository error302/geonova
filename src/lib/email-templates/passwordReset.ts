/**
 * Password reset email — sent when user requests a password reset.
 *
 * Triggered by: /api/auth/forgot-password route.
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  PrimaryButton,
  CalloutBox,
} from './components'
import { passwordResetText, PasswordResetTextArgs } from './text'
import { formatDateTime } from './utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface PasswordResetEmail {
  to: string
  name: string
  resetToken: string
  expiresAt: string
}

export const passwordResetEmail = {
  subject: 'Reset your METARDU password',
  render(args: PasswordResetEmail) {
    const resetUrl = `${APP_URL}/auth/reset-password?token=${encodeURIComponent(args.resetToken)}`
    const expiryLabel = formatDateTime(args.expiresAt)

    const bodyHtml = `
      ${Heading('Reset your password')}
      ${Paragraph(`Hi${args.name ? ` ${args.name}` : ''}, we received a request to reset the password on your METARDU account.`)}
      ${PrimaryButton(resetUrl, 'Reset password')}
      ${Paragraph(`This link expires on ${expiryLabel}. After that you will need to request a new one.`, { small: true, muted: true })}
      ${CalloutBox(
        'Did you not request this?',
        `Someone entered your email address on the METARDU sign-in page. If it wasn't you, your account is still secure — just ignore this email and your password stays the same.`,
        { tone: 'info' },
      )}
      ${Paragraph('If the button above does not work, copy and paste this link into your browser:', { small: true, muted: true })}
      <p style="margin:0 0 16px;color:#8a8a96;font-size:12px;word-break:break-all;font-family:ui-monospace,SFMono-Regular,monospace;">${resetUrl}</p>
    `
    return {
      subject: passwordResetEmail.subject,
      html: renderEmailLayout(bodyHtml, {
        preheader: 'Reset your METARDU password — link expires in 1 hour.',
        showUnsubscribe: false,
      }),
      text: passwordResetText({ name: args.name, resetUrl, expiresAt: args.expiresAt }),
    }
  },
}

export type { PasswordResetTextArgs }
