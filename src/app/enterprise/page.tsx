
export default function EnterprisePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24">
      <h1 className="text-3xl font-bold mb-4">Enterprise Products</h1>
      <p className="text-[var(--text-muted)] mb-12">
        Advanced survey technology for specialized operations.
        Join the waitlist to be notified when these products launch.
      </p>

      <div className="border border-[var(--border-color)] rounded-lg p-6 mb-6 bg-[var(--bg-secondary)]">
        <h2 className="text-xl font-semibold mb-2">Metardu Industrial</h2>
        <p className="text-[var(--text-muted)] mb-4">
          Mining and marine survey operations — including 3D digital twins,
          bathymetric processing, and stockpile volumetrics — live in a
          dedicated desktop application. Visit{' '}
          <a
            href="https://github.com/error302/metardu-industrial"
            className="text-orange-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/error302/metardu-industrial
          </a>{' '}
          for details.
        </p>
        <a
          href="mailto:enterprise@metardu.com"
          suppressHydrationWarning
          className="inline-block bg-orange-500 text-white px-4 py-2 rounded font-medium hover:bg-orange-600"
        >
          Join Waitlist
        </a>
      </div>
    </main>
  )
}
