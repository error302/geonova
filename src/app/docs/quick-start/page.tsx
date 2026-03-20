import Link from 'next/link'

export default function QuickStartPage() {
  const steps = [
    {
      number: '1',
      title: 'Create Account',
      desc: 'Go to geonova.app → Get Started → Register with your email and password',
    },
    {
      number: '2',
      title: 'Create Your First Project',
      desc: 'Dashboard → New Project → Enter project name, location, UTM zone, and hemisphere',
    },
    {
      number: '3',
      title: 'Add Survey Points',
      desc: 'Open your project → Add Point → Enter coordinates (Easting, Northing, Elevation)',
    },
    {
      number: '4',
      title: 'Run a Traverse',
      desc: 'Sidebar → Run Traverse → Enter legs with distances and bearings → Calculate',
    },
    {
      number: '5',
      title: 'Generate Report',
      desc: 'Sidebar → Generate Report → PDF downloads with full working shown',
    },
  ]

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/docs" className="text-[#E8841A] hover:underline mb-8 inline-block">
          ← Back to Documentation
        </Link>

        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-8">Quick Start Guide</h1>

        <div className="space-y-8">
          {steps.map((step) => (
            <div key={step.number} className="flex gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-[#E8841A] rounded-full flex items-center justify-center text-black font-bold text-xl">
                {step.number}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">{step.title}</h2>
                <p className="text-[var(--text-secondary)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-6 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">That's It!</h3>
          <p className="text-[var(--text-secondary)] mb-4">
            Your first survey is complete. You've created a project, added points, run a traverse, and generated a report.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-[#E8841A] text-black font-semibold rounded-lg hover:bg-[#d47619]"
          >
            Go to Dashboard →
          </Link>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Next Steps</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Link
              href="/docs/csv-import"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[#E8841A] transition-colors"
            >
              <h4 className="text-[var(--text-primary)] font-semibold mb-1">Learn CSV Import</h4>
              <p className="text-[var(--text-secondary)] text-sm">Import your field notes automatically</p>
            </Link>
            <Link
              href="/guide"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[#E8841A] transition-colors"
            >
              <h4 className="text-[var(--text-primary)] font-semibold mb-1">Field Guide</h4>
              <p className="text-[var(--text-secondary)] text-sm">Step-by-step survey workflows</p>
            </Link>
            <Link
              href="/tools/leveling"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[#E8841A] transition-colors"
            >
              <h4 className="text-[var(--text-primary)] font-semibold mb-1">Leveling Calculator</h4>
              <p className="text-[var(--text-secondary)] text-sm">Calculate elevations with arithmetic checks</p>
            </Link>
            <Link
              href="/community"
              className="p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] hover:border-[#E8841A] transition-colors"
            >
              <h4 className="text-[var(--text-primary)] font-semibold mb-1">Join Community</h4>
              <p className="text-[var(--text-secondary)] text-sm">Connect with other surveyors</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
