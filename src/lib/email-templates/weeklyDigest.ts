/**
 * Weekly digest email — sent Monday morning summarising last week's activity.
 *
 * Triggered by: scheduled cron job that batches per user.
 *
 * Recipients are filtered by the user's `notification_preferences.email.weekly_digest`
 * flag (added in migration 022_profile_notification_preferences.sql).
 */

import { renderEmailLayout } from './layout'
import {
  Heading,
  Paragraph,
  RichParagraph,
  PrimaryButton,
  Accent,
  Divider,
  Link,
} from './components'
import { weeklyDigestText, WeeklyDigestTextArgs } from './text'
import { formatDate } from './utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://metardu.space'

export interface ProjectDigestEntry {
  name: string
  status: 'active' | 'completed' | 'archived'
  /** Number of observations added this week. */
  newObservations: number
  projectUrl: string
}

export interface WeeklyDigestEmail {
  to: string
  name: string
  weekStart: string
  weekEnd: string
  projectsActive: number
  projectsCompleted: number
  pointsCollected: number
  documentsGenerated: number
  pendingSubmissions: number
  /** Up to 3 active projects to highlight. */
  highlightedProjects?: ProjectDigestEntry[]
}

export const weeklyDigestEmail = {
  subject: (args: WeeklyDigestEmail) => `Your METARDU week — ${formatDate(args.weekStart)}`,
  render(args: WeeklyDigestEmail) {
    const dashboardUrl = `${APP_URL}/dashboard`
    const bodyHtml = `
      ${Heading('Your week in review')}
      ${RichParagraph(`Hi${args.name ? ` ${args.name}` : ''}, here is a summary of your METARDU activity for ${Accent(formatDate(args.weekStart))} — ${Accent(formatDate(args.weekEnd))}.`)}
      ${Paragraph('This week you:')}
      <ul style="margin:0 0 20px;padding-left:22px;color:#cccccc;font-size:15px;line-height:1.9;">
        <li>Worked on <strong style="color:#e5e5e5;">${args.projectsActive}</strong> active project${args.projectsActive === 1 ? '' : 's'}</li>
        <li>Completed <strong style="color:#e5e5e5;">${args.projectsCompleted}</strong> project${args.projectsCompleted === 1 ? '' : 's'}</li>
        <li>Collected <strong style="color:#e5e5e5;">${args.pointsCollected.toLocaleString()}</strong> survey point${args.pointsCollected === 1 ? '' : 's'}</li>
        <li>Generated <strong style="color:#e5e5e5;">${args.documentsGenerated}</strong> document${args.documentsGenerated === 1 ? '' : 's'}</li>
      </ul>
      ${args.pendingSubmissions > 0
        ? RichParagraph(`You have ${Accent(`${args.pendingSubmissions} pending submission${args.pendingSubmissions === 1 ? '' : 's'}`)} waiting for NLIMS / Survey of Kenya.`)
        : Paragraph('No pending submissions — great job keeping on top of the queue!', { muted: true })}
      ${args.highlightedProjects && args.highlightedProjects.length > 0 ? renderHighlightedProjects(args.highlightedProjects) : ''}
      ${Divider()}
      ${PrimaryButton(dashboardUrl, 'Open your dashboard')}
      ${Paragraph(`This digest is sent every Monday. You can ${Link(`${APP_URL}/settings/profile?tab=notifications`, 'turn it off')} from your notification settings.`, { small: true, muted: true })}
    `
    return {
      subject: weeklyDigestEmail.subject(args),
      html: renderEmailLayout(bodyHtml, {
        preheader: `${args.projectsActive} project${args.projectsActive === 1 ? '' : 's'} · ${args.pointsCollected.toLocaleString()} points · ${args.documentsGenerated} document${args.documentsGenerated === 1 ? '' : 's'} this week.`,
        unsubscribeUrls: `${APP_URL}/settings/profile?tab=notifications`,
      }),
      text: weeklyDigestText({
        name: args.name,
        weekStart: args.weekStart,
        weekEnd: args.weekEnd,
        projectsActive: args.projectsActive,
        projectsCompleted: args.projectsCompleted,
        pointsCollected: args.pointsCollected,
        documentsGenerated: args.documentsGenerated,
        pendingSubmissions: args.pendingSubmissions,
        dashboardUrl,
      }),
    }
  },
}

function renderHighlightedProjects(projects: ProjectDigestEntry[]): string {
  const items = projects
    .slice(0, 3)
    .map((p) => {
      const statusColor = p.status === 'completed' ? '#4ade80' : p.status === 'archived' ? '#8a8a96' : '#D17B47'
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #1f1f2a;">
          <a href="${escapeOnce(p.projectUrl)}" style="color:#e5e5e5;text-decoration:none;font-size:14px;font-weight:500;">${escapeOnce(p.name)}</a>
          <br>
          <span style="color:#8a8a96;font-size:12px;">${p.newObservations} new observation${p.newObservations === 1 ? '' : 's'} this week</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #1f1f2a;text-align:right;vertical-align:top;">
          <span style="display:inline-block;padding:3px 10px;border-radius:4px;background-color:rgba(209, 123, 71,0.1);color:${statusColor};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">${escapeOnce(p.status)}</span>
        </td>
      </tr>`
    })
    .join('')
  return `
    ${Divider()}
    ${Paragraph('Active projects:')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;">
      ${items}
    </table>
  `
}

export type { WeeklyDigestTextArgs }

function escapeOnce(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
