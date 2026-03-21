export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SubscriptionStatus from '@/components/SubscriptionStatus'
import UpgradePrompt from '@/components/UpgradePrompt'
import { getServerTranslator } from '@/lib/i18n/server'

import ProjectCard from '@/components/ProjectCard'

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
      const { data, error } = await supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
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
    console.error('Dashboard error:', err)
  }

  const canCreateProject = isAdmin || subscription?.plan_id !== 'free' || projects.length < 1
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
