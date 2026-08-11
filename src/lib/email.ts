import nodemailer from 'nodemailer'
import { logger } from '@/lib/logger'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true, // Use TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export interface SendEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  /** Optional Reply-To address — defaults to the SMTP user. */
  replyTo?: string
  /** Optional custom "from" address — defaults to the SMTP user. */
  from?: string
  /** Optional message headers (e.g. for List-Unsubscribe). */
  headers?: Record<string, string>
}

export async function sendEmail({ to, subject, text, html, replyTo, from, headers }: SendEmailOptions) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn(`[email] Email service not configured. Would have sent "${subject}" to ${to}`)
    return { success: false, error: 'Email service not configured' }
  }

  try {
    const info = await transporter.sendMail({
      from: from || process.env.RESEND_FROM_EMAIL || `"METARDU" <${process.env.SMTP_USER}>`,
      to,
      replyTo: replyTo || process.env.SMTP_USER,
      subject,
      text,
      html,
      headers,
    })
    return { success: true, info }
  } catch (error) {
    logger.error('[email] Error sending email:', { error: error })
    return { success: false, error }
  }
}
