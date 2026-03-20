import Link from 'next/link'

const sections = [
  {
    title: 'Getting Started',
    items: [
      { href: '/docs/quick-start', label: 'Quick Start Guide' },
      { href: '/project/new', label: 'Creating Your First Project' },
      { href: '/project/[id]', label: 'Adding Survey Points' },
      { href: '/tools/traverse', label: 'Running a Traverse' },
    ]
  },
  {
    title: 'Quick Tools Reference',
    items: [
      { href: '/tools/distance', label: 'Distance & Bearing' },
      { href: '/tools/traverse', label: 'Traverse Adjustment' },
      { href: '/tools/leveling', label: 'Leveling' },
      { href: '/tools/cogo', label: 'COGO Tools' },
      { href: '/tools/curves', label: 'Horizontal Curves' },
      { href: '/tools/setting-out', label: 'Setting Out' },
    ]
  },
  {
    title: 'Field Guide',
    items: [
      { href: '/guide/closed-traverse', label: 'Closed Traverse' },
      { href: '/guide/leveling', label: 'Leveling Run' },
      { href: '/guide/radiation', label: 'Radiation Survey' },
      { href: '/guide/setting-out', label: 'Setting Out' },
      { href: '/guide/boundary', label: 'Boundary Survey' },
    ]
  },
  {
    title: 'CSV Import Guide',
    items: [
      { href: '/docs/csv-import', label: 'Supported Formats' },
      { href: '/docs/csv-import#samples', label: 'Sample Files' },
      { href: '/docs/csv-import#troubleshoot', label: 'Troubleshooting' },
    ]
  },
  {
    title: 'FAQ',
    items: [
      { href: '/docs/faq', label: 'Common Questions' },
      { href: '/docs/faq#billing', label: 'Billing' },
      { href: '/docs/faq#technical', label: 'Technical Issues' },
    ]
  },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-[var(--text-primary)] mb-4">
            GeoNova Documentation
          </h1>
          <p className="text-gray-400 text-lg">
            Everything you need to know about GeoNova
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map((section) => (
            <div key={section.title} className="bg-[var(--bg-secondary)] rounded-xl border border-[#222] p-6">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">{section.title}</h2>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-gray-400 hover:text-[#E8841A] text-sm transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 bg-gradient-to-r from-[#E8841A]/20 to-transparent border border-[#E8841A]/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Need More Help?</h2>
          <p className="text-gray-400 mb-6">
            Can't find what you're looking for? Join our WhatsApp community or contact support.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/community"
              className="px-6 py-3 bg-[#E8841A] text-black font-semibold rounded-lg hover:bg-[#d47619]"
            >
              Join Community
            </Link>
            <a
              href="mailto:support@geonova.app"
              className="px-6 py-3 border border-[#E8841A] text-[#E8841A] font-semibold rounded-lg hover:bg-[#E8841A]/10"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
