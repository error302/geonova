import Link from 'next/link'

export default function RdmAccuracyPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline mb-8 text-sm">
          ← Back to Knowledge Base
        </Link>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">RDM 1.1 — Accuracy Classification Explained</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Survey of Kenya &middot; RDM 1.1 Kenya 2025 &middot; Ghilani & Wolf, Elementary Surveying 16th Ed.
        </p>

        <div className="prose prose-invert max-w-none space-y-6">

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">What is RDM 1.1?</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              RDM 1.1 (Reduction and Adjustment of Observations) is the standard published by the Survey of Kenya
              that defines the permissible accuracy limits for geodetic and cadastral surveys in Kenya.
              It classifies survey accuracy into Orders and Classes based on the relationship between
              traverse misclosure and perimeter.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">The Formula</h2>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 my-4">
              <p className="text-lg font-mono text-[var(--accent)] mb-3">
                m = C / √K
              </p>
              <div className="text-sm text-[var(--text-muted)] space-y-1">
                <p>where:</p>
                <p><strong>m</strong> = relative accuracy expressed in mm/√km</p>
                <p><strong>C</strong> = linear misclosure in millimetres</p>
                <p><strong>K</strong> = traverse perimeter in kilometres</p>
              </div>
            </div>
            <p className="text-[var(--text-secondary)]">
              METARDU calculates this automatically when you run a traverse adjustment.
              The result tells you the accuracy class your survey achieves.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">RDM 1.1 Accuracy Classes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-[var(--border-color)] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Order / Class</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">m (mm/√km)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Typical Use</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  <tr>
                    <td className="py-2 px-3 font-medium text-green-300">First Order Class I</td>
                    <td className="py-2 px-3 font-mono">0.5</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">Primary geodetic control</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-green-300">First Order Class II</td>
                    <td className="py-2 px-3 font-mono">0.7</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">Secondary geodetic networks</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-yellow-300">Second Order Class I</td>
                    <td className="py-2 px-3 font-mono">1.0</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">Major cadastral surveys</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-orange-300">Second Order Class II</td>
                    <td className="py-2 px-3 font-mono">1.3</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">Standard cadastral surveys</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium text-red-300">Third Order</td>
                    <td className="py-2 px-3 font-mono">2.0</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">Detail surveys, property subdivisions</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Worked Example</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Closed traverse: 4 stations, total perimeter = 842.5 m, Linear misclosure = 0.048 m
            </p>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 space-y-3">
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p><strong>Step 1:</strong> Convert perimeter to km</p>
                <p className="font-mono ml-4">K = 842.5 m / 1000 = 0.8425 km</p>
              </div>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p><strong>Step 2:</strong> Convert misclosure to mm</p>
                <p className="font-mono ml-4">C = 0.048 m × 1000 = 48 mm</p>
              </div>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p><strong>Step 3:</strong> Calculate m</p>
                <p className="font-mono ml-4">m = C / √K = 48 / √0.8425 = 48 / 0.9179 = 52.29 mm/√km</p>
              </div>
              <div className="text-sm text-[var(--text-secondary)] space-y-1">
                <p><strong>Step 4:</strong> Compare with RDM 1.1 Table 2.4</p>
                <p className="font-mono ml-4">
                  52.29 mm/√km &gt; 2.0 — <span className="text-red-300 font-semibold">Below Third Order</span>
                </p>
                <p className="text-xs text-[var(--text-muted)] ml-4 mt-1">
                  This traverse would require a better instrument, shorter legs, or more precise methods
                  to meet cadastral standards.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Practical Implications for Cadastral Surveys</h2>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
              <li>Most land subdivision surveys in Kenya should meet <strong>Third Order</strong> (m ≤ 2.0 mm/√km) minimum.</li>
              <li>Town surveys and dense urban subdivisions typically require <strong>Second Order Class II</strong>.</li>
              <li>Precision ratio alone (e.g. 1:10,000) is not sufficient — the RDM 1.1 formula must be applied to determine the accuracy class.</li>
              <li>METARDU displays the accuracy badge on every traverse result, so you can immediately see if your survey meets the required standard.</li>
            </ul>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Reference</h2>
            <ul className="text-sm text-[var(--text-muted)] space-y-1">
              <li>Survey of Kenya. <em>RDM 1.1 — Reduction and Adjustment of Observations</em>. 2025 Edition. Survey of Kenya, Nairobi.</li>
              <li>Ghilani, C.D. & Wolf, P.R. (2022). <em>Elementary Surveying: An Introduction to Geomatics</em>, 16th Ed. Pearson. Chapter 12.</li>
              <li>Republic of Kenya. <em>Survey Act, Cap 299</em>. Government Printer, Nairobi.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
