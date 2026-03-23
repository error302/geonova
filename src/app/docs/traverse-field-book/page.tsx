import Link from 'next/link'

export default function TraverseFieldBookPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline mb-8 text-sm">
          ← Back to Knowledge Base
        </Link>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">How to Use the Traverse Field Book</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Survey Act Cap 299 &middot; Ghilani & Wolf, Elementary Surveying 16th Ed.
        </p>

        <div className="prose prose-invert max-w-none space-y-6">

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Overview</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The traverse field book is where you record raw field observations during a closed traverse survey.
              Each leg of the traverse requires a bearing (whole circle bearing, WCB) and a horizontal distance.
              METARDU&apos;s traverse calculator accepts these field readings and applies the Bowditch or Transit adjustment.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Field Procedure</h2>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li>Set up the total station at Station A (a known control point). Backsight to a known reference direction.</li>
              <li>Measure the horizontal distance to Station B. Record in the field book.</li>
              <li>Read the Whole Circle Bearing (WCB) to Station B from your instrument. Record as D°M&apos;S&quot;.</li>
              <li>Move to Station B. Set up and measure the distance to Station C and its WCB.</li>
              <li>Continue until you return to the starting point A (closed traverse) or to another known point.</li>
              <li>Record all field observations: station name, bearing, and distance for each leg.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Worked Example — 4-Sided Closed Traverse</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Starting point A: E = 3000.000 m, N = 5000.000 m
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-[var(--border-color)] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Line</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Distance (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">WCB (D°M&apos;S&quot;)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Northing (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Easting (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  <tr>
                    <td className="py-2 px-3 font-medium">A→B</td>
                    <td className="py-2 px-3">250.000</td>
                    <td className="py-2 px-3">045°32&prime;08&quot;</td>
                    <td className="py-2 px-3">3000.000</td>
                    <td className="py-2 px-3">5000.000</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">B→C</td>
                    <td className="py-2 px-3">180.500</td>
                    <td className="py-2 px-3">120°07&prime;24&quot;</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">C→D</td>
                    <td className="py-2 px-3">220.750</td>
                    <td className="py-2 px-3">200°20&prime;44&quot;</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">D→A</td>
                    <td className="py-2 px-3">190.250</td>
                    <td className="py-2 px-3">290°34&prime;04&quot;</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Entering Data in METARDU</h2>
            <ol className="list-decimal list-inside space-y-2 text-[var(--text-secondary)]">
              <li>Open <Link href="/tools/traverse" className="text-[var(--accent)] hover:underline">METARDU Traverse Calculator</Link></li>
              <li>Select Bowditch Rule or Transit Rule (Bowditch is most common for land surveys in Kenya).</li>
              <li>Enter the Northing and Easting of Station A in the first row.</li>
              <li>For each leg, enter the distance and WCB as read from the instrument.</li>
              <li>Click &ldquo;Calculate Adjustment&rdquo; to get adjusted coordinates and the precision ratio.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Accuracy Checks</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              After adjustment, check the precision ratio. For a closed traverse, the Linear Misclosure (E) should be assessed against the RDM 1.1 tolerances.
            </p>
            <p className="text-[var(--text-secondary)]">
              A precision ratio of 1:5000 or better (Linear Error &lt; Total Distance / 5000) is typically acceptable for 2nd order surveys.
              The RDM 1.1 standard specifies the maximum allowable misclosure based on the order of survey.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Reference</h2>
            <ul className="text-sm text-[var(--text-muted)] space-y-1">
              <li>Ghilani, C.D. & Wolf, P.R. (2022). <em>Elementary Surveying: An Introduction to Geomatics</em>, 16th Ed. Pearson. Chapter 12.</li>
              <li>Republic of Kenya. <em>Registration of Land Act — Survey Act Cap 299</em>. Government Printer, Nairobi.</li>
              <li>Survey of Kenya. <em>Reduction and Adjustment of Observations (RDM 1.1)</em>. Survey of Kenya, Nairobi 2025.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
