'use client'

import {
  TRAVERSE_ACCURACY_STANDARDS,
  LEVELING_ACCURACY_STANDARDS,
  SURVEY_MARKS,
  KENYA_DATUMS,
  KENYA_UTM_ZONES,
  SURVEY_REGULATIONS,
  MEASUREMENT_UNITS,
  PERMITTED_ERRORS
} from '@/lib/data/kenyaSurveyStandards'

export default function SurveyRegulationsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Kenya Survey Standards Reference</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Kenya Survey Regulations 1994 (Legal Notice 168), RDM 1.1, Cadastral Survey Standards
          </p>
        </div>

        {/* Measurement Units */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Measurement Units (Reg 23)
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(MEASUREMENT_UNITS).map(([key, value]) => (
              <div key={key} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="text-xs text-[var(--text-muted)] uppercase mb-1">{key}</div>
                <div className="font-medium">{value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Permitted Errors */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Permitted Errors (Reg 27)
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2">Measurement Type</th>
                  <th className="text-left py-2">Permitted Error</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(PERMITTED_ERRORS).map(([key, value]) => (
                  <tr key={key} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2 capitalize">{key}</td>
                    <td className="py-2 font-mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Datums & Projections */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Datums & Projections (Reg 24)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {KENYA_DATUMS.map((datum: any) => (
              <div key={datum.code} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="font-semibold">{datum.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">Code: {datum.code}</div>
                <div className="text-xs text-[var(--text-muted)]">Ellipsoid: {datum.ellipsoid}</div>
                <div className="text-xs text-[var(--text-muted)]">Projection: {datum.projection}</div>
              </div>
            ))}
          </div>
        </section>

        {/* UTM Zones */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Kenya UTM Zones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {KENYA_UTM_ZONES.map((zone, i) => (
              <div key={i} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="font-semibold">Zone {zone.zone}{zone.hemisphere}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{zone.region}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Traverse Accuracy */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Traverse Accuracy Standards (RDM 1.1 Table 5.2)
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2">Order</th>
                  <th className="text-left py-2">Precision Ratio</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {TRAVERSE_ACCURACY_STANDARDS.map((std, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2">{std.name}</td>
                    <td className="py-2 font-mono">1 : {std.traversePrecision.toLocaleString()}</td>
                    <td className="py-2 text-[var(--text-muted)]">{std.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Levelling Accuracy */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Levelling Accuracy Standards (RDM 1.1 Table 5.1)
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2">Order</th>
                  <th className="text-left py-2">Allowable Misclosure</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {LEVELING_ACCURACY_STANDARDS.map((std, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2">{std.name}</td>
                    <td className="py-2 font-mono">{std.levelingAllowable}</td>
                    <td className="py-2 text-[var(--text-muted)]">{std.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Note:</strong> For RDM 1.1 compliant Kenya road surveys, use Third Order (10√K mm) as minimum standard.
            </div>
          </div>
        </section>

        {/* Survey Marks */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Survey Marks (Reg 37-47)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SURVEY_MARKS.map((mark: any) => (
              <div key={mark.code} className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-semibold">{mark.code}</span>
                  {mark.isPermanent ? (
                    <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Permanent</span>
                  ) : (
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">Temporary</span>
                  )}
                </div>
                <div className="text-sm font-medium">{mark.name}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">{mark.description}</div>
                <div className="text-xs text-[var(--text-muted)] font-mono mt-1">{mark.regulation}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Regulations Index */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Survey Regulations Index
          </h2>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2">Regulation</th>
                  <th className="text-left py-2">Part</th>
                  <th className="text-left py-2">Title</th>
                  <th className="text-left py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {SURVEY_REGULATIONS.slice(0, 20).map((reg, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="py-2 font-mono">{reg.number}</td>
                    <td className="py-2">{reg.part}</td>
                    <td className="py-2 font-medium">{reg.title}</td>
                    <td className="py-2 text-[var(--text-muted)]">{reg.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick Reference */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
            Quick Reference
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Deed Plan (Reg 99-108)</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li>• Scale: 1:500 to 1:5000</li>
                <li>• North arrow required</li>
                <li>• All boundaries numbered</li>
                <li>• Area in sq m and hectares</li>
                <li>• Beacon schedule required</li>
              </ul>
            </div>
            <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4">
              <h3 className="font-semibold mb-2">Control Survey</h3>
              <ul className="text-sm text-[var(--text-muted)] space-y-1">
                <li>• Min 2 control points for detail</li>
                <li>• Traverse closure ≤ 1:10,000</li>
                <li>• Level run ≤ 10√K mm</li>
                <li>• Coordinates in UTM ARC1960</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
