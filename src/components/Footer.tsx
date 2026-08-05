import Link from 'next/link'

/* ────────────────────────────────────────────────────────────── */
/*  Data                                                          */
/* ────────────────────────────────────────────────────────────── */

const FOOTER_LINKS = {
  Apps: [
    { label: 'METARDU Web & Desktop', href: '/tools' },
    { label: 'METARDU Industrial (Mining/Marine)', href: '/industrial' },
    { label: 'METARDU Access (Mobile)', href: '/fieldbook' },
    { label: 'Pricing & Licensing', href: '/pricing' },
  ],
  Compliance: [
    { label: 'Land Law & Survey Assistance', href: '/land-law' },
    { label: 'Survey Regulations', href: '/tools/survey-regulations' },
    { label: 'Kenya CORS Network', href: '/kencors' },
    { label: 'Survey Act Cap 299', href: '/docs/survey-act' },
  ],
  Developers: [
    { label: 'Quick Start Guide', href: '/docs/quick-start' },
    { label: 'Contact Support', href: 'mailto:hello@metardu.app' },
  ],
} as const

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/docs/privacy' },
  { label: 'Terms of Service', href: '/docs/terms' },
  { label: 'Refund Policy', href: '/docs/refund' },
  { label: 'Data Protection', href: '/docs/data-protection' },
] as const

/* ────────────────────────────────────────────────────────────── */
/*  Component                                                     */
/* ────────────────────────────────────────────────────────────── */

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-primary)]">
      {/* ─── Main footer content ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10 sm:py-12 lg:py-16">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-8 lg:gap-8">
            {/* Brand column — spans 2 on lg+ */}
            <div className="col-span-2">
              <Link href="/" className="inline-block mb-3 sm:mb-4">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
                  META<span className="text-[var(--accent)]">RDU</span>
                </h3>
              </Link>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed max-w-xs mb-4 sm:mb-6">
                Professional land surveying platform built from Kenya for Africa.
                Precision tools for the modern surveyor.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href="https://x.com/itsdosho"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1"
                  aria-label="Twitter / X"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/error302"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1"
                  aria-label="GitHub"
                >
                  <svg viewBox="0 0 20 20" className="w-5 h-5" fill="currentColor">
                    <path d="M10 2a8 8 0 00-2.53 15.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.63 7.63 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0018 10a8 8 0 00-8-8z" />
                  </svg>
                </a>
                <a
                  href="mailto:hello@metardu.app"
                  className="text-gray-400 hover:text-[var(--accent)] transition-colors p-1"
                  aria-label="Email"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
                    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.2" />
                    <ellipse cx="10" cy="10" rx="4" ry="8" stroke="currentColor" strokeWidth="0.8" />
                    <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="0.8" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Link columns */}
            {Object.entries(FOOTER_LINKS).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider mb-3 sm:mb-4">
                  {title}
                </h4>
                <ul className="space-y-2 sm:space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        prefetch={false}
                        className="text-sm text-gray-300 hover:text-[var(--accent)] transition-colors font-medium"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar — copyright */}
        <div className="py-6 sm:py-8 border-t border-[var(--border-color)] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-xs text-gray-400 text-center sm:text-left">
            &copy; {year} METARDU. All rights reserved.
          </p>
        </div>
      </div>

      {/* ─── Legal disclaimer section ────────────────────────────── */}
      <div className="border-t border-[var(--border-color)] py-4 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-400">
          <div className="flex flex-wrap justify-center gap-x-1 gap-y-1">
            <span>METARDU v1.0 &mdash; Professional Surveying Platform &mdash; EPSG:21037 (Arc 1960 / UTM Zone 37S)</span>
            <span>&middot;</span>
            {LEGAL_LINKS.map((link, i) => (
              <span key={link.label} className="flex items-center gap-1">
                {i > 0 && <span>&middot;</span>}
                <Link href={link.href} prefetch={false} className="text-[var(--accent)] hover:underline">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
          <div className="mt-2 text-xs sm:text-xs text-gray-400 max-w-4xl mx-auto leading-relaxed px-2">
            METARDU is a computation tool, not a substitute for professional surveyor judgment. All outputs
            (coordinates, areas, deed plans, mutation forms, reports) must be independently verified by a
            licensed surveyor registered with ISK/EBK before use for legal, construction, or registration
            purposes. No output constitutes a certified survey under the Survey Act Cap 299 unless separately
            authenticated by the Survey of Kenya.
          </div>
          <div className="mt-1 sm:mt-2 text-xs text-gray-400">
            SRID: EPSG:21037 Arc 1960 / UTM Zone 37S
          </div>
        </div>
      </div>
    </footer>
  )
}
