'use client';

import MachineControlExportPanel from '@/components/engineering/MachineControlExportPanel'
import { PageHeader } from '@/components/shared/PageHeader'
import { useLanguage } from '@/lib/i18n/LanguageContext'

function MachineControlPage() {
  const { t } = useLanguage()
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageHeader title={t('tools.machineControl')} subtitle={t('tools.machineControlDesc')} />
      <MachineControlExportPanel />
    </div>
  )
}

// P0-2 (2026-07-24): Wrap in <ToolGate> so direct-URL access can't
// bypass the plan check. The catalog page (/tools) shows lock badges,
// but those are display-only — this gate enforces the same check at
// the page level. Server-side enforcement for any export API this
// tool calls happens via the requirePlan() decorator on the route.
import { ToolGate } from '@/components/shared/ToolGate'

export default function MachineControlPageGated() {
  return (
    <ToolGate toolPath="/tools/machine-control">
      <MachineControlPage />
    </ToolGate>
  )
}
