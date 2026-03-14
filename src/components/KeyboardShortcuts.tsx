'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const shortcuts = [
  { key: '?', description: 'Show keyboard shortcuts', category: 'General' },
  { key: 'Esc', description: 'Close modal / Clear selection', category: 'General' },
  { key: 'g d', description: 'Go to Dashboard', category: 'Navigation' },
  { key: 'g t', description: 'Go to Tools', category: 'Navigation' },
  { key: 'g p', description: 'Go to Projects', category: 'Navigation' },
  { key: 'n p', description: 'New Project', category: 'Actions' },
  { key: 'd', description: 'Toggle Distance mode (in project)', category: 'Project' },
  { key: 'a', description: 'Toggle Area mode (in project)', category: 'Project' },
  { key: 'p', description: 'Add Point (in project)', category: 'Project' },
  { key: 'Ctrl + s', description: 'Save / Export', category: 'Actions' },
  { key: 'Ctrl + p', description: 'Print results', category: 'Actions' },
  { key: '/', description: 'Focus search', category: 'Actions' },
]

export default function KeyboardShortcuts() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setShow(prev => !prev)
      }
      if (e.key === 'Escape') setShow(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!show) return null

  const grouped = shortcuts.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = []
    acc[s.category].push(s)
    return acc
  }, {} as Record<string, typeof shortcuts>)

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={() => setShow(false)}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">⌨️ Keyboard Shortcuts</h2>
            <button
              onClick={() => setShow(false)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1">Press ? to toggle this menu</p>
        </div>
        
        <div className="p-6 space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-gray-300">{s.description}</span>
                    <kbd className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-sm font-mono text-amber-400">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-800 text-center">
          <Link href="/docs" className="text-sm text-amber-400 hover:underline">
            View full documentation →
          </Link>
        </div>
      </div>
    </div>
  )
}
