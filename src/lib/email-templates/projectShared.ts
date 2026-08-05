/**
 * Project-shared email — sent when a surveyor shares a project with a colleague.
 *
 * Triggered by: /api/projects/[id]/share route (POST).
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  Accent,
  Link,
  Divider,
} from './components'
import { projectSharedText, ProjectSharedTextArgs } from './text'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface ProjectSharedEmail {
  to: string
  recipientName: string
  sharerName: string
  projectName: string
  /** Role granted: 'viewer' | 'editor' | 'surveyor' | 'admin'. */
  role: string
  /** Project UUID for building the deep link. */
  projectId: string
  /** Optional message from the sharer. */
  message?: string
}

export const projectSharedEmail = {
  subject: (args: ProjectSharedEmail) => `You have been added to "${truncate(args.projectName, 40)}"`,
  render(args: ProjectSharedEmail) {
    const projectUrl = `${APP_URL}/projects/${encodeURIComponent(args.projectId)}`
    const roleLabel = ROLE_LABELS[args.role] ?? args.role
    const bodyHtml = `
      ${Heading(`${escapeOnce(args.sharerName)} shared a project with you`)}
      ${Paragraph(`Hi${args.recipientName ? ` ${args.recipientName}` : ''}, you have been added to the project "${escapeOnce(args.projectName)}" as ${Accent(roleLabel)}.`)}
      ${args.message
        ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #D17B47;background:#1a1a2a;color:#cccccc;font-size:14px;line-height:1.6;font-style:italic;">${escapeOnce(args.message)}</blockquote>`
        : ''}
      ${Divider()}
      ${Paragraph(`With your ${escapeOnce(roleLabel)} access you can:`)}
      <ul style="margin:0 0 20px;padding-left:22px;color:#cccccc;font-size:14px;line-height:1.7;">
        ${ROLE_PERMISSIONS[args.role]?.map((perm) => `<li>${perm}</li>`).join('') ?? ''}
      </ul>
      ${PrimaryButton(projectUrl, 'Open the project')}
      ${Paragraph(`You can leave the project at any time from its settings page. If you do not know ${escapeOnce(args.sharerName)}, you can ${Link(`${APP_URL}/settings/profile?tab=security`, 'report this')} as unwanted.`, { small: true, muted: true })}
    `
    return {
      subject: projectSharedEmail.subject(args),
      html: renderEmailLayout(bodyHtml, {
        preheader: `${args.sharerName} added you to "${truncate(args.projectName, 50)}" as ${roleLabel}.`,
      }),
      text: projectSharedText({
        recipientName: args.recipientName,
        sharerName: args.sharerName,
        projectName: args.projectName,
        role: roleLabel,
        projectUrl,
      }),
    }
  },
}

export type { ProjectSharedTextArgs }

const ROLE_LABELS: Record<string, string> = {
  viewer: 'a viewer',
  editor: 'an editor',
  surveyor: 'a surveyor',
  admin: 'an admin',
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  viewer: [
    'View the project, field book, and documents',
    'Download generated PDFs, DXF, and GeoJSON exports',
    'Leave comments on observations',
  ],
  editor: [
    'Everything a viewer can do',
    'Edit field book observations',
    'Generate new documents',
    'Invite other viewers',
  ],
  surveyor: [
    'Everything an editor can do',
    'Run traverse adjustments and corrections',
    'Lock observations for QA review',
    'Submit documents to NLIMS / SoK',
  ],
  admin: [
    'Full project access',
    'Manage team members and roles',
    'Archive or delete the project',
    'Configure project settings',
  ],
}

function escapeOnce(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(value: string, max: number): string {
  if (!value) return ''
  if (value.length <= max) return value
  return value.slice(0, Math.max(0, max - 1)).trimEnd() + '…'
}
