'use client';

/**
 * HotkeyHelpOverlay — Press "?" to see all registered keyboard shortcuts.
 * ──────────────────────────────────────────────────────────────────────
 * Reads the global hotkey registry and renders a searchable overlay.
 * Automatically disappears on Escape or clicking outside.
 */

import { useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useHotkeys, getRegisteredHotkeys, formatHotkey } from '@/hooks/useHotkeys';

export function HotkeyHelpOverlay() {
  const [open, setOpen] = useState(false);

  useHotkeys('?', () => setOpen(prev => !prev), {
    description: 'Show keyboard shortcuts',
    enableInInput: false,
  });

  useHotkeys('escape', () => setOpen(false), {
    description: 'Close dialog',
    enableInInput: true,
  });

  if (!open) return null;

  const hotkeys = getRegisteredHotkeys();

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="overflow-y-auto p-4 space-y-1.5">
          {hotkeys.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">
              No shortcuts registered yet. Navigate to a page to see its shortcuts.
            </p>
          ) : (
            hotkeys.map((hk, i) => (
              <div
                key={`${hk.keys}-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
              >
                <span className="text-sm text-[var(--text-secondary)]">{hk.description}</span>
                <kbd className="px-2 py-1 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-xs font-mono text-[var(--accent)] whitespace-nowrap">
                  {formatHotkey(hk.keys)}
                </kbd>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)] flex items-center justify-between">
          <span>{hotkeys.length} shortcut{hotkeys.length !== 1 ? 's' : ''}</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-color)] font-mono">?</kbd> to toggle</span>
        </div>
      </div>
    </div>
  );
}
