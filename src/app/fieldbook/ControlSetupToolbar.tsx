'use client';

import type { ControlSetup, ControlStation } from './types';

interface ControlSetupToolbarProps {
  controlSetups: ControlSetup[];
  setControlSetups: React.Dispatch<React.SetStateAction<ControlSetup[]>>;
  activeControlSetupId: string;
  setActiveControlSetupId: (id: string) => void;
  controlStation: ControlStation;
}

export default function ControlSetupToolbar({
  controlSetups,
  setControlSetups,
  activeControlSetupId,
  setActiveControlSetupId,
  controlStation,
}: ControlSetupToolbarProps) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {controlSetups.map((s, idx) => {
            const label = s.station.name?.trim() ? s.station.name.trim() : `Setup ${idx + 1}`
            const active = s.id === activeControlSetupId
            return (
              <button
                key={s.id}
                onClick={() => setActiveControlSetupId(s.id)}
                className={`px-3 py-2 rounded-lg text-sm border whitespace-nowrap transition-colors ${
                  active ? 'bg-amber-500/10 border-amber-500/40 text-amber-300' : 'bg-[color-mix(in_srgb,var(--bg-secondary)_40%,transparent)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30'
                }`}
              >
                {label}
              </button>
            )
          })}

          <button
            className="px-3 py-2 rounded-lg text-sm border bg-[color-mix(in_srgb,var(--bg-secondary)_40%,transparent)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-amber-500/30 whitespace-nowrap"
            onClick={() => {
              const id = crypto.randomUUID()
              const suffix = controlSetups.length + 1
              const template = controlStation
              setControlSetups((prev) => [
                ...prev,
                {
                  id,
                  station: { ...template, name: template.name ? `${template.name}_${suffix}` : `STN${suffix}` },
                  rows: [
                    {
                      id: crypto.randomUUID(),
                      pointId: `P1`,
                      instrumentHeight: '1.500',
                      targetHeight: '1.500',
                      bearing: '',
                      verticalAngle: '0',
                      slopeDistance: '',
                      remarks: '',
                    },
                  ],
                },
              ])
              setActiveControlSetupId(id)
            }}
          >
            + Setup
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-secondary"
            onClick={() => {
              const src = controlSetups.find((s) => s.id === activeControlSetupId)
              if (!src) return
              const id = crypto.randomUUID()
              const suffix = controlSetups.length + 1
              setControlSetups((prev) => [
                ...prev,
                {
                  id,
                  station: { ...src.station, name: src.station.name ? `${src.station.name}_copy${suffix}` : `STN_copy${suffix}` },
                  rows: src.rows.map((r) => ({ ...r, id: crypto.randomUUID() })),
                },
              ])
              setActiveControlSetupId(id)
            }}
          >
            Duplicate
          </button>
          <button
            className="btn btn-secondary"
            disabled={controlSetups.length <= 1}
            onClick={() => {
              if (controlSetups.length <= 1) return
              if (!confirm('Remove this setup?')) return
              const next = controlSetups.filter((s) => s.id !== activeControlSetupId)
              const nextActive = next[0]?.id ?? controlSetups[0]?.id
              setControlSetups(next.length ? next : controlSetups)
              if (nextActive) setActiveControlSetupId(nextActive)
            }}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="text-xs text-[var(--text-muted)]">
        A “setup” is one instrument station (HI) with multiple shots/points in the table below. Use <span className="text-[var(--text-primary)] font-semibold">Add Row</span> to record more than one control/detail point.
      </div>
    </div>
  );
}
