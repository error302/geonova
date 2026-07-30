// ──────────────────────────────────────────────────────────────────────────
// METARDU — Sync Status Indicator Component
// ──────────────────────────────────────────────────────────────────────────
// Shows current sync status in the UI. Can be placed in the navbar/sidebar.
// Displays: online/offline, pending count, sync button, storage usage.
// ──────────────────────────────────────────────────────────────────────────

'use client';

import { useState } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Cloud, CloudOff, Loader2, RefreshCw, HardDrive, AlertCircle, Check } from 'lucide-react';

interface SyncStatusIndicatorProps {
  /** Show detailed info (pending count, storage) */
  showDetails?: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SyncStatusIndicator({
  showDetails = false,
  compact = false,
  className = '',
}: SyncStatusIndicatorProps) {
  const {
    isOnline,
    pendingCount,
    status,
    lastError,
    lastSyncAt,
    storageEstimate,
    syncNow,
  } = useOfflineSync();

  const [syncing, setSyncing] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleSync = async () => {
    if (syncing || !isOnline) return;
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = () => {
    if (syncing || status === 'syncing') {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (!isOnline) {
      return <CloudOff className="h-4 w-4 text-orange-500" />;
    }
    if (status === 'error' || lastError) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (pendingCount > 0) {
      return <Cloud className="h-4 w-4 text-yellow-500" />;
    }
    return <Check className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (syncing || status === 'syncing') return 'Syncing…';
    if (!isOnline) return 'Offline';
    if (status === 'error') return 'Sync error';
    if (pendingCount > 0) return `${pendingCount} pending`;
    return 'All synced';
  };

  const formatLastSync = () => {
    if (!lastSyncAt) return 'Never';
    const diff = Date.now() - lastSyncAt;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(lastSyncAt).toLocaleDateString();
  };

  // Compact: just an icon
  if (compact) {
    return (
      <button
        onClick={handleSync}
        disabled={syncing || !isOnline}
        className={`relative inline-flex items-center justify-center p-2 rounded-md hover:bg-accent transition-colors ${className}`}
        title={getStatusText()}
      >
        {getStatusIcon()}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </button>
    );
  }

  // Full indicator
  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {getStatusIcon()}
      <span className="font-medium">{getStatusText()}</span>

      {/* Sync button */}
      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSync}
          disabled={syncing}
          className="ml-1 rounded p-1 hover:bg-accent transition-colors"
          title="Sync now"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
        </button>
      )}

      {/* Details tooltip/popover */}
      {showDetails && showTooltip && (
        <div className="absolute top-full left-0 mt-2 w-64 rounded-lg border bg-popover p-3 shadow-lg z-50">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{getStatusText()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last sync</span>
              <span>{formatLastSync()}</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pending</span>
                <span className="text-yellow-600">{pendingCount} items</span>
              </div>
            )}
            {storageEstimate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  <HardDrive className="inline h-3 w-3 mr-1" />
                  Storage
                </span>
                <span>{storageEstimate.usageMB} MB / {storageEstimate.quotaMB} MB</span>
              </div>
            )}
            {lastError && (
              <div className="mt-2 rounded bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                {lastError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
