import Link from 'next/link'

export default function CSVImportPage() {
  const formats = [
    {
      type: 'Traverse',
      headers: 'point_name,distance,bearing',
      example: 'A,125.43,082°15\'30"\nB,98.76,156°45\'20"\nC,142.89,245°30\'10"',
      description: 'For traverse surveys with legs'
    },
    {
      type: 'Leveling',
      headers: 'point_name,bs,fs,remarks',
      example: 'BM1,1.523,,Benchmark\nA,1.245,0.892,Turn point\nB,,1.456,Change point',
      description: 'Rise and fall method'
    },
    {
      type: 'Radiation',
      headers: 'point_name,easting,northing,elevation',
      example: 'P1,484500.1234,9876512.3456,1452.789\nP2,484512.5678,9876520.1234,1453.012',
      description: 'Coordinate radiation from total station'
    },
    {
      type: 'Control Points',
      headers: 'point_name,easting,northing,elevation,is_control,order',
      example: 'CP01,484500.0000,9876500.0000,1450.0000,primary,primary\nCP02,484600.0000,9876600.0000,1451.5000,secondary,secondary',
      description: 'Known control points for project'
    }
  ]

  const tips = [
    'First row must contain headers',
    'No empty rows in data',
    'Use consistent number of decimal places',
    'Bearings in format: DDD°MM\'SS" or decimal degrees',
    'Elevations in meters',
    'UTF-8 encoding preferred'
  ]

  return (
    <div className="min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-6">
        <Link href="/docs" className="text-[var(--accent)] hover:underline mb-8 inline-block">
          ← Back to Documentation
        </Link>

        <h1 className="text-4xl font-bold text-[var(--text-primary)] mb-4">CSV Import Guide</h1>
        <p className="text-[var(--text-secondary)] text-lg mb-12">
          Import your field notes automatically. GeoNova detects the survey type from your CSV format.
        </p>

        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Supported Formats</h2>
          <div className="space-y-6">
            {formats.map((format) => (
              <div key={format.type} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] p-6">
                <h3 className="text-xl font-semibold text-[var(--accent)] mb-2">{format.type}</h3>
                <p className="text-[var(--text-secondary)] text-sm mb-4">{format.description}</p>
                <div className="bg-[var(--bg-primary)] rounded-lg p-4 mb-4">
                  <div className="text-[var(--text-muted)] text-xs mb-2">Headers:</div>
                  <code className="text-green-400 text-sm">{format.headers}</code>
                </div>
                <div className="bg-[var(--bg-primary)] rounded-lg p-4">
                  <div className="text-[var(--text-muted)] text-xs mb-2">Example:</div>
                  <pre className="text-[var(--text-primary)] text-sm whitespace-pre-wrap">{format.example}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="samples" className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Sample Files</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
              <h4 className="text-[var(--text-primary)] font-semibold mb-2">Sample Traverse CSV</h4>
              <p className="text-[var(--text-secondary)] text-sm mb-3">Example traverse data with 5 legs</p>
              <button className="text-[var(--accent)] text-sm hover:underline">Download sample.csv</button>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)] p-4">
              <h4 className="text-[var(--text-primary)] font-semibold mb-2">Sample Leveling CSV</h4>
              <p className="text-[var(--text-secondary)] text-sm mb-3">Example leveling run with BS/FS</p>
              <button className="text-[var(--accent)] text-sm hover:underline">Download sample.csv</button>
            </div>
          </div>
        </section>

        <section id="troubleshoot" className="mb-12">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-6">Tips for Success</h2>
          <ul className="space-y-3">
            {tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-3 text-[var(--text-secondary)]">
                <span className="text-[var(--accent)]">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-[var(--bg-secondary)] rounded-xl border border-red-800/50 p-6">
          <h3 className="text-lg font-semibold text-red-400 mb-4">Common Errors</h3>
          <div className="space-y-4">
            <div>
              <p className="text-[var(--text-primary)] font-medium">"Cannot detect survey type"</p>
              <p className="text-[var(--text-secondary)] text-sm">Check your headers match one of the supported formats</p>
            </div>
            <div>
              <p className="text-[var(--text-primary)] font-medium">"Invalid bearing format"</p>
              <p className="text-[var(--text-secondary)] text-sm">Use DDD°MM'SS" or decimal degrees (e.g., 82.25)</p>
            </div>
            <div>
              <p className="text-[var(--text-primary)] font-medium">"Point already exists"</p>
              <p className="text-[var(--text-secondary)] text-sm">Enable "Overwrite existing points" or rename duplicate points</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
