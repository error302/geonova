import { Monitor, Smartphone } from 'lucide-react'

interface MobileDesktopNoticeProps {
  title?: string
  children?: React.ReactNode
}

/**
 * MobileDesktopNotice — Shows a polished notice on mobile devices
 * recommending desktop for complex workflows.
 *
 * Redesigned to be helpful, not dismissive.
 */
export default function MobileDesktopNotice({
  title = 'Desktop recommended for this workflow',
  children,
}: MobileDesktopNoticeProps) {
  return (
    <div className="md:hidden rounded-xl border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center">
          <Monitor className="w-4 h-4 text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--accent)]">{title}</div>
          <div className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
            {children ?? 'This workflow uses wide tables, drawings, and detailed review steps that work best on a larger screen. You can still browse on mobile, but for the full experience, switch to desktop.'}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <Smartphone className="w-3 h-3" />
            <span>Field data collection works perfectly on mobile — use the Fieldbook page</span>
          </div>
        </div>
      </div>
    </div>
  )
}
