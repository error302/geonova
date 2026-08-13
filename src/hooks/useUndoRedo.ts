'use client';

/**
 * useUndoRedo — Command-pattern undo/redo for fieldbook edits.
 * ──────────────────────────────────────────────────────────────
 * Provides an undo/redo stack for any state that needs reversible
 * mutations. Used by the fieldbook page to let surveyors recover
 * from accidental edits, row deletions, and data clears.
 *
 * Each command has:
 *   - execute() — apply the change
 *   - undo()    — reverse the change
 *   - label     — human-readable description for the undo toast
 *
 * Usage:
 *   const { execute, undo, redo, canUndo, canRedo } = useUndoRedo()
 *   execute({
 *     execute: () => setRows(prev => [...prev, newRow]),
 *     undo:    () => setRows(prev => prev.filter(r => r.id !== newRow.id)),
 *     label:   'Add observation P3',
 *   })
 */

import { useState, useCallback } from 'react';
import { useHotkeys } from '@/hooks/useHotkeys';

export interface Command {
  execute: () => void;
  undo: () => void;
  label: string;
}

interface UndoRedoState {
  past: Command[];
  future: Command[];
}

const MAX_HISTORY = 100;

export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>({ past: [], future: [] });

  const execute = useCallback(
    (command: Command) => {
      command.execute();
      setState((prev) => ({
        past: [...prev.past.slice(-MAX_HISTORY + 1), command],
        future: [], // Clear redo stack on new action
      }));
    },
    [],
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const command = prev.past[prev.past.length - 1];
      command.undo();
      return {
        past: prev.past.slice(0, -1),
        future: [command, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const command = prev.future[0];
      command.execute();
      return {
        past: [...prev.past, command],
        future: prev.future.slice(1),
      };
    });
  }, []);

  const clear = useCallback(() => {
    setState({ past: [], future: [] });
  }, []);

  // Register global keyboard shortcuts
  useHotkeys('ctrl+z', undo, {
    description: 'Undo last action',
    enableInInput: false,
  });
  useHotkeys('ctrl+shift+z', redo, {
    description: 'Redo',
    enableInInput: false,
  });
  useHotkeys('ctrl+y', redo, {
    description: 'Redo (alternative)',
    enableInInput: false,
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const undoLabel = canUndo ? state.past[state.past.length - 1].label : null;
  const redoLabel = canRedo ? state.future[0].label : null;

  return {
    execute,
    undo,
    redo,
    clear,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
    historySize: state.past.length,
  };
}
