'use client';

import type { Solution } from '@/lib/solution/schema'

export default function SolutionRenderer({ solution }: { solution: Solution }) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between gap-4">
        <span className="label">Solution</span>
        {solution.title ? <span className="text-xs text-[var(--text-muted)]">{solution.title}</span> : null}
      </div>
      <div className="card-body space-y-4">
        <Section title="Given">
          <div className="grid md:grid-cols-2 gap-2">
            {solution.given.map((g) => (
              <div key={g.label} className="flex items-baseline justify-between gap-3 p-2 rounded bg-gray-950/30 border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-muted)]">{g.label}</div>
                <div className="font-mono text-sm text-[var(--text-primary)] text-right">{g.value}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="To Find">
          <ul className="list-disc pl-5 text-sm text-[var(--text-primary)] space-y-1">
            {solution.toFind.map((x, i) => (
              <li key={`${x}-${i}`}>{x}</li>
            ))}
          </ul>
        </Section>

        <Section title="Solution">
          <div className="space-y-3">
            {solution.solution.map((s) => (
              <div key={s.title} className="rounded-lg border border-[var(--border-color)] bg-gray-950/20 p-3">
                {s.title ? <div className="text-sm font-semibold text-amber-300 mb-2">{s.title}</div> : null}
                <Row label="Formula" value={s.formula} />
                {s.substitution ? <Row label="Substitution" value={s.substitution} /> : null}
                {s.computation ? <Row label="Computation" value={s.computation} /> : null}
                {s.result ? <Row label="Result" value={s.result} highlight /> : null}
              </div>
            ))}
          </div>
        </Section>

        {solution.check && solution.check.length > 0 ? (
          <Section title="Check">
            <div className="space-y-2">
              {solution.check.map((c) => (
                <div
                  key={c.label}
                  className={`flex items-baseline justify-between gap-3 p-2 rounded border ${
                    c.ok === true
                      ? 'border-green-700 bg-green-900/10'
                      : c.ok === false
                        ? 'border-red-700 bg-red-900/10'
                        : 'border-[var(--border-color)] bg-gray-950/30'
                  }`}
                >
                  <div className="text-xs text-[var(--text-muted)]">{c.label}</div>
                  <div className="font-mono text-sm text-[var(--text-primary)] text-right">{c.value}</div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}

        <Section title="Result">
          <div className="space-y-2">
            {solution.result.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 p-2 rounded bg-gray-950/30 border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-muted)]">{r.label}</div>
                <div className="font-mono text-sm text-amber-200 text-right">{r.value}</div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-2">{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 text-sm">
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className={`font-mono ${highlight ? 'text-amber-200 font-semibold' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  )
}

