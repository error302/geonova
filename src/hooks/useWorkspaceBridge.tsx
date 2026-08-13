'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
 useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useUIStore } from '@/stores/uiStore';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BridgeSelection {
  type: 'station' | 'traverse_leg' | 'none';
  index?: number;
  stationName?: string;
  easting?: number;
  northing?: number;
}

export interface ComputationLogEntry {
  id: string;
  timestamp: Date;
  phase: 'input' | 'compute' | 'adjustment' | 'output';
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  detail?: string;
  data?: Record<string, unknown>;
}

export interface WorkspaceBridgeContextType {
  // Selection state (data grid ↔ map)
  selection: BridgeSelection;
  setSelection: (sel: BridgeSelection) => void;
  clearSelection: () => void;

  // Computation log
  computationLogs: ComputationLogEntry[];
  addLog: (entry: Omit<ComputationLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;

  // Computation state
  isComputing: boolean;
  setIsComputing: (v: boolean) => void;

  // Misclosure / precision (shown in status bar)
  misclosureValue: string;
  setMisclosureValue: (v: string) => void;
  precisionValue: string;
  setPrecisionValue: (v: string) => void;
  areaValue: string;
  setAreaValue: (v: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Default / empty states                                             */
/* ------------------------------------------------------------------ */

const EMPTY_SELECTION: BridgeSelection = { type: 'none' };

const DEFAULT_CONTEXT: WorkspaceBridgeContextType = {
  selection: EMPTY_SELECTION,
  setSelection: () => {},
  clearSelection: () => {},
  computationLogs: [],
  addLog: () => {},
  clearLogs: () => {},
  isComputing: false,
  setIsComputing: () => {},
  misclosureValue: '—',
  setMisclosureValue: () => {},
  precisionValue: '—',
  setPrecisionValue: () => {},
  areaValue: '—',
  setAreaValue: () => {},
};

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const WorkspaceBridgeContext =
  createContext<WorkspaceBridgeContextType>(DEFAULT_CONTEXT);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function WorkspaceBridgeProvider({ children }: { children: ReactNode }) {
  /* -- Selection -- */
  const [selection, setSelectionState] = useState<BridgeSelection>(EMPTY_SELECTION);

  const uiClearSelection = useUIStore(s => s.clearSelection);
  const uiSetSelectedPointIds = useUIStore(s => s.setSelectedPointIds);

  const setSelection = useCallback((sel: BridgeSelection) => {
    setSelectionState(sel);
    // Sync to uiStore so map and other components pick it up
    if (sel.type === 'station' && sel.stationName) {
      uiSetSelectedPointIds([sel.stationName]);
    } else if (sel.type === 'none') {
      uiClearSelection();
    }
  }, [uiSetSelectedPointIds, uiClearSelection]);

  const clearSelection = useCallback(() => {
    setSelectionState(EMPTY_SELECTION);
    uiClearSelection();
  }, [uiClearSelection]);

  /* -- Computation logs -- */
  const [computationLogs, setComputationLogs] = useState<ComputationLogEntry[]>(
    [],
  );

  const addLog = useCallback(
    (entry: Omit<ComputationLogEntry, 'id' | 'timestamp'>) => {
      const id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `log-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      setComputationLogs((prev: ComputationLogEntry[]) => [
        ...prev,
        {
          ...entry,
          id,
          timestamp: new Date(),
        },
      ]);
    },
    [],
  );

  const clearLogs = useCallback(() => {
    setComputationLogs([]);
  }, []);

  /* -- Computation running state -- */
  const [isComputing, setIsComputing] = useState(false);

  /* -- Status bar values -- */
  const [misclosureValue, setMisclosureValue] = useState('—');
  const [precisionValue, setPrecisionValue] = useState('—');
  const [areaValue, setAreaValue] = useState('—');

  // Sync uiStore global loading with isComputing
  const setGlobalLoading = useUIStore(s => s.setGlobalLoading);
  useEffect(() => {
    if (isComputing) {
      setGlobalLoading(true, 'Computing…');
    } else {
      setGlobalLoading(false);
    }
  }, [isComputing, setGlobalLoading]);

  // Expose a ref for accessing the bridge from non-React code (e.g. worker callbacks)
  const bridgeRef = useRef<WorkspaceBridgeContextType | null>(null);
  bridgeRef.current = {
    selection,
    setSelection,
    clearSelection,
    computationLogs,
    addLog,
    clearLogs,
    isComputing,
    setIsComputing,
    misclosureValue,
    setMisclosureValue,
    precisionValue,
    setPrecisionValue,
    areaValue,
    setAreaValue,
  };

  const value: WorkspaceBridgeContextType = bridgeRef.current;

  return (
    <WorkspaceBridgeContext.Provider value={value}>
      {children}
    </WorkspaceBridgeContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useWorkspaceBridge(): WorkspaceBridgeContextType {
  const ctx = useContext(WorkspaceBridgeContext);

  // Guard against missing provider – helpful during development
  if (ctx === DEFAULT_CONTEXT) {
    // We intentionally return the default context rather than throwing
    // so the hook is safe to use even without a provider (e.g. in tests
    // or standalone component previews).
  }

  return ctx;
}

export default useWorkspaceBridge;
