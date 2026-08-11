'use client';

import {
  AlertCircle,
  X,
  CheckCircle2,
  Building2,
  Trees,
  Mountain,
  Users,
  Waves,
  Factory,
  Gem,
  type LucideIcon,
} from 'lucide-react';

// ────────────────────────────────────────────────────────────────
// Category icon helper (uses JSX → must live in a .tsx file)
// ────────────────────────────────────────────────────────────────

export function getCategoryIcon(category: string) {
  const icons: Record<string, LucideIcon> = {
    urban: Building2,
    agricultural: Trees,
    pastoral: Mountain,
    institutional: Users,
    coastal: Waves,
    special: Factory,
  };
  const Icon = icons[category] || Gem;
  return <Icon className="w-4 h-4" />;
}

// ────────────────────────────────────────────────────────────────
// Toast helper (inline, no external deps)
// ────────────────────────────────────────────────────────────────

export function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error' | 'info';
  onDismiss: () => void;
}) {
  const colors = {
    success: 'border-green-500/40 bg-green-500/10 text-green-300',
    error: 'border-red-500/40 bg-red-500/10 text-red-300',
    info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  };
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 shrink-0" />,
    info: <AlertCircle className="w-4 h-4 shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${colors[type]}`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Empty state component
// ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="p-4 rounded-2xl bg-[var(--accent-subtle)] mb-4 text-[var(--accent)]">
        {icon}
      </div>
      <h3 className="text-base font-medium text-[var(--text-primary)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">{description}</p>
      {action}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Confirmation modal
// ────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={onCancel}
            className="btn btn-secondary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn text-white ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700 border-red-600'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-dim)] border-[var(--accent)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
