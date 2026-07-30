'use client';

import type { SolutionStep } from '@/lib/engine/solution/solutionBuilder'

export default function SolutionStepsRenderer({ title, steps }: { title?: string; steps: SolutionStep[] }) {
  return (
    <div className="card">
      <div className="card-header flex items-center justify-between gap-4">
        <span className="label">Solution</span>
        {title ? <span className="text-xs text-[var(--text-muted)]">{title}</span> : null}
      </div>
      <div className="card-body space-y-4">
        {steps.map((s, i) => {
          return (
            <Section key={`${s.label}-${i}`} title={s.label}>
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]/20 p-3 space-y-2">
                <StepBody step={s} />
              </div>
            </Section>
          )
        })}
      </div>
    </div>
  )
}

function StepBody({ step }: { step: SolutionStep }) {
  if (step.label === 'Given') {
    const items = parsePairs(step.result, '=')
    return items.length ? (
      <div className="grid md:grid-cols-2 gap-2">
        {items.map((it, idx) => (
          <div key={`${it}-${idx}`} className="flex items-baseline justify-between gap-3 p-2 rounded bg-gray-950/30 border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-muted)]">{it.left}</div>
            <div className="font-mono text-sm text-[var(--text-primary)] text-right">{it.right}</div>
          </div>
        ))}
      </div>
    ) : (
      <FallbackText text={step.result} />
    )
  }

  if (step.label === 'To Find') {
    const items = (step.result ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith('•') ? l.replace(/^•\s*/, '') : l))
    return items.length ? (
      <ul className="list-disc pl-5 text-sm text-[var(--text-primary)] space-y-1">
        {items.map((x, idx) => (
          <li key={`${x}-${idx}`}>{x}</li>
        ))}
      </ul>
    ) : (
      <FallbackText text={step.result} />
    )
  }

  if (step.label === 'Check') {
    const lines = (step.result ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    return lines.length ? (
      <div className="space-y-2">
        {lines.map((l, idx) => {
          // UI-3 FIX (2026-07-24): l.startsWith('') is always true, so every
          // check line rendered as green (pass) — even failed checks. The
          // solution builder (solutionBuilder.ts:90) emits:
          //   '[x] Label: value' when c.ok === false  (FAIL)
          //   '• Label: value'     when c.ok == null  (neutral)
          //   ' Label: value'      when c.ok === true  (PASS, leading space)
          // Detect in that order.
          const ok: boolean | null = l.startsWith('[x]')
            ? false
            : l.startsWith('•')
              ? null
              : true
          return (
            <div
              key={`${l}-${idx}`}
              className={`flex items-baseline justify-between gap-3 p-2 rounded border ${
                ok === true ? 'border-green-700 bg-green-900/10' : ok === false ? 'border-red-700 bg-red-900/10' : 'border-[var(--border-color)] bg-gray-950/30'
              }`}
            >
              <div className="font-mono text-sm text-[var(--text-primary)]">{l}</div>
            </div>
          )
        })}
      </div>
    ) : (
      <FallbackText text={step.result} />
    )
  }

  if (step.label === 'Final Result') {
    const items = parsePairs(step.result, ':')
    return items.length ? (
      <div className="space-y-2">
        {items.map((it, idx) => (
          <div key={`${it}-${idx}`} className="flex items-baseline justify-between gap-3 p-2 rounded bg-gray-950/30 border border-[var(--border-color)]">
            <div className="text-xs text-[var(--text-muted)]">{it.left}</div>
            <div className="font-mono text-sm text-amber-200 text-right">{it.right}</div>
          </div>
        ))}
      </div>
    ) : (
      <FallbackText text={step.result} highlight />
    )
  }

  const hasAny = Boolean(step.formula || step.substitution || step.computation || step.result)
  return (
    <>
      {step.formula ? <Row label="Formula" value={step.formula} /> : null}
      {step.substitution ? <Row label="Substitution" value={step.substitution} /> : null}
      {step.computation ? <Row label="Computation" value={step.computation} /> : null}
      {step.result ? <Row label="Result" value={step.result} highlight /> : null}
      {!hasAny ? <FallbackText text={'—'} /> : null}
    </>
  )
}

function parsePairs(text: string | undefined, sep: '=' | ':') {
  if (!text) return []
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf(` ${sep} `)
      if (idx === -1) return null
      return { left: l.slice(0, idx).trim(), right: l.slice(idx + 3).trim() }
    })
    .filter((x): x is { left: string; right: string } => Boolean(x))
}

function FallbackText({ text, highlight }: { text?: string; highlight?: boolean }) {
  const value = text?.trim() ? text : '—'
  return <div className={`font-mono text-sm whitespace-pre-wrap ${highlight ? 'text-amber-200 font-semibold' : 'text-[var(--text-primary)]'}`}>{value}</div>
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
    <div className="grid grid-cols-[110px_1fr] gap-3 text-sm">
      <div className="text-[var(--text-muted)]">{label}</div>
      <div className={`font-mono whitespace-pre-wrap ${highlight ? 'text-amber-200 font-semibold' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  )
}
