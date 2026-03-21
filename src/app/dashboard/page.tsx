import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import UpgradePrompt from '@/components/UpgradePrompt'
import { getServerTranslator } from '@/lib/i18n/server'

function ProjectCard({ project, openLabel }: { project: any; openLabel: string }) {
  const surveyType = project.survey_type
    ? project.survey_type.charAt(0).toUpperCase() + project.survey_type.slice(1)
    : null

  return (
    <Link
      href={`/project/${project.id}`}
      className="group block rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/50 hover:bg-[var(--bg-tertiary)] transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors leading-snug">
          {project.name}
        </h3>
        {surveyType && (
          <span className="badge badge-warning shrink-0 text-[10px]">{surveyType}</span>
        )}
      </div>

      <p className="text-sm text-[var(--text-muted)] mb-4 truncate">
        {project.location || 'No location set'}
      </p>

      <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>UTM {project.utm_zone}{project.hemisphere}</span>
        <span>{new Date(project.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="text-xs text-[var(--accent)] font-medium">{openLabel} →</span>
        <div className="flex gap-2">
          <Link
            href={`/project/${project.id}/contours`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
          >
            Contours
          </Link>
          <Link
            href={`/project/${project.id}/profiles`}
            onClick={e => e.stopPropagation()}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded hover:bg-[var(--bg-secondary)]"
          >
            Profiles
          </Link>
        </div>
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const t = await getServerTranslator()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let projects: any[] | null = null
  let subscription: any | null = null
  try {
    const [pRes, sRes] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('user_subscriptions').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    projects = pRes.data
    subscription = sRes.data
  } catch {
    // Queries failed — render with empty data rather than crashing
  }

  const canCreateProject = subscription?.plan_id !== 'free' || (projects?.length || 0) < 1
  const daysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / 86400000))
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <SubscriptionStatus subscription={subscription} />

      {/* Trial banner */}
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

      {/* Process field notes CTA */}
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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('dashboard.title')}
          {projects?.length ? (
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({projects.length})</span>
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

      {!projects?.length ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-[var(--border-color)] text-center">
          <div className="w-14 h-14 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"/>
            </svg>
          </div>
          <p className="text-[var(--text-secondary)] mb-2 font-medium">{t('dashboard.noProjects')}</p>
          <p className="text-[var(--text-muted)] text-sm mb-6">Create your first survey project to get started</p>
          {canCreateProject ? (
            <Link href="/project/new" className="btn btn-primary">
              {t('dashboard.createFirst')}
            </Link>
          ) : (
            <Link href="/pricing" className="btn btn-primary">
              {t('dashboard.upgradeToPro')}
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} openLabel={t('project.open')} />
          ))}
        </div>
      )}
    </div>
  )
}
