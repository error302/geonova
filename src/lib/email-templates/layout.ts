/**
 * Branded email layout for METARDU transactional emails.
 *
 * Used by every template in src/lib/email-templates/*. Provides:
 *   - Branded header (orange METARDU wordmark + tagline)
 *   - Plain content area (dark surface in dark-mode clients, light in others)
 *   - Footer with unsubscribe link + postal address (CAN-SPAM / GDPR compliant)
 *
 * All styles are inline — required because Gmail, Outlook, and Yahoo strip
 * <style> tags. Only table-based layouts + inline CSS render reliably.
 */

import { escapeHtml } from './components'
import { readFileSync } from 'fs'
import { join } from 'path'

export interface EmailBranding {
  appName: string
  tagline: string
  brandColor: string
  brandColorDim: string
  supportEmail: string
  appUrl: string
  year: number
}

const BRANDING: EmailBranding = {
  appName: 'METARDU',
  tagline: 'Survey software built for Kenya',
  brandColor: '#D17B47',
  brandColorDim: '#c66e15',
  supportEmail: 'support@metardu.com',
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space',
  year: new Date().getFullYear(),
}

/**
 * METARDU logo embedded as a data URI so it renders without the recipient's
 * client loading remote images (Gmail/Outlook block them by default). Falls
 * back to the hosted URL when the local asset cannot be read.
 */
const LOGO_SRC: string = (() => {
  try {
    const png = readFileSync(join(process.cwd(), 'public', 'metardu-icon.png'))
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return `${BRANDING.appUrl}/metardu-icon.png`
  }
})()

export interface LayoutOptions {
  /** Optional preheader text shown in inbox preview (~85 chars max). */
  preheader?: string
  /** Optional unsubscribe URL for marketing/digest emails. Required for GDPR. */
  unsubscribeUrls?: string
  /** Show the unsubscribe link even for transactional emails (default: true). */
  showUnsubscribe?: boolean
}

/**
 * Render an email body inside the branded METARDU layout.
 *
 * @param bodyHtml Inner HTML — already-escaped content (use components below)
 * @param opts Optional layout options (preheader, unsubscribe)
 * @returns Complete HTML document ready for `sendEmail({ html })`
 */
export function renderEmailLayout(
  bodyHtml: string,
  opts: LayoutOptions = {},
): string {
  const unsubscribeUrl = opts.unsubscribeUrls || `${BRANDING.appUrl}/settings/profile`
  const showUnsubscribe = opts.showUnsubscribe !== false
  const preheaderHtml = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>`
    : ''

  const unsubscribeLink = showUnsubscribe
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#666;text-decoration:underline;">Manage notifications</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>METARDU</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;min-height:100vh;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#0a0a0f;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;background-color:#0a0a0f;border-bottom:1px solid #1f1f2a;">
              <img src="${LOGO_SRC}" alt="METARDU" width="56" height="56" style="display:block;margin:0 auto 10px;border-radius:12px;" />
              <h1 style="margin:0;color:${BRANDING.brandColor};font-size:28px;font-weight:800;letter-spacing:-0.02em;">METARDU</h1>
              <p style="margin:6px 0 0;color:#8a8a96;font-size:13px;letter-spacing:0.01em;">${escapeHtml(BRANDING.tagline)}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 8px;background-color:#0a0a0f;color:#e5e5e5;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;background-color:#0a0a0f;border-top:1px solid #1f1f2a;">
              <p style="margin:0 0 8px;color:#666;font-size:12px;line-height:1.6;">
                This email was sent by METARDU. Reply to this message or write to
                <a href="mailto:${escapeHtml(BRANDING.supportEmail)}" style="color:${BRANDING.brandColor};text-decoration:none;">${escapeHtml(BRANDING.supportEmail)}</a>
                if you have any questions.
              </p>
              <p style="margin:0 0 4px;color:#444;font-size:11px;line-height:1.6;">
                ${unsubscribeLink}
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(BRANDING.appUrl)}/privacy" style="color:#666;text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${escapeHtml(BRANDING.appUrl)}/help" style="color:#666;text-decoration:underline;">Help</a>
              </p>
              <p style="margin:8px 0 0;color:#444;font-size:11px;line-height:1.6;">
                &copy; ${BRANDING.year} METARDU. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export { BRANDING }
