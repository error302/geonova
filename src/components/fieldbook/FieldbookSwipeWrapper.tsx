'use client';

/**
 * FieldbookSwipeWrapper
 * ----------------------
 * Enhances the mobile field book experience with gesture-based interactions:
 *
 *   - Swipe right on a row → reveal "Duplicate" action
 *   - Swipe left on a row  → reveal "Delete" action
 *   - Long press on a row  → enter edit mode for that row
 *   - Pull down at top     → sync offline data
 *   - Shake device         → undo last entry (with confirmation)
 *
 * Uses pointer/touch events for gesture handling, and the
 * DeviceMotion API for shake detection.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from 'react';
import {
  Copy,
  Trash2,
  Pencil,
  RotateCcw,
  CloudUpload,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────

interface SwipeableRowProps {
  /** Unique row ID */
  id: string;
  /** Row content */
  children: ReactNode;
  /** Called when the duplicate action is triggered */
  onDuplicate: (id: string) => void;
  /** Called when the delete action is confirmed */
  onDelete: (id: string) => void;
  /** Called when long-press triggers edit mode */
  onEdit: (id: string) => void;
  /** Whether this row is currently in edit mode */
  isEditing?: boolean;
}

interface PullToSyncProps {
  /** Called when pull-to-sync is triggered */
  onSync: () => void;
  /** Whether currently syncing */
  syncing?: boolean;
  /** Number of unsynced items */
  unsyncedCount?: number;
  /** Scroll container children */
  children: ReactNode;
}

interface ShakeUndoProps {
  /** Called when shake-undo is confirmed */
  onUndo: () => void;
  /** Whether there's something to undo */
  canUndo: boolean;
  /** Label for what would be undone */
  undoLabel?: string;
}

interface SwipeableListProps {
  /** List of row items */
  rows: Array<{ id: string; [key: string]: string }>;
  /** Render function for each row's content */
  renderRow: (row: { id: string; [key: string]: string }, index: number, isEditing: boolean) => ReactNode;
  /** Called when duplicate is triggered */
  onDuplicate: (id: string) => void;
  /** Called when delete is confirmed */
  onDelete: (id: string) => void;
  /** Called when edit mode is triggered */
  onEdit: (id: string) => void;
  /** Currently editing row ID */
  editingId?: string | null;
  /** Sync callback */
  onSync: () => void;
  /** Whether syncing */
  syncing?: boolean;
  /** Unsycned count */
  unsyncedCount?: number;
  /** Shake undo callback */
  onUndo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Undo label */
  undoLabel?: string;
  /** Empty state content */
  emptyContent?: ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 60; // px to reveal action
const LONG_PRESS_MS = 500; // ms for long press
const SHAKE_THRESHOLD = 15; // acceleration for shake detection
const PULL_THRESHOLD = 60; // px for pull-to-sync

// ─── SwipeableRow ───────────────────────────────────────────────────────

function SwipeableRow({
  id,
  children,
  onDuplicate,
  onDelete,
  onEdit,
  isEditing = false,
}: SwipeableRowProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMoved = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
    hasMoved.current = false;

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      if (!hasMoved.current) {
        onEdit(id);
      }
    }, LONG_PRESS_MS);
  }, [id, onEdit]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;

    const diff = e.clientX - startX;

    // If moved more than 5px, cancel long press
    if (Math.abs(diff) > 5) {
      hasMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Clamp the swipe to reasonable bounds
    const clamped = Math.max(-120, Math.min(120, diff));
    setOffsetX(clamped);
  }, [isDragging, startX]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Snap to reveal or reset
    if (offsetX > SWIPE_THRESHOLD) {
      setOffsetX(100); // Reveal duplicate action
    } else if (offsetX < -SWIPE_THRESHOLD) {
      setOffsetX(-100); // Reveal delete action
    } else {
      setOffsetX(0);
    }
  }, [offsetX]);

  const handlePointerCancel = useCallback(() => {
    setIsDragging(false);
    setOffsetX(0);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Reset offset when editing
  useEffect(() => {
    if (isEditing) setOffsetX(0);
  }, [isEditing]);

  const showDuplicate = offsetX > SWIPE_THRESHOLD;
  const showDelete = offsetX < -SWIPE_THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Background action buttons */}
      <div className="absolute inset-0 flex">
        {/* Duplicate (swipe right → green on left side) */}
        <div
          className={[
            'flex items-center justify-center w-24 transition-opacity',
            showDuplicate ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
        >
          <button
            onClick={() => {
              onDuplicate(id);
              setOffsetX(0);
            }}
            className="flex flex-col items-center gap-0.5 text-emerald-400"
            aria-label="Duplicate reading"
          >
            <Copy className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Duplicate</span>
          </button>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete (swipe left → red on right side) */}
        <div
          className={[
            'flex items-center justify-center w-24 transition-opacity',
            showDelete ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}
        >
          <button
            onClick={() => {
              onDelete(id);
              setOffsetX(0);
            }}
            className="flex flex-col items-center gap-0.5 text-red-400"
            aria-label="Delete reading"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Delete</span>
          </button>
        </div>
      </div>

      {/* Foreground content */}
      <div
        ref={rowRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className={[
          'relative transition-transform',
          isDragging ? 'transition-none' : 'duration-200',
          isEditing ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-primary)]' : '',
        ].join(' ')}
        style={{
          transform: `translateX(${offsetX}px)`,
          touchAction: 'pan-y',
        }}
      >
        {children}
        {/* Edit indicator */}
        {isEditing && (
          <div className="absolute top-1 right-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent)] text-black text-[9px] font-bold uppercase">
            <Pencil className="w-2.5 h-2.5" />
            Editing
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pull-to-Sync Container ─────────────────────────────────────────────

function PullToSyncContainer({
  onSync,
  syncing = false,
  unsyncedCount = 0,
  children,
}: PullToSyncProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (!container) return;
    // Only activate when scrolled to top
    if (container.scrollTop <= 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isPulling) return;
      const diff = e.touches[0].clientY - startY;
      if (diff > 0) {
        // Only pull down, not up
        const clamped = Math.min(diff * 0.5, 80); // Dampened pull
        setPullDistance(clamped);
      }
    },
    [isPulling, startY]
  );

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && unsyncedCount > 0) {
      onSync();
    }
    setIsPulling(false);
    setPullDistance(0);
  }, [pullDistance, onSync, unsyncedCount]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={[
          'flex items-center justify-center gap-2 text-xs font-medium transition-all overflow-hidden',
          pullDistance > 10 ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
        ].join(' ')}
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <CloudUpload
          className={[
            'w-4 h-4 transition-transform',
            pullDistance >= PULL_THRESHOLD ? 'rotate-0' : 'rotate-180',
          ].join(' ')}
        />
        <span>
          {syncing
            ? 'Syncing...'
            : pullDistance >= PULL_THRESHOLD
              ? `Release to sync ${unsyncedCount} items`
              : 'Pull down to sync'}
        </span>
      </div>

      {children}
    </div>
  );
}

