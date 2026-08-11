export default function ToolsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-8 w-64 rounded bg-[var(--bg-tertiary)] mb-2" />
      <div className="h-4 w-96 rounded bg-[var(--bg-tertiary)] mb-8" />
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header h-8 bg-[var(--bg-tertiary)]" />
          <div className="card-body space-y-4">
                        {Array.from({ length: 4 }, (_, i) => (
              <div key={`${_}-${i}`} className="h-10 rounded bg-[var(--bg-tertiary)]" />
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header h-8 bg-[var(--bg-tertiary)]" />
          <div className="card-body h-40 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    </div>
  )
}
