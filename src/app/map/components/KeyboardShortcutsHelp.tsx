'use client'
/**
 * KeyboardShortcutsHelp — Floating overlay showing keyboard shortcuts
 *
 * Shows when user presses `?` key. Displays all available shortcuts
 * as a semi-transparent modal overlay.
 */

import React, { memo, useState, useEffect, useCallback } from 'react'
import { X, Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { keys: 'Ctrl+Z', description: 'Undo' },
  { keys: 'Ctrl+Y / Ctrl+Shift+Z', description: 'Redo' },
  { keys: 'Delete / Backspace', description: 'Delete selected feature' },
  { keys: 'Escape', description: 'Cancel current tool' },
  { keys: 'Alt+Drag', description: 'Rotate map' },
  { keys: '?', description: 'Show/hide this help' },
]

export const KeyboardShortcutsHelp = memo(function KeyboardShortcutsHelp() {
  const [visible, setVisible] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in input fields
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return
    }

    if (e.key === '?' || (e.shiftKey && e.key === '/')) {
      e.preventDefault()
      setVisible((prev) => !prev)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 "
      onClick={() => setVisible(false)}
    >
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)]/[0.08] rounded-xl shadow-2xl  p-5 min-w-[320px] max-w-[420px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={() => setVisible(false)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.keys}
              className="flex items-center justify-between py-1.5 px-2 rounded-md bg-[var(--bg-card)]/[0.03] hover:bg-[var(--bg-card)]/[0.06] transition-colors"
            >
              <span className="text-[11px] text-[var(--text-secondary)]">{shortcut.description}</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-[var(--bg-card)]/[0.08] text-[var(--text-secondary)] rounded border border-[var(--border-color)]/[0.1]">
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-4 pt-3 border-t border-[var(--border-color)]/[0.06] text-center">
          <span className="text-[9px] text-[var(--text-muted)]">
            Press <kbd className="px-1 py-0.5 text-[9px] font-mono bg-[var(--bg-card)]/[0.06] text-[var(--text-muted)] rounded border border-[var(--border-color)]/[0.08]">?</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
})
