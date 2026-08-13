'use client';

import { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle, AlertTriangle } from 'lucide-react';
import {
  getObservationsOffline,
  saveObservationOffline,
  syncProject,
  isOnline,
  registerNetworkListeners,
  type OfflineObservation,
} from '@/lib/offline';
import { QuickAddModal } from './QuickAddModal';
import { logger } from '@/lib/logger'

interface FieldBookMobileProps {
  projectId: string;
  surveyType: string;
  surveyorId: string;
}

export function FieldBookMobile({ projectId }: FieldBookMobileProps) {
  const [online, setOnline] = useState(isOnline());
  const [observations, setObservations] = useState<OfflineObservation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadObservations = useCallback(async () => {
    const obs = await getObservationsOffline(projectId);
    setObservations(obs);
  }, [projectId]);

  useEffect(() => {
    loadObservations();
  }, [projectId, loadObservations]);

  useEffect(() => {
    const cleanup = registerNetworkListeners(
      () => setOnline(true),
      () => setOnline(false)
    );
    return cleanup;
  }, []);

  const handleSync = useCallback(async () => {
    if (!online || syncing) return;
    
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const result = await syncProject(projectId);
      setSyncResult({ synced: result.synced, failed: result.failed });
      setLastSync(new Date());
      await loadObservations();
    } catch (err) {
      logger.error('Sync failed:', { error: err });
    } finally {
      setSyncing(false);
    }
  }, [projectId, online, syncing, loadObservations]);

  const handleAddObservation = async (obs: Omit<OfflineObservation, 'id' | 'project_id' | 'timestamp' | 'synced'>) => {
    const newObs: OfflineObservation = {
      ...obs,
      id: crypto.randomUUID(),
      project_id: projectId,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    
    await saveObservationOffline(newObs);
    await loadObservations();
    setShowAddModal(false);
  };

  const unsyncedCount = observations.filter(o => !o.synced).length;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          {online ? (
            <>
              <Wifi className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-500">Offline</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-gray-500">
              Last sync: {lastSync.toLocaleTimeString()}
            </span>
          )}
          
          <button
            onClick={handleSync}
            disabled={!online || syncing || unsyncedCount === 0}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              online && !syncing && unsyncedCount > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            ].join(' ')}
          >
            {syncing ? (
              <>
                <CloudUpload className="w-4 h-4 animate-pulse" />
                Syncing...
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                Sync ({unsyncedCount})
              </>
            )}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={[
          'flex items-center gap-2 px-4 py-2 text-sm',
          syncResult.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700',
        ].join(' ')}>
          {syncResult.failed === 0 ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Synced {syncResult.synced} observations
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              Synced {syncResult.synced}, failed {syncResult.failed}
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {observations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-lg font-medium">No observations yet</p>
            <p className="text-sm">Tap the + button to add your first observation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {observations.map((obs, idx) => (
              <ObservationCard 
                key={obs.id} 
                observation={obs} 
                index={observations.length - idx}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 p-4 bg-white border-t">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg flex items-center justify-center gap-2 active:bg-blue-700"
        >
          <span className="text-2xl">+</span>
          Add Observation
        </button>
      </div>

      {showAddModal && (
        <QuickAddModal
          onAdd={handleAddObservation}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function ObservationCard({ observation, index }: { observation: OfflineObservation; index: number }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-bold text-lg">
          {observation.station_from} → {observation.station_to}
        </span>
        <span className="text-xs text-gray-500">#{index}</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <span className="text-gray-500">HA</span>
          <span className="font-mono ml-1">{observation.horizontal_angle.toFixed(4)}°</span>
        </div>
        <div>
          <span className="text-gray-500">VA</span>
          <span className="font-mono ml-1">{observation.vertical_angle.toFixed(4)}°</span>
        </div>
        <div>
          <span className="text-gray-500">Dist</span>
          <span className="font-mono ml-1">{observation.slope_distance.toFixed(3)}m</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-gray-400">
          {new Date(observation.timestamp).toLocaleTimeString()}
        </span>
        {observation.synced ? (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Synced
          </span>
        ) : (
          <span className="text-yellow-600">Pending sync</span>
        )}
      </div>
      
      {observation.remarks && (
        <p className="mt-2 text-sm text-gray-600 italic">{observation.remarks}</p>
      )}
    </div>
  );
}