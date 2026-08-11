export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      {/* CTA banner skeleton */}
      <div className="mb-8 h-20 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]" />

      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-32 rounded bg-[var(--bg-tertiary)]" />
        <div className="h-9 w-28 rounded-lg bg-[var(--bg-tertiary)]" />
      </div>

      {/* Project cards skeleton */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
          <div key={`${_}-${i}`} className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
            <div className="h-5 w-3/4 rounded bg-[var(--bg-tertiary)] mb-3" />
            <div className="h-4 w-1/2 rounded bg-[var(--bg-tertiary)] mb-4" />
            <div className="flex justify-between">
              <div className="h-3 w-16 rounded bg-[var(--bg-tertiary)]" />
              <div className="h-3 w-20 rounded bg-[var(--bg-tertiary)]" />
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border-color)] h-4 w-24 rounded bg-[var(--bg-tertiary)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
