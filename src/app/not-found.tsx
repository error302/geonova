import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
          <svg className="w-10 h-10 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"/>
          </svg>
        </div>

        <h1 className="text-6xl font-bold text-[var(--accent)] mb-2" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
          404
        </h1>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Page not found</h2>
        <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
          This page doesn't exist or has been moved. Check the URL or navigate back to a known page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
          <Link href="/tools" className="btn btn-secondary">
            Quick tools
          </Link>
          <Link href="/dashboard" className="btn btn-secondary">
            My projects
          </Link>
        </div>
      </div>
    </div>
  )
}
