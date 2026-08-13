'use client';

import { useEffect, useState } from 'react';
import { Wifi, CloudOff, Cloud } from 'lucide-react';

/**
 * Connectivity State Indicator
 * Surveyors need to know whether data is saved locally vs. synced to server.
 * Critical for field use where connectivity is intermittent.
 */
export function ConnectivityIndicator() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingOps, setPendingOps] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check pending sync operations periodically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPending = async () => {
      try {
        const { getPendingOperations } = await import('@/lib/offline/syncQueue');
        const ops = await getPendingOperations();
        setPendingOps(ops.length);
      } catch {
        // Offline module not available — ignore
      }
    };

    checkPending();
    const interval = setInterval(checkPending, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline && pendingOps === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-green-600">
        <Cloud className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">All data synced</span>
      </div>
    );
  }

  if (isOnline && pendingOps > 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-yellow-600">
        <Wifi className="h-3.5 w-3.5 animate-pulse" />
        <span className="hidden sm:inline">Syncing {pendingOps} item{pendingOps !== 1 ? 's' : ''}...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-orange-600">
      <CloudOff className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Offline — data saved locally</span>
    </div>
  );
}
