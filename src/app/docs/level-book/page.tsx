import Link from 'next/link'

export default function LevelBookPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline mb-8 text-sm">
          ← Back to Knowledge Base
        </Link>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Level Book — Arithmetic Check Explained</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Survey Act Cap 299 &middot; Ghilani & Wolf, Elementary Surveying 16th Ed.
        </p>

        <div className="prose prose-invert max-w-none space-y-6">

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">What is the Arithmetic Check?</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The arithmetic check is the fundamental verification that your level run has been recorded correctly
              in the field. It confirms that ΣBS − ΣFS = ΣRise − ΣFall. If these two sides are equal,
              the arithmetic is consistent — the algebra has been done correctly.
            </p>
            <p className="text-[var(--text-secondary)] leading-relaxed mt-3">
              If the check fails, there is an arithmetic error in the field book. You must re-check each
              intermediate sight (IS) and reduced level (RL) calculation before submitting the survey.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">The Formula</h2>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 my-4">
              <p className="text-lg font-mono text-[var(--accent)] mb-2">
                ΣBS − ΣFS = ΣRise − ΣFall
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                where ΣBS = sum of all backsights, ΣFS = sum of all foresights,
                ΣRise = sum of all rises, ΣFall = sum of all falls
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Rise & Fall Method</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              For each change point between two foresight readings:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
              <li>If FS &lt; BS: Rise = BS − FS (point is higher than previous)</li>
              <li>If FS &gt; BS: Fall = FS − BS (point is lower than previous)</li>
              <li>RL (new) = RL (old) + Rise − Fall</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Worked Example</h2>
            <p className="text-[var(--text-secondary)] mb-3">Level run with Opening RL = 100.000 m at BM1</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-[var(--border-color)] rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-[var(--bg-tertiary)]">
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Station</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">BS (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">IS (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">FS (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Rise (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">Fall (m)</th>
                    <th className="py-2 px-3 text-left text-[var(--text-muted)]">RL (m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  <tr>
                    <td className="py-2 px-3 font-medium">BM1</td>
                    <td className="py-2 px-3">1.525</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3 font-mono">100.000</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">TP1</td>
                    <td className="py-2 px-3">2.180</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">1.890</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3">0.365</td>
                    <td className="py-2 px-3 font-mono">99.635</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">P1</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">1.670</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">0.220</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3 font-mono">99.855</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">TP2</td>
                    <td className="py-2 px-3">1.420</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">0.985</td>
                    <td className="py-2 px-3">0.995</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3 font-mono">100.850</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">BM2</td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3"></td>
                    <td className="py-2 px-3">1.310</td>
                    <td className="py-2 px-3">0.110</td>
                    <td className="py-2 px-3">—</td>
                    <td className="py-2 px-3 font-mono">100.960</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 bg-[var(--bg-secondary)] border border-green-700/30 rounded-lg p-4">
              <p className="text-sm text-green-300 font-semibold mb-1">Arithmetic Check</p>
              <p className="text-sm text-[var(--text-secondary)]">
                ΣBS − ΣFS = (1.525 + 2.180 + 1.420) − (1.890 + 0.985 + 1.310) = 5.125 − 4.185 = 0.940 m<br/>
                ΣRise − ΣFall = (0.220 + 0.995 + 0.110) − 0.365 = 1.325 − 0.365 = 0.960 m<br/>
                Misclosure = 0.020 m (check fails — re-verify readings)
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Allowable Misclosure</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              The allowable misclosure for a level run is given by:
            </p>
            <p className="text-lg font-mono text-[var(--accent)] mb-3">
              Allowable = ± 12√K mm (per RDM 1.1, where K = distance in km)
            </p>
            <p className="text-[var(--text-secondary)]">
              If the actual misclosure is less than the allowable, the level run is accepted and
              the misclosure is distributed across the turning points (TP) proportionally using the
              falling or rise method.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Reference</h2>
            <ul className="text-sm text-[var(--text-muted)] space-y-1">
              <li>Ghilani, C.D. & Wolf, P.R. (2022). <em>Elementary Surveying</em>, 16th Ed. Chapter 8.</li>
              <li>Survey of Kenya. <em>RDM 1.1 — Reduction and Adjustment of Observations</em>. 2025.</li>
              <li>Republic of Kenya. <em>Survey Act Cap 299</em>. Government Printer.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
