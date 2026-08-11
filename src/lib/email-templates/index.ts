/**
 * Central registry of all transactional email templates.
 *
 * Adding a new email:
 *   1. Create src/lib/email-templates/<name>.ts exporting an object with:
 *        { subject: string | ((args) => string), render: (args) => { subject, html, text } }
 *   2. Add it to the EMAIL_TEMPLATES registry below.
 *   3. Import `sendTemplatedEmail` from this file and call from your API route.
 *
 * Never inline HTML in a route handler — always go through this registry.
 */

import { sendEmail } from '@/lib/email'
import { welcomeEmail, WelcomeEmail } from './welcome'
import { trialEndingEmail, TrialEndingEmail } from './trialEnding'
import { trialExpiringEmail, TrialExpiringEmail } from './trialExpiring'
import { passwordResetEmail, PasswordResetEmail } from './passwordReset'
import { paymentReceiptEmail, PaymentReceiptEmail } from './paymentReceipt'
import { paymentFailedEmail, PaymentFailedEmail } from './paymentFailed'
import { securityAlertEmail, SecurityAlertEmail } from './securityAlert'
import { projectSharedEmail, ProjectSharedEmail } from './projectShared'
import { weeklyDigestEmail, WeeklyDigestEmail } from './weeklyDigest'

// Re-export every template and its Args type for ergonomic imports
export {
  welcomeEmail,
  trialEndingEmail,
  trialExpiringEmail,
  passwordResetEmail,
  paymentReceiptEmail,
  paymentFailedEmail,
  securityAlertEmail,
  projectSharedEmail,
  weeklyDigestEmail,
}

export type {
  WelcomeEmail,
  TrialEndingEmail,
  TrialExpiringEmail,
  PasswordResetEmail,
  PaymentReceiptEmail,
  PaymentFailedEmail,
  SecurityAlertEmail,
  ProjectSharedEmail,
  WeeklyDigestEmail,
}

export type EmailTemplateName =
  | 'welcome'
  | 'trialEnding'
  | 'trialExpiring'
  | 'passwordReset'
  | 'paymentReceipt'
  | 'paymentFailed'
  | 'securityAlert'
  | 'projectShared'
  | 'weeklyDigest'

interface TemplateSpec<TArgs> {
  subject: string | ((args: TArgs) => string)
  render: (args: TArgs) => { subject: string; html: string; text: string }
}

// Each template is registered with its concrete args type.
interface TemplateMap {
  welcome: TemplateSpec<WelcomeEmail>
  trialEnding: TemplateSpec<TrialEndingEmail>
  trialExpiring: TemplateSpec<TrialExpiringEmail>
  passwordReset: TemplateSpec<PasswordResetEmail>
  paymentReceipt: TemplateSpec<PaymentReceiptEmail>
  paymentFailed: TemplateSpec<PaymentFailedEmail>
  securityAlert: TemplateSpec<SecurityAlertEmail>
  projectShared: TemplateSpec<ProjectSharedEmail>
  weeklyDigest: TemplateSpec<WeeklyDigestEmail>
}

export const EMAIL_TEMPLATES: TemplateMap = {
  welcome: welcomeEmail,
  trialEnding: trialEndingEmail,
  trialExpiring: trialExpiringEmail,
  passwordReset: passwordResetEmail,
  paymentReceipt: paymentReceiptEmail,
  paymentFailed: paymentFailedEmail,
  securityAlert: securityAlertEmail,
  projectShared: projectSharedEmail,
  weeklyDigest: weeklyDigestEmail,
}

/**
 * High-level helper: send a templated email by name.
 *
 * @example
 *   await sendTemplatedEmail('welcome', { to, name, trialEndsAt })
 */
export async function sendTemplatedEmail<TName extends EmailTemplateName>(
  name: TName,
  args: TemplateMap[TName]['render'] extends (a: infer A) => unknown ? A & { to: string } : never,
): Promise<{ success: boolean; error?: string }> {
  const template = EMAIL_TEMPLATES[name] as TemplateSpec<{ to: string }>
  if (!template) {
    return { success: false, error: `Unknown email template: ${name}` }
  }

  const rendered = template.render(args)
  const subject = typeof template.subject === 'function'
    ? (template.subject as (a: typeof args) => string)(args)
    : template.subject

  const result = await sendEmail({
    to: args.to,
    subject,
    html: rendered.html,
    text: rendered.text,
  })

  if (!result.success) {
    return { success: false, error: typeof result.error === 'string' ? result.error : 'Send failed' }
  }
  return { success: true }
}
