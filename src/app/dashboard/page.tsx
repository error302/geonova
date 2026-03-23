export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import UpgradePrompt from '@/components/UpgradePrompt'
import { getServerTranslator } from '@/lib/i18n/server'
import { Logger } from '@/lib/logger'

import ProjectCard from '@/components/ProjectCard'

const logger = new Logger('DashboardPage')

export default async function DashboardPage() {
  let t = (k: string) => k
  try { t = await getServerTranslator() } catch {}

  let projects: any[] = []
  let subscription: any = null
  let isAdmin = false

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase())
    isAdmin = ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')

    if (isAdmin) {
      subscription = { plan_id: 'premium', trial_ends_at: null }
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      if (!error) projects = data ?? []
    } else {
      const [pRes, sRes] = await Promise.all([
        supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
      ])
      if (!pRes.error) projects = pRes.data ?? []
      if (!sRes.error || sRes.error.code === 'PGRST116') subscription = sRes.data ?? null
    }
  } catch (err) {
    logger.error('Failed to load dashboard data or user session', err)
  }

  const canCreateProject = isAdmin || subscription?.plan_id !== 'free' || projects.length < 1
  const daysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  const projectsWithCounts = await Promise.all(
    projects.map(async (project) => {
      try {
        const supabase = await createClient()
        const [pointsRes, parcelsRes] = await Promise.all([
          supabase.from('survey_points').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
          supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        ])
        return {
          ...project,
          point_count: pointsRes.count ?? 0,
          parcel_count: parcelsRes.count ?? 0,
        }
      } catch {
        return { ...project, point_count: 0, parcel_count: 0 }
      }
    })
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SubscriptionStatus subscription={subscription} />

      {subscription?.status === 'trial' && daysLeft !== null && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg border border-green-500/20 bg-green-500/5 text-sm">
          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="text-green-400">
            {daysLeft > 0
              ? `Pro trial active — ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining. `
              : 'Your trial has ended. '}
            <Link href="/pricing" className="underline hover:text-green-300">Upgrade to keep Pro access →</Link>
          </p>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-[var(--text-primary)] mb-1">
              {t('dashboard.processFieldNotesTitle')}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('dashboard.processFieldNotesSubtitle')}
            </p>
          </div>
          <Link href="/process" className="btn btn-primary shrink-0">
            {t('dashboard.startProcessing')}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('dashboard.title')}
          {projectsWithCounts?.length ? (
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({projectsWithCounts.length})</span>
          ) : null}
        </h1>
        {canCreateProject ? (
          <Link href="/project/new" className="btn btn-primary">
            {t('dashboard.newProject')}
          </Link>
        ) : (
          <Link href="/pricing" className="btn btn-primary">
            {t('dashboard.upgradeToCreateMore')}
          </Link>
        )}
      </div>

      {!canCreateProject && <UpgradePrompt type="projects" />}

      {!projectsWithCounts?.length ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-[var(--border-color)] text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Welcome to METARDU</h2>
          <p className="text-[var(--text-secondary)] mb-8 max-w-md">Start your first project or jump straight into a tool</p>
          
          <div className="flex flex-wrap gap-3 justify-center mb-8">
            <Link href="/project/new" className="px-6 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black font-semibold rounded-lg transition-colors">
              + New Project
            </Link>
            <Link href="/tools/traverseAdjust" className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] font-medium rounded-lg transition-colors border border-[var(--border-color)]">
              Open Traverse Tool
            </Link>
            <Link href="/process" className="px-6 py-3 bg-[var(--bg-tertiary)] hover:bg-[var(--border-hover)] text-[var(--text-primary)] font-medium rounded-lg transition-colors border border-[var(--border-color)]">
              Process Field Notes
            </Link>
          </div>
          
          <div className="w-full max-w-sm border-t border-[var(--border-color)] pt-6 mt-2">
            <p className="text-xs text-[var(--text-muted)] mb-3">NEW TO METARDU?</p>
            <Link href="/docs/first-plan" className="text-sm text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors inline-flex items-center gap-1">
              View Survey Guide →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projectsWithCounts.map(project => (
            <ProjectCard key={project.id} project={project} openLabel={t('project.open')} />
          ))}
        </div>
      )}
    </div>
  )
}
