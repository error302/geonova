export default function ProjectLoading() {
  return (
    <div className="flex h-screen animate-pulse">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r border-[var(--border-color)] p-4 space-y-3 hidden md:block">
        <div className="h-6 w-3/4 rounded bg-[var(--bg-tertiary)]" />
        <div className="h-4 w-1/2 rounded bg-[var(--bg-tertiary)]" />
        <div className="mt-6 space-y-2">
                    {Array.from({ length: 8 }, (_, i) => (
            <div key={`${_}-${i}`} className="h-9 rounded bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
      {/* Map area skeleton */}
      <div className="flex-1 bg-[var(--bg-secondary)]" />
    </div>
  )
}
