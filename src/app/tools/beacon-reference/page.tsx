'use client'

import type { BeaconType, BeaconStatus } from '@/types/deedPlan'
import { BEACON_DEFINITIONS, getBeaconSymbolSVG, BEACON_CATEGORIES } from '@/lib/compute/beaconSymbols'

const STATUSES: BeaconStatus[] = ['FOUND', 'SET', 'DESTROYED', 'NOT_FOUND']

interface CategoryGroup {
  title: string
  types: readonly BeaconType[]
}

const CATEGORIES: CategoryGroup[] = [
  { title: 'Control Marks', types: BEACON_CATEGORIES.CONTROL },
  { title: 'Boundary Marks', types: BEACON_CATEGORIES.BOUNDARY },
  { title: 'Level Marks', types: BEACON_CATEGORIES.LEVEL },
  { title: 'Road & Infrastructure', types: BEACON_CATEGORIES.ROAD },
  { title: 'Special', types: BEACON_CATEGORIES.SPECIAL }
]

export default function BeaconReferencePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Survey Mark Reference</h1>
          <p className="text-[var(--text-muted)] mt-1">
            Kenya Survey Regulations 1994 — Beacon Symbol Library
          </p>
        </div>

        {CATEGORIES.map((category: any) => (
          <div key={category.title} className="mb-10">
            <h2 className="text-lg font-semibold mb-4 pb-2 border-b border-[var(--border-color)]">
              {category.title}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {category.types.map((type: any) => {
                const def = BEACON_DEFINITIONS[type as BeaconType]
                
                return (
                  <div 
                    key={type}
                    className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{def.shortCode}</span>
                          <span className="text-sm text-[var(--text-muted)]">— {def.fullName}</span>
                        </div>
                        <div className="flex gap-1 mt-1">
                          {def.isPermanent && (
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded">Permanent</span>
                          )}
                          {def.isControlMark && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded">Control</span>
                          )}
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">
                            {def.defaultOrder}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      {def.description}
                    </p>

                    <div className="text-[10px] text-[var(--text-muted)] mb-3 font-mono">
                      {def.regulation}
                    </div>

                    <div className="border-t border-[var(--border-color)] pt-3">
                      <div className="text-xs text-[var(--text-muted)] mb-2">Status variants:</div>
                      <div className="grid grid-cols-4 gap-2">
                        {STATUSES.map((status: any) => (
                          <div key={status} className="flex flex-col items-center">
                            <div 
                              className="w-10 h-10"
                              dangerouslySetInnerHTML={{ 
                                __html: getBeaconSymbolSVG(type, status, 16) 
                              }} 
                            />
                            <span className="text-[9px] text-[var(--text-muted)] mt-1">{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="mt-8 p-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl">
          <h3 className="font-semibold mb-2">Quick Reference</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium text-[var(--accent)]">Control Marks</div>
              <div className="text-xs text-[var(--text-muted)]">Blue symbols on plans</div>
            </div>
            <div>
              <div className="font-medium text-black">Boundary Marks</div>
              <div className="text-xs text-[var(--text-muted)]">Black symbols on plans</div>
            </div>
            <div>
              <div className="font-medium text-green-600">Level Marks</div>
              <div className="text-xs text-[var(--text-muted)]">Green symbols on plans</div>
            </div>
            <div>
              <div className="font-medium text-red-600">Destroyed</div>
              <div className="text-xs text-[var(--text-muted)]">Red cross through symbol</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
