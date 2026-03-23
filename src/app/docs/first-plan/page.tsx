import Link from 'next/link'

export default function FirstPlanPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline mb-8 text-sm">
          ← Back to Knowledge Base
        </Link>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Generating Your First Survey Plan — Step by Step</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Survey Act Cap 299 &middot; Land Registration Act 2012 &middot; METARDU Workflow Guide
        </p>

        <div className="prose prose-invert max-w-none space-y-6">

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Overview</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              A survey plan is the formal output of a cadastral survey. It is submitted to the Land Registry
              as part of a registration transaction (subdivision, change of lease, new title). METARDU
              generates a professional PDF plan that meets Survey of Kenya submission standards.
              This guide walks you through the complete workflow.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 1 — Create Your Project</h2>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li>Sign in to METARDU and go to <Link href="/project/new" className="text-[var(--accent)] hover:underline">New Project</Link>.</li>
              <li>Set the project name, location, UTM Zone (e.g. Zone 37S for Nairobi), and datum (Arc 1960 / UTM WGS84).</li>
              <li>Select the survey type: Closed Traverse, Radiation, or other method.</li>
              <li>The project is now ready to receive survey data.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 2 — Enter Survey Data</h2>
            <p className="text-[var(--text-secondary)] mb-3">There are three ways to enter data:</p>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li><strong>Manual entry:</strong> Add points one by one with coordinates.</li>
              <li><strong>Field Book:</strong> Use the <Link href="/fieldbook" className="text-[var(--accent)] hover:underline">Field Book</Link> to record traverse or radiation data in the field.</li>
              <li><strong>CSV Import:</strong> Upload a CSV from your data collector. Supported formats include total station CSV exports.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 3 — Run Traverse Adjustment (if applicable)</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              For closed traverses, run the adjustment in <Link href="/tools/traverse" className="text-[var(--accent)] hover:underline">Traverse Calculator</Link>:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li>Select Bowditch Rule (most common for land surveys).</li>
              <li>Enter your known control point coordinates and field observations.</li>
              <li>Click &ldquo;Calculate Adjustment&rdquo;.</li>
              <li>METARDU will display adjusted coordinates, precision ratio, and an RDM 1.1 accuracy badge.</li>
              <li>Click &ldquo;Copy&rdquo; to copy the adjusted coordinates back to your project.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 4 — Run a Level Run Check (if applicable)</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              If your survey includes elevation data, use the <Link href="/tools/levelling" className="text-[var(--accent)] hover:underline">Levelling Calculator</Link>:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li>Enter your BS, IS, and FS readings.</li>
              <li>METARDU automatically checks ΣBS − ΣFS = ΣRise − ΣFall.</li>
              <li>If misclosure is within RDM 1.1 allowable limits, the arithmetic check passes.</li>
              <li>Reduced levels are distributed across turning points automatically.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 5 — Draw the Parcel</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              In your project workspace, use the parcel builder to outline the land parcel on the map.
              METARDU will calculate the area automatically using the Gauss-Euler (shoelace) formula
              from the adjusted coordinates.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 6 — Generate the Survey Plan</h2>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li>In your project, click <strong>Generate Survey Plan</strong>.</li>
              <li>Fill in the plan details: surveyor name, job number, parcel description, field conditions.</li>
              <li>Select the survey methods and equipment used.</li>
              <li>Add any difficulties encountered in the field.</li>
              <li>METARDU generates a PDF report containing:</li>
              <ul className="list-disc list-inside ml-6 mt-1 space-y-1">
                <li>Adjusted traverse coordinates table</li>
                <li>Precision statement (RDM 1.1 accuracy class)</li>
                <li>Level run arithmetic check results</li>
                <li>Computed area and perimeter</li>
                <li>Parcel sketch (if available)</li>
                <li>Certificate of accuracy for surveyor signature</li>
              </ul>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Step 7 — Sign and Submit</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              After generating the plan:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li>Download the PDF from METARDU.</li>
              <li>Have it counter-signed by your supervising surveyor (if you are a graduate surveyor).</li>
              <li>Submit to the Land Registry through the relevant portal or physical submission.</li>
              <li>METARDU also supports DXF export for submission to digital cadastre systems.</li>
            </ul>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Reference</h2>
            <ul className="text-sm text-[var(--text-muted)] space-y-1">
              <li>Republic of Kenya. <em>Survey Act, Cap 299</em>. Government Printer, Nairobi.</li>
              <li>Republic of Kenya. <em>Land Registration Act, No. 3 of 2012</em>. Government Printer.</li>
              <li>Survey of Kenya. <em>RDM 1.1 — Reduction and Adjustment of Observations</em>. 2025.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
