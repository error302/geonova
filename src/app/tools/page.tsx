'use client'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export default function ToolsPage() {
  const { t } = useLanguage()
  return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold mb-2">{t('tools.title')}</h1>
      <p className="text-sm text-[var(--text-muted)] mb-8">{t('tools.subtitle')}</p>
      
      <div className="space-y-8">
        {/* FIELD LAYOUT */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.fieldLayout')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/setting-out" title={t('tools.settingOut')} />
            <ToolLink href="/tools/missing-line" title={t('tools.missingLine')} />
          </div>
        </section>

        {/* LEVELING */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.leveling')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/leveling" title={t('tools.leveling')} />
            <ToolLink href="/tools/two-peg-test" title={t('tools.twoPegTest')} />
            <ToolLink href="/tools/height-of-object" title={t('tools.heightOfObject')} />
          </div>
        </section>

        {/* CALCULATIONS */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.calculations')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/distance" title={t('tools.distance')} />
            <ToolLink href="/tools/bearing" title={t('tools.bearing')} />
            <ToolLink href="/tools/area" title={t('tools.area')} />
            <ToolLink href="/tools/grade" title={t('tools.grade')} />
          </div>
        </section>

        {/* TRAVERSE & ADJUSTMENT */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.traverse')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/traverse" title={t('tools.traverse')} />
            <ToolLink href="/tools/coordinates" title={t('tools.coordinates')} />
            <ToolLink href="/tools/cogo" title={t('tools.cogo')} />
            <ToolLink href="/tools/gnss" title={t('tools.gnss')} />
          </div>
        </section>

        {/* CURVES */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.curves')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/curves" title={t('tools.horizontalCurves')} />
            <ToolLink href="/tools/tacheometry" title={t('tools.tacheometry')} />
          </div>
        </section>

        {/* SPECIALIZED SURVEYS */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('tools.specialized')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ToolLink href="/tools/mining" title={t('tools.mining')} />
            <ToolLink href="/tools/hydrographic" title={t('tools.hydrographic')} />
            <ToolLink href="/tools/drone" title={t('tools.drone')} />
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolLink({ href, title }: { href: string; title: string }) {
  return (
    <a href={href} className="card p-5 hover:border-[var(--accent)] transition-all">
      <h3 className="font-semibold">{title}</h3>
    </a>
  );
}
