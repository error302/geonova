export default function FieldbookLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-8 w-48 rounded bg-[var(--bg-tertiary)] mb-6" />
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
        ))}
      </div>
      <div className="card">
        <div className="card-header h-10 bg-[var(--bg-tertiary)]" />
        <div className="card-body space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--bg-tertiary)]" />
          ))}
        </div>
      </div>
    </div>
  )
}
