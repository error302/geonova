export default function ManualsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-8">Surveying Manuals</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">Fundamentals</h2>
          <div className="grid gap-4">
            <a 
              href="/manual/surveying-and-levelling-n-n-basak.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[var(--accent)] transition-colors"
            >
              <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zm-3 10v5h6v-5h-2v3h-2v-3H9z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-[var(--text-primary)]">Surveying and Levelling by N.N. Basak</h3>
                <p className="text-sm text-[var(--text-secondary)]">Comprehensive textbook covering fundamental surveying techniques, levelling methods, and field procedures</p>
              </div>
              <div className="ml-auto text-[var(--accent)]">PDF →</div>
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
