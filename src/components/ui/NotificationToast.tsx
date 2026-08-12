'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUIStore, type Notification } from '@/stores/uiStore';
import { X, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Icon mapping ─────────────────────────────────────────────────────────

const ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
} as const;

// ─── Color & style tokens ────────────────────────────────────────────────

const TYPE_STYLES = {
  info: {
    icon: 'text-blue-400',
    border: 'border-blue-500/25',
    accent: 'bg-blue-500/10',
    progress: 'bg-blue-400',
    title: 'text-blue-100',
    message: 'text-blue-200/70',
  },
  success: {
    icon: 'text-emerald-400',
    border: 'border-emerald-500/25',
    accent: 'bg-emerald-500/10',
    progress: 'bg-emerald-400',
    title: 'text-emerald-100',
    message: 'text-emerald-200/70',
  },
  warning: {
    icon: 'text-amber-400',
    border: 'border-amber-500/25',
    accent: 'bg-amber-500/10',
    progress: 'bg-amber-400',
    title: 'text-amber-100',
    message: 'text-amber-200/70',
  },
  error: {
    icon: 'text-red-400',
    border: 'border-red-500/25',
    accent: 'bg-red-500/10',
    progress: 'bg-red-400',
    title: 'text-red-100',
    message: 'text-red-200/70',
  },
} as const;

// ─── Constants ───────────────────────────────────────────────────────────

const MAX_VISIBLE = 5;
const ENTER_DURATION_MS = 280;
const EXIT_DURATION_MS = 200;

// ─── Single Toast ────────────────────────────────────────────────────────

function Toast({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
}) {
  const Icon = ICONS[notification.type];
  const style = TYPE_STYLES[notification.type];

  // Track enter/exit animation state
  const [phase, setPhase] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [dismissed, setDismissed] = useState(false);

  const duration = notification.duration ?? 5000;
  const hasAutoDismiss = duration > 0;

  // ── Enter animation ──────────────────────────────────────────────────
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPhase('visible');
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Exit handler ────────────────────────────────────────────────────
  const triggerExit = () => {
    if (dismissed) return;
    setDismissed(true);
    setPhase('exiting');
  };

  // ── Progress bar timer ──────────────────────────────────────────────
  useEffect(() => {
    if (!hasAutoDismiss || phase === 'exiting') return;

    const timerId = setTimeout(() => {
      triggerExit();
    }, duration);

    return () => clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, hasAutoDismiss, duration]);

  const handleClose = () => {
    triggerExit();
  };

  useEffect(() => {
    if (phase === 'exiting') {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, EXIT_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, notification.id, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        // Base
        'relative flex items-start gap-3 rounded-xl border shadow-xl backdrop-blur-md overflow-hidden',
        'w-[360px] max-w-[calc(100vw-2rem)]',
        'bg-[#14141e]/95',

        // Animations
        'transition-all',
        phase === 'entering' &&
          'opacity-0 translate-x-8 scale-95',
        phase === 'visible' &&
          'opacity-100 translate-x-0 scale-100',
        phase === 'exiting' &&
          'opacity-0 scale-95',

        // Accent left bar
        style.border,
      )}
      style={{
        transitionDuration: phase === 'entering'
          ? `${ENTER_DURATION_MS}ms`
          : `${EXIT_DURATION_MS}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Colored accent bar on the left */}
      <div
        className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl', style.accent)}
      />

      {/* Auto-dismiss progress bar */}
      {hasAutoDismiss && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
          <div
            className={cn('h-full ease-linear', style.progress)}
            style={{
              width: phase === 'entering' ? '100%' : '0%',
              transition: phase === 'visible' ? `width ${duration}ms linear` : 'none'
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3.5 pl-5 w-full">
        {/* Icon */}
        <Icon
          className={cn('w-[18px] h-[18px] flex-shrink-0 mt-0.5', style.icon)}
          strokeWidth={1.8}
        />

        {/* Title + Message */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold leading-snug', style.title)}>
            {notification.title}
          </p>
          {notification.message && (
            <p className={cn('text-xs mt-1 leading-relaxed', style.message)}>
              {notification.message}
            </p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className={cn(
            'flex-shrink-0 p-1 rounded-lg',
            'text-white/30 hover:text-white/70',
            'hover:bg-white/[0.06]',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
          )}
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ─── Notification Container ──────────────────────────────────────────────

export function NotificationToast() {
  const notifications = useUIStore((s) => s.notifications);
  const removeNotification = useUIStore((s) => s.removeNotification);

  const visible = useMemo(
    () => notifications.slice(-MAX_VISIBLE),
    [notifications],
  );

  if (visible.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 pointer-events-none"
    >
      {visible.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <Toast notification={n} onDismiss={removeNotification} />
        </div>
      ))}
    </div>
  );
}

export default NotificationToast;
