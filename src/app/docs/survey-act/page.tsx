import Link from 'next/link'

export default function SurveyActPage() {
  return (
    <div className="min-h-screen py-16">
      <div className="max-w-3xl mx-auto px-6">
        <Link href="/docs" className="inline-flex items-center gap-2 text-[var(--accent)] hover:underline mb-8 text-sm">
          ← Back to Knowledge Base
        </Link>

        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Survey Act Cap 299 — Key Requirements for Surveyors</h1>
        <p className="text-sm text-[var(--text-muted)] mb-8">
          Republic of Kenya &middot; Laws of Kenya &middot; Cap 299
        </p>

        <div className="prose prose-invert max-w-none space-y-6">

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Overview</h2>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              The Survey Act Cap 299 is the primary legislation governing land surveying practice in Kenya.
              It establishes the Survey of Kenya (SoK), regulates the qualifications and conduct of surveyors,
              and prescribes standards for land surveys. All cadastral surveys submitted to land registries
              in Kenya must comply with these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Who Can Practice</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Under Section 5 of the Survey Act, only a registered surveyor may practice land surveying
              in Kenya. To register, a person must:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li>Hold an examination qualifying for admission as a graduate member of the Institution of Surveyors of Kenya (ISK)</li>
              <li>Have served a period of articles under a registered surveyor (minimum 3 years practical training)</li>
              <li>Pass the professional examination set by the Survey of Kenya</li>
              <li>Be entered in the Register of Surveyors maintained by the Survey Board</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Cadastral Survey Standards</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Cadastral surveys define and record land boundaries. Key requirements under Cap 299 and associated regulations include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)]">
              <li><strong>Control Network:</strong> All surveys must be connected to the national geodetic control network (bench marks and beacon stations).</li>
              <li><strong>Bearings:</strong> Whole Circle Bearings referenced to the relevant meridian (Meridian of 37° or 35°E for Kenya).</li>
              <li><strong>Accuracy Standards:</strong> Perimeter misclosure must be within RDM 1.1 tolerances. See the <Link href="/docs/rdm-accuracy" className="text-[var(--accent)] hover:underline">RDM 1.1 accuracy classification</Link>.</li>
              <li><strong>Field Books:</strong> Original field books must be retained for a minimum of 10 years.</li>
              <li><strong>Beacons:</strong> All boundary corners must be marked with permanent beacons as specified in the regulations.</li>
              <li><strong>Digital Submissions:</strong> Plans submitted electronically must meet the SoK digital plan requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">RDM 1.1 — Survey Accuracy Standards</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              The Reduction and Adjustment of Observations (RDM 1.1) published by Survey of Kenya classifies
              traverse accuracy into orders and classes. The formula for allowable misclosure is:
            </p>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6 my-4">
              <p className="text-lg font-mono text-[var(--accent)] mb-2">
                m = C / √K  (millimetres per √kilometre)
              </p>
              <p className="text-sm text-[var(--text-muted)]">
                where C = linear misclosure (mm), K = traverse perimeter (km)<br/>
                See <Link href="/docs/rdm-accuracy" className="text-[var(--accent)] hover:underline">RDM 1.1 accuracy classification</Link> for worked examples.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Plan Requirements</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Under the Survey Act and the Land Registration Act 2012, survey plans must:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[var(--text-secondary)]">
              <li>Be prepared by a registered surveyor whose seal and signature appear on the plan</li>
              <li>Show all beacon numbers, coordinates (Easting/Northing in UTM), and bearings</li>
              <li>Include a precision statement (e.g. &ldquo;Traverse precision: 1:10,000 — Second Order Class II&rdquo;)</li>
              <li>Show the method of survey (e.g. closed traverse, GPS RTK)</li>
              <li>Reference the datum and UTM zone used</li>
              <li>Include a certificate of accuracy signed by the surveyor</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-3">Penalties and Professional Conduct</h2>
            <p className="text-[var(--text-secondary)] mb-3">
              Section 14 of the Survey Act makes it an offence to practice as a surveyor without registration.
              Penalties include fines and imprisonment. Surveyors who submit inaccurate plans may be
              struck from the register and face civil liability.
            </p>
            <p className="text-[var(--text-secondary)]">
              Professional conduct is governed by the Institution of Surveyors of Kenya (ISK) Code of Ethics.
              Continuous Professional Development (CPD) is mandatory for annual licence renewal.
            </p>
          </section>

          <section className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Key References</h2>
            <ul className="text-sm text-[var(--text-muted)] space-y-1">
              <li>Republic of Kenya. <em>Survey Act, Cap 299</em>. Laws of Kenya. Government Printer, Nairobi.</li>
              <li>Republic of Kenya. <em>Land Registration Act, No. 3 of 2012</em>. Government Printer.</li>
              <li>Survey of Kenya. <em>RDM 1.1 — Reduction and Adjustment of Observations</em>. 2025 Edition.</li>
              <li>Institution of Surveyors of Kenya (ISK). <em>Code of Professional Conduct</em>.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