// ─── Shake-to-Undo ──────────────────────────────────────────────────────

function ShakeUndoOverlay({
  onUndo,
  canUndo,
  undoLabel = 'last entry',
}: ShakeUndoProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const lastShakeTime = useRef(0);

  useEffect(() => {
    if (!canUndo) return;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return;

      const magnitude = Math.sqrt(
        acc.x * acc.x + acc.y * acc.y + acc.z * acc.z
      );

      const now = Date.now();
      // Debounce: only trigger once per 2 seconds
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime.current > 2000) {
        lastShakeTime.current = now;
        setShowConfirmation(true);
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [canUndo]);

  const handleConfirm = useCallback(() => {
    onUndo();
    setShowConfirmation(false);
  }, [onUndo]);

  const handleCancel = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  if (!showConfirmation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-amber-500/15">
            <RotateCcw className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Undo?</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Remove {undoLabel}?
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 text-sm font-semibold bg-red-500/15 text-red-400 rounded-xl border border-red-500/30 hover:bg-red-500/25 transition"
          >
            Undo
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-2.5 text-sm font-semibold bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-xl border border-[var(--border-color)] hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SwipeableList (Main Export) ────────────────────────────────────────

export function SwipeableList({
  rows,
  renderRow,
  onDuplicate,
  onDelete,
  onEdit,
  editingId,
  onSync,
  syncing,
  unsyncedCount,
  onUndo,
  canUndo,
  undoLabel,
  emptyContent,
}: SwipeableListProps) {
  return (
    <>
      <PullToSyncContainer
        onSync={onSync}
        syncing={syncing}
        unsyncedCount={unsyncedCount}
      >
        {rows.length === 0 ? (
          emptyContent ?? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-[var(--text-muted)]">No readings yet</p>
            </div>
          )
        ) : (
          <div className="space-y-2.5">
            {rows.map((row, idx) => (
              <SwipeableRow
                key={row.id}
                id={row.id}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onEdit={onEdit}
                isEditing={editingId === row.id}
              >
                {renderRow(row, idx, editingId === row.id)}
              </SwipeableRow>
            ))}
          </div>
        )}
      </PullToSyncContainer>

      <ShakeUndoOverlay
        onUndo={onUndo}
        canUndo={canUndo}
        undoLabel={undoLabel}
      />
    </>
  );
}

// ─── Individual Exports ─────────────────────────────────────────────────

export { SwipeableRow, PullToSyncContainer, ShakeUndoOverlay };
