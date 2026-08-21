export default function OrganizationPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">Organization Management</h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
        Manage your survey firm, team members, and organizational settings. This feature is coming soon for Enterprise subscribers.
      </p>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-full text-sm text-[var(--accent)] font-medium">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Coming Soon
      </div>
    </div>
  )
}
