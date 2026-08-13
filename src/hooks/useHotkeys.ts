'use client';

/**
 * useHotkeys — Global keyboard shortcut system for METARDU.
 * ──────────────────────────────────────────────────────────────
 * Registers keyboard shortcuts that work anywhere in the app.
 * Supports:
 *   - Modifier combos: Ctrl+Z, Ctrl+Shift+N, Alt+Enter
 *   - Single keys: Escape, Delete, ?
 *   - Scoped shortcuts (only active when a specific element is focused)
 *   - Descriptions for the shortcut help overlay (? key)
 *
 * Usage:
 *   useHotkeys('ctrl+z', handleUndo, { description: 'Undo last action' })
 *   useHotkeys('ctrl+shift+z', handleRedo, { description: 'Redo' })
 *   useHotkeys('escape', handleDismiss, { description: 'Close modal' })
 *   useHotkeys('?', () => setShowHelp(true), { description: 'Show shortcuts' })
 */

import { useEffect, useCallback, useRef } from 'react';

interface HotkeyOptions {
  /** Human-readable description for the help overlay */
  description?: string;
  /** Only fire when this element or its descendants are focused */
  scope?: string;
  /** Prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Enable in input/textarea/select (default: false) */
  enableInInput?: boolean;
  /** Disable the shortcut */
  disabled?: boolean;
}

export interface HotkeyRegistration {
  keys: string;
  description: string;
}

// Global registry for the help overlay
const globalRegistry: HotkeyRegistration[] = [];

if (typeof window !== 'undefined') {
  (window as unknown as { __metarduHotkeys?: HotkeyRegistration[] }).__metarduHotkeys = globalRegistry;
}

/**
 * Parse a key combo string into its components.
 * Examples:
 *   'ctrl+z'           → { ctrl: true, shift: false, alt: false, meta: false, key: 'z' }
 *   'ctrl+shift+n'     → { ctrl: true, shift: true, alt: false, meta: false, key: 'n' }
 *   'escape'           → { ctrl: false, shift: false, alt: false, meta: false, key: 'escape' }
 *   'alt+enter'        → { ctrl: false, shift: false, alt: true, meta: false, key: 'enter' }
 *   'mod+s'            → { ctrl/mac: true, key: 's' }
 */
function parseCombo(combo: string) {
  const parts = combo.toLowerCase().split('+').map(p => p.trim());
  const result = {
    ctrl: false,
    shift: false,
    alt: false,
    meta: false,
    key: '',
  };

  for (const part of parts) {
    switch (part) {
      case 'ctrl':
      case 'control':
        result.ctrl = true;
        break;
      case 'shift':
        result.shift = true;
        break;
      case 'alt':
      case 'option':
        result.alt = true;
        break;
      case 'meta':
      case 'cmd':
      case 'command':
        result.meta = true;
        break;
      case 'mod':
        // Mod = Ctrl on Windows/Linux, Cmd on Mac
        if (typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent)) {
          result.meta = true;
        } else {
          result.ctrl = true;
        }
        break;
      default:
        result.key = part;
    }
  }

  return result;
}

export function useHotkeys(
  combo: string,
  handler: () => void,
  options: HotkeyOptions = {},
) {
  const { preventDefault = true, enableInInput = false, disabled = false } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Register description for help overlay
  useEffect(() => {
    if (options.description && !disabled) {
      const entry = { keys: combo, description: options.description };
      globalRegistry.push(entry);
      return () => {
        const idx = globalRegistry.indexOf(entry);
        if (idx !== -1) globalRegistry.splice(idx, 1);
      };
    }
  }, [combo, options.description, disabled]);

  const callback = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return;

      const parsed = parseCombo(combo);

      // Check if we're in an input/textarea/select and shouldn't be
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
      if (isInput && !enableInInput) return;

      // Match the combo
      const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = parsed.alt ? e.altKey : !e.altKey;

      // For 'mod', we already set ctrl or meta in parseCombo
      const modCtrlMatch = parsed.ctrl ? (e.ctrlKey || e.metaKey) : true;

      const keyMatch = e.key.toLowerCase() === parsed.key ||
        e.code.toLowerCase() === `key${parsed.key}` ||
        (parsed.key === 'escape' && e.key === 'Escape') ||
        (parsed.key === 'enter' && e.key === 'Enter') ||
        (parsed.key === 'tab' && e.key === 'Tab') ||
        (parsed.key === 'delete' && (e.key === 'Delete' || e.key === 'Backspace')) ||
        (parsed.key === '?' && e.key === '?');

      if (keyMatch && modCtrlMatch && shiftMatch && altMatch) {
        if (preventDefault) e.preventDefault();
        handlerRef.current();
      }
    },
    [combo, preventDefault, enableInInput, disabled],
  );

  useEffect(() => {
    if (disabled) return;
    window.addEventListener('keydown', callback);
    return () => window.removeEventListener('keydown', callback);
  }, [callback, disabled]);
}

/**
 * Get all registered hotkeys for the help overlay.
 */
export function getRegisteredHotkeys(): HotkeyRegistration[] {
  return [...globalRegistry];
}

/**
 * Format a key combo for display (e.g., "Ctrl+Z", "⌘+Shift+N").
 */
export function formatHotkey(combo: string): string {
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  return combo
    .replace(/\bmod\b/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/\bctrl\b/gi, isMac ? '⌃' : 'Ctrl')
    .replace(/\bshift\b/gi, isMac ? '⇧' : 'Shift')
    .replace(/\balt\b/gi, isMac ? '⌥' : 'Alt')
    .replace(/\bmeta\b/gi, isMac ? '⌘' : 'Win')
    .replace(/\bcmd\b/gi, '⌘')
    .replace(/\bcommand\b/gi, '⌘')
    .replace(/\bescape\b/gi, 'Esc')
    .replace(/\benter\b/gi, '↵')
    .replace(/\bdelete\b/gi, '⌫')
    .replace(/\btab\b/gi, '⇥')
    .split('+')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(isMac ? '' : '+');
}
