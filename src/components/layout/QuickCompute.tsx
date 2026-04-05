'use client'

import { useState } from 'react'
import Link from 'next/link'

const TOOLS = [
  {
    category: 'Calculations',
    items: [
      { label: 'Distance & Bearing', href: '/tools/distance' },
      { label: 'Bearing', href: '/tools/bearing' },
      { label: 'Area', href: '/tools/area' },
      { label: 'Grade', href: '/tools/grade' },
    ]
  },
  {
    category: 'Traverse & Adjustment',
    items: [
      { label: 'Traverse', href: '/tools/traverse' },
      { label: 'Coordinates', href: '/tools/coordinates' },
      { label: 'COGO', href: '/tools/cogo' },
      { label: 'GNSS', href: '/tools/gnss' },
    ]
  },
  {
    category: 'Levelling',
    items: [
      { label: 'Leveling', href: '/tools/leveling' },
      { label: 'Two Peg Test', href: '/tools/two-peg-test' },
    ]
  },
  {
    category: 'Curves & Roads',
    items: [
      { label: 'Curves', href: '/tools/curves' },
      { label: 'Chainage', href: '/tools/chainage' },
      { label: 'Tacheometry', href: '/tools/tacheometry' },
    ]
  },
  {
    category: 'Earthworks',
    items: [
      { label: 'Cross Sections', href: '/tools/cross-sections' },
      { label: 'Setting Out', href: '/tools/setting-out' },
    ]
  },
  {
    category: 'Engineering',
    items: [
      { label: 'Superelevation', href: '/tools/superelevation' },
      { label: 'Sight Distance', href: '/tools/sight-distance' },
      { label: 'Pipe Gradient', href: '/tools/pipe-gradient' },
      { label: 'Borrow Pit Volume', href: '/tools/borrow-pit-volume' },
      { label: 'Stockpile Volume', href: '/tools/stockpile-volume' },
    ]
  },
  {
    category: 'Utilities',
    items: [
      { label: 'Datum Converter', href: '/online' },
    ]
  }
]

export function QuickCompute() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2
                   bg-orange-500 hover:bg-orange-600 text-white
                   px-4 py-3 rounded-full shadow-lg font-medium
                   transition-colors"
      >
        <span>⚡</span>
        <span>Quick Compute</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/60"
            onClick={() => setOpen(false)}
          />

          <div className="w-80 bg-[var(--bg-secondary)] border-l overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h2 className="font-semibold text-lg">Quick Compute</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-6">
              {TOOLS.map(group => (
                <div key={group.category}>
                  <p className="text-xs font-semibold text-[var(--text-muted)]
                                uppercase tracking-wider mb-2">
                    {group.category}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block px-3 py-2 rounded text-sm
                                   hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
