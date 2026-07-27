export type EventType = 
  | 'page_view'
  | 'tool_used'
  | 'project_created'
  | 'traverse_run'
  | 'report_generated'
  | 'csv_imported'
  | 'user_registered'
  | 'upgrade_prompt_shown'
  | 'upgrade_clicked'
  | 'feedback_submitted'

export async function trackEvent(
  event: EventType,
  properties?: Record<string, unknown>
) {
  try {
    if (process.env.NODE_ENV !== 'production') return

    // AUDIT FIX (M-003, 2026-07-27): Avoid 401 console noise for anonymous
    // users. The /api/analytics endpoint requires auth, and posting without
    // a session produces a noisy 401 the user can't act on. The session
    // cookie name is `next-auth.session-token` (prod override in cookies()
    // would change this, but the localStorage workaround below is plenty:
    // unauth users by definition have no session cookie).
    if (typeof document !== 'undefined') {
      const hasSession = document.cookie
        .split(';')
        .some(c => c.trim().startsWith('next-auth.session-token=') || c.trim().startsWith('__Secure-next-auth.session-token='))
      if (!hasSession) return
    }

    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        properties,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.pathname : ''
      })
    })
  } catch {
    // Never let analytics break the app
  }
}

export function trackPageView(page: string) {
  return trackEvent('page_view', { page })
}

export function trackToolUsed(tool: string) {
  return trackEvent('tool_used', { tool })
}

export function trackProjectCreated(projectType: string) {
  return trackEvent('project_created', { projectType })
}

export function trackTraverseRun(closed: boolean, stations: number) {
  return trackEvent('traverse_run', { closed, stations })
}

export function trackReportGenerated(format: string) {
  return trackEvent('report_generated', { format })
}

export function trackCSVImported(surveyType: string, rows: number) {
  return trackEvent('csv_imported', { surveyType, rows })
}

export function trackUpgradePromptShown(promptType: string) {
  return trackEvent('upgrade_prompt_shown', { promptType })
}

export function trackUpgradeClicked(plan: string) {
  return trackEvent('upgrade_clicked', { plan })
}
