/**
 * Email template registry tests.
 *
 * Run: npx jest src/lib/email-templates/__tests__/emailTemplates.test.ts
 *
 * Guarantees for every template in the EMAIL_TEMPLATES registry:
 *   1. Renders without throwing, producing a non-empty subject, HTML body,
 *      and plain-text body.
 *   2. The HTML body is well-formed — balanced, correctly nested tags.
 *   3. User-supplied strings are HTML-escaped: an injection payload never
 *      appears raw in the output and never produces live <script>/[onerror]
 *      elements when parsed.
 */

import { describe, expect, it } from '@jest/globals'
import {
  EMAIL_TEMPLATES,
  passwordResetEmail,
  paymentFailedEmail,
  paymentReceiptEmail,
  projectSharedEmail,
  securityAlertEmail,
  trialEndingEmail,
  trialExpiringEmail,
  weeklyDigestEmail,
  welcomeEmail,
  type EmailTemplateName,
} from '../index'

/** Injection payload: attribute breakout + tag injection + event handler. */
const PAYLOAD = '"><script>alert(1)</script><img src=x onerror=alert(2)>'
/**
 * A value that is definitely not a parseable date — exercises every date
 * formatter's catch-and-return-raw fallback path (which must still be escaped
 * by the caller). Carries the payload so any leak is caught.
 */
const BAD_DATE = PAYLOAD
const TO = 'recipient@example.com'

interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * One fully-typed renderer per template. Every user-supplied string field is
 * fed the injection payload so an unescaped interpolation fails the test.
 */
const RENDERERS: Record<EmailTemplateName, () => RenderedEmail> = {
  welcome: () => welcomeEmail.render({ to: TO, name: PAYLOAD, trialEndsAt: BAD_DATE }),
  trialEnding: () =>
    trialEndingEmail.render({ to: TO, name: PAYLOAD, trialEndsAt: BAD_DATE, planPriceNote: PAYLOAD }),
  trialExpiring: () =>
    trialExpiringEmail.render({ to: TO, name: PAYLOAD, trialEndsAt: BAD_DATE, planPriceNote: PAYLOAD }),
  passwordReset: () =>
    passwordResetEmail.render({ to: TO, name: PAYLOAD, resetToken: PAYLOAD, expiresAt: BAD_DATE }),
  paymentReceipt: () =>
    paymentReceiptEmail.render({
      to: TO,
      name: PAYLOAD,
      planName: PAYLOAD,
      amount: 500,
      currency: PAYLOAD,
      paidAt: BAD_DATE,
      transactionId: PAYLOAD,
      paymentMethod: PAYLOAD,
    }),
  paymentFailed: () =>
    paymentFailedEmail.render({
      to: TO,
      name: PAYLOAD,
      planName: PAYLOAD,
      amount: 500,
      currency: PAYLOAD,
      failureReason: PAYLOAD,
      retryAt: PAYLOAD,
    }),
  securityAlert: () =>
    securityAlertEmail.render({
      to: TO,
      name: PAYLOAD,
      eventName: PAYLOAD,
      deviceInfo: PAYLOAD,
      location: PAYLOAD,
      timestamp: BAD_DATE,
    }),
  projectShared: () =>
    projectSharedEmail.render({
      to: TO,
      recipientName: PAYLOAD,
      sharerName: PAYLOAD,
      projectName: PAYLOAD,
      role: 'viewer',
      projectId: PAYLOAD,
      message: PAYLOAD,
    }),
  weeklyDigest: () =>
    weeklyDigestEmail.render({
      to: TO,
      name: PAYLOAD,
      weekStart: BAD_DATE,
      weekEnd: BAD_DATE,
      projectsActive: 2,
      projectsCompleted: 1,
      pointsCollected: 150,
      documentsGenerated: 3,
      pendingSubmissions: 0,
      highlightedProjects: [
        { name: PAYLOAD, status: 'active', newObservations: 5, projectUrl: PAYLOAD },
      ],
    }),
}

const TEMPLATE_NAMES = Object.keys(RENDERERS) as EmailTemplateName[]

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

/**
 * Lightweight well-formedness check: every non-void tag must be closed, in the
 * right order, with no stray closing tags. Comments and the doctype are
 * ignored; attribute values may contain `>`.
 */
function validateHtml(html: string): string[] {
  const errors: string[] = []
  const stack: string[] = []
  const source = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)(\/?)>/g
  let match: RegExpExecArray | null
  while ((match = tagRe.exec(source)) !== null) {
    const raw = match[0]
    const tagName = match[1].toLowerCase()
    const selfClosing = match[3] === '/'
    if (raw.startsWith('</')) {
      const open = stack.pop()
      if (open !== tagName) {
        errors.push(`mismatched closing tag </${tagName}> (expected </${open ?? 'none'}>)`)
      }
    } else if (!selfClosing && !VOID_ELEMENTS.has(tagName)) {
      stack.push(tagName)
    }
  }
  if (stack.length > 0) {
    errors.push(`unclosed tags: ${stack.join(', ')}`)
  }
  return errors
}

describe('email template registry', () => {
  it('tests every template registered in EMAIL_TEMPLATES', () => {
    expect(Object.keys(RENDERERS).sort()).toEqual(Object.keys(EMAIL_TEMPLATES).sort())
  })

  for (const name of TEMPLATE_NAMES) {
    it(`${name} renders a subject, HTML body, and plain-text body`, () => {
      const { subject, html, text } = RENDERERS[name]()
      expect(subject.length).toBeGreaterThan(0)
      expect(html.length).toBeGreaterThan(0)
      expect(text.length).toBeGreaterThan(0)
    })

    it(`${name} renders well-formed HTML`, () => {
      const { html } = RENDERERS[name]()
      expect(validateHtml(html)).toEqual([])
    })

    it(`${name} escapes user-supplied HTML`, () => {
      const { html } = RENDERERS[name]()
      // The raw payload must never survive into the HTML output (note: `=` is
      // not HTML-escaped, so an escaped payload may still contain the literal
      // text `onerror=` — what matters is that it never becomes an attribute).
      expect(html).not.toContain('<script')
      expect(html).not.toContain('<img src=x')
      expect(html).not.toContain('"><img')
      // ...while its escaped form must be present (value flowed through an escaper).
      expect(html).toContain('&lt;script&gt;')
      // Parsing the output must yield no injected elements or handlers: an
      // escaped payload stays text, an unescaped one becomes live nodes.
      const doc = new DOMParser().parseFromString(html, 'text/html')
      expect(doc.querySelectorAll('script').length).toBe(0)
      expect(doc.querySelectorAll('[onerror]').length).toBe(0)
      expect(doc.querySelectorAll('img[src="x"]').length).toBe(0)
    })
  }
})
