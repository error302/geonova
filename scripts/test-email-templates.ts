/**
 * Smoke test for the email template system.
 *
 * Renders every template with sample data and verifies:
 *   1. The render function does not throw
 *   2. The output HTML contains expected markers
 *   3. The output text is non-empty
 *
 * Run: npx tsx scripts/test-email-templates.ts
 */

import {
  welcomeEmail,
  trialEndingEmail,
  passwordResetEmail,
  paymentReceiptEmail,
  paymentFailedEmail,
  securityAlertEmail,
  projectSharedEmail,
  weeklyDigestEmail,
} from '../src/lib/email-templates'

const NOW = new Date().toISOString()
const FUTURE = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
const PAST = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

const cases = [
  {
    name: 'welcome',
    render: () =>
      welcomeEmail.render({
        to: 'john@metardu.com',
        name: 'John Mwangi',
        trialEndsAt: FUTURE,
      }),
    expectSubject: 'Welcome to METARDU',
    expectHtml: ['METARDU', '14-day Pro trial', 'dashboard'],
  },
  {
    name: 'trialEnding',
    render: () =>
      trialEndingEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        trialEndsAt: FUTURE,
        planPriceNote: 'KES 500/month',
      }),
    expectSubject: 'Your METARDU Pro trial ends in 3 days',
    expectHtml: ['METARDU', 'Pro trial ends', 'KES 500/month'],
  },
  {
    name: 'passwordReset',
    render: () =>
      passwordResetEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        resetToken: 'abc123def456',
        expiresAt: FUTURE,
      }),
    expectSubject: 'Reset your METARDU password',
    expectHtml: ['METARDU', 'Reset password', 'reset-password?token='],
  },
  {
    name: 'paymentReceipt',
    render: () =>
      paymentReceiptEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        planName: 'Pro',
        amount: 500,
        currency: 'KES',
        paidAt: NOW,
        transactionId: 'MPESA-ABC123',
        paymentMethod: 'M-Pesa · 0712••••••',
      }),
    expectSubject: 'Payment received',
    expectHtml: ['METARDU', 'Ksh', 'Pro', 'M-Pesa'],
  },
  {
    name: 'paymentFailed',
    render: () =>
      paymentFailedEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        planName: 'Pro',
        amount: 500,
        currency: 'KES',
        failureReason: 'Insufficient funds',
        retryAt: FUTURE,
      }),
    expectSubject: 'We could not process your payment',
    expectHtml: ['METARDU', 'Insufficient funds', 'Update payment method'],
  },
  {
    name: 'securityAlert',
    render: () =>
      securityAlertEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        eventName: 'a new device signed in to your account',
        deviceInfo: 'Chrome on Windows 11',
        location: 'Nairobi, Kenya',
        timestamp: NOW,
      }),
    expectSubject: 'Security alert',
    expectHtml: ['METARDU', 'new device', 'Nairobi', 'Chrome'],
  },
  {
    name: 'projectShared',
    render: () =>
      projectSharedEmail.render({
        to: 'mary@metardu.com',
        recipientName: 'Mary',
        sharerName: 'John Mwangi',
        projectName: 'LR 209/45 Boundary Resurvey',
        role: 'surveyor',
        projectId: 'abc-123-def',
        message: 'Please review the traverse closure before submission.',
      }),
    expectSubject: 'You have been added to',
    expectHtml: ['METARDU', 'John Mwangi', 'LR 209/45', 'surveyor'],
  },
  {
    name: 'weeklyDigest',
    render: () =>
      weeklyDigestEmail.render({
        to: 'john@metardu.com',
        name: 'John',
        weekStart: PAST,
        weekEnd: NOW,
        projectsActive: 3,
        projectsCompleted: 1,
        pointsCollected: 487,
        documentsGenerated: 5,
        pendingSubmissions: 2,
        highlightedProjects: [
          {
            name: 'LR 209/45 Boundary',
            status: 'active',
            newObservations: 12,
            projectUrl: 'https://metardu.space/projects/abc',
          },
        ],
      }),
    expectSubject: 'Your METARDU week',
    expectHtml: ['METARDU', 'active projects', '487', '2 pending'],
  },
]

let pass = 0
let fail = 0

console.log('─'.repeat(60))
console.log('Email Template Smoke Test')
console.log('─'.repeat(60))

for (const c of cases) {
  try {
    const out = c.render()
    const subjectOk =
      typeof out.subject === 'string' && out.subject.includes(c.expectSubject)
    const htmlOk = c.expectHtml.every((marker) =>
      out.html.toLowerCase().includes(marker.toLowerCase()),
    )
    const textOk = typeof out.text === 'string' && out.text.length > 20

    if (subjectOk && htmlOk && textOk) {
      console.log(`  ✓ ${c.name} — subject "${out.subject.slice(0, 50)}…" · ${out.html.length} bytes HTML · ${out.text.length} bytes text`)
      pass++
    } else {
      console.log(`  ✗ ${c.name}`)
      if (!subjectOk) console.log(`     subject missing "${c.expectSubject}" (got: ${out.subject})`)
      if (!htmlOk) {
        const missing = c.expectHtml.filter((m) => !out.html.toLowerCase().includes(m.toLowerCase()))
        console.log(`     html missing markers: ${missing.join(', ')}`)
      }
      if (!textOk) console.log(`     text body empty or too short (${out.text?.length} chars)`)
      fail++
    }
  } catch (err) {
    console.log(`  ✗ ${c.name} — threw: ${err instanceof Error ? err.message : String(err)}`)
    fail++
  }
}

console.log('─'.repeat(60))
console.log(`Result: ${pass} passed, ${fail} failed`)
console.log('─'.repeat(60))
process.exit(fail === 0 ? 0 : 1)
