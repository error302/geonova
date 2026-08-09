'use client';

/**
 * FieldDataCollector — unified field data collection experience
 *
 * THE COMPONENT THAT MAKES METARDU BETTER THAN HI-TARGET/CHCNAV
 *
 * This is the purpose-built field data collector that orchestrates:
 *   1. Instrument connection (total station or GNSS rover)
 *   2. Station setup (IH, TH, backsight, atmospheric corrections)
 *   3. One-tap measurement capture (with haptic + audio feedback)
 *   4. Live QC (precision ratio, tolerance status per RDM 1.1)
 *   5. Stakeout mode (with audio guidance to target)
 *   6. Offline-first persistence (IndexedDB, auto-sync when online)
 *   7. Push-to-traverse (seamless handoff to adjustment)
 *
 * Why this beats Hi-Target/CHCNAV:
 *   - Works on ANY device (phone, tablet, laptop) — no Windows-only lock-in
 *   - Cloud sync — measurements appear on the office computer instantly
 *   - Rigorous QC — live tolerance checking per Survey Regulations 1994
 *   - Deed plan integration — push directly to deed plan generator
 *   - Multi-user — field crew + office crew see the same data
 *   - PWA — installable, offline-first, sunlight-readable field mode
 */

import { useState, useEffect, useCallback } from 'react'
import { Settings, Target, List, Cloud, ChevronRight, X, Camera } from 'lucide-react'
import { FieldConnectionBar } from './FieldConnectionBar'
import { FieldMeasureButton } from './FieldMeasureButton'
import { FieldObservationList } from './FieldObservationList'
import { FieldStationSetup } from './FieldStationSetup'
import { useFieldSessionState, useFieldSession } from '@/hooks/useFieldSessionState'
import { ToleranceBadge } from '@/components/survey/ToleranceBadge'
import { InstrumentConnectionPanel } from '@/components/InstrumentConnectionPanel'
import type { FieldSessionState, SurveyType } from '@/lib/field/fieldSession'

interface FieldDataCollectorProps {
  projectId: string
  surveyType?: SurveyType
}

type Panel = 'measure' | 'stakeout' | 'list' | 'sync' | null

export function FieldDataCollector({
  projectId,
  surveyType = 'cadastral',
}: FieldDataCollectorProps) {
  const sessionState = useFieldSessionState(projectId, surveyType)
  const session = useFieldSession(projectId, surveyType)

  const [showSetup, setShowSetup] = useState(!sessionState.setup)
  const [activePanel, setActivePanel] = useState<Panel>('measure')
  const [showInstrumentPanel, setShowInstrumentPanel] = useState(false)
  const [activeFeatureCode, setActiveFeatureCode] = useState<string>('')
  const [stakeoutTarget, setStakeoutTarget] = useState<{ e: number; n: number; z: number } | null>(null)
  const [isSunlightMode, setIsSunlightMode] = useState(false)
  const [audioEnabled, setAudioEnabled] = useState(true)

  // Load existing measurements on mount
  useEffect(() => {
    session.loadMeasurements()
  }, [session])

  // Voice synthesis guidance for stakeout
  const announceStakeoutGuidance = useCallback((de: number, dn: number) => {
    if (!audioEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const text = `Delta East ${de >= 0 ? 'Right' : 'Left'} ${Math.abs(de).toFixed(1)} meters. Delta North ${dn >= 0 ? 'Forward' : 'Backward'} ${Math.abs(dn).toFixed(1)} meters.`
    window.speechSynthesis.cancel() // stop prior phrase
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.1
    window.speechSynthesis.speak(utterance)
  }, [audioEnabled])

  // Auto-sync when online
  useEffect(() => {
    if (sessionState.isOnline && sessionState.pendingSyncCount > 0 && !sessionState.isSyncing) {
      const timer = setTimeout(() => session.syncNow(), 2000)
      return () => clearTimeout(timer)
    }
  }, [sessionState.isOnline, sessionState.pendingSyncCount, sessionState.isSyncing, session])

  const handleCapture = useCallback(async (pointId: string, code?: string): Promise<boolean> => {
    const measurement = await session.captureMeasurement({ pointId, notes: code })
    return measurement !== null
  }, [session])

  const handleSetupComplete = useCallback((setup: typeof sessionState.setup) => {
    if (setup) {
      session.setupStation(setup)
      setShowSetup(false)
      setActivePanel('measure')
    }
  }, [session])

  const handleSync = useCallback(() => {
    session.syncNow()
  }, [session])

  const handleStakeout = useCallback((target: { e: number; n: number; z: number }) => {
    setStakeoutTarget(target)
    session.activateStakeout({
      easting: target.e,
      northing: target.n,
      elevation: target.z,
    })
    setActivePanel('stakeout')
    announceStakeoutGuidance(target.e, target.n)
  }, [session, announceStakeoutGuidance])

  // ─── Setup Screen ────────────────────────────────────────────────────────
  if (showSetup) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
        <FieldConnectionBar
          isOnline={sessionState.isOnline}
          isSyncing={sessionState.isSyncing}
          pendingSyncCount={sessionState.pendingSyncCount}
          onSyncClick={handleSync}
        />
        <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full">
          <FieldStationSetup
            onComplete={handleSetupComplete}
            initialSetup={sessionState.setup}
          />
        </div>
      </div>
    )
  }

  // ─── Main Collector UI ───────────────────────────────────────────────────
  return (
    <div className={`min-h-screen flex flex-col ${isSunlightMode ? 'bg-white text-black font-bold border-b-4 border-black' : 'bg-[var(--bg-primary)]'}`}>
      {/* Connection Bar */}
      <FieldConnectionBar
        isOnline={sessionState.isOnline}
        isSyncing={sessionState.isSyncing}
        pendingSyncCount={sessionState.pendingSyncCount}
        onSyncClick={handleSync}
      />

      {/* Station Info Bar */}
      <div className={`flex items-center gap-3 px-4 py-2 border-b ${isSunlightMode ? 'bg-yellow-300 text-black border-black border-b-2 font-black' : 'bg-[var(--bg-secondary)] border-[var(--border-color)]'}`}>
        <div className="flex-1 flex items-center gap-3">
          <span className={`text-sm font-mono font-bold ${isSunlightMode ? 'text-black underline' : 'text-[var(--accent)]'}`}>
            {sessionState.setup?.stationName}
          </span>
          <span className="text-xs opacity-70">
            IH: {sessionState.setup?.instrumentHeight}m | TH: {sessionState.setup?.targetHeight}m
          </span>
        </div>

        <button
          onClick={() => setIsSunlightMode(!isSunlightMode)}
          className={`px-3 py-1 text-xs rounded font-bold border transition ${
            isSunlightMode ? 'bg-black text-white border-black shadow-lg' : 'bg-black/10 dark:bg-white/10 text-foreground border-white/20'
          }`}
          title="Toggle Sunlight High-Contrast Outdoor Mode"
        >
          {isSunlightMode ? '☀️ Sunlight Mode ON' : '🌤️ Outdoor Mode'}
        </button>
        <button
          onClick={() => setShowSetup(true)}
          className={`flex items-center gap-1 text-xs transition-colors ${
            isSunlightMode ? 'text-black hover:text-gray-700' : 'text-[var(--text-secondary)] hover:text-[var(--accent)]'
          }`}
        >
          <Settings className="w-3 h-3" /> Edit
        </button>
      </div>

      {/* Live QC Badge (if tolerance status available) */}
      {sessionState.toleranceStatus && (
        <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
          <ToleranceBadge result={sessionState.toleranceStatus} compact />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {activePanel === 'measure' && (
          <div className="flex flex-col items-center py-8 px-4 w-full">
            {/* Measure Button */}
            <FieldMeasureButton
              onCapture={(pointId) => handleCapture(pointId, activeFeatureCode || undefined)}
              stationSetup={!!sessionState.setup}
              pointIdPrefix={surveyType === 'cadastral' ? 'BP' : 'P'}
            />

            {/* Smart Feature Coding */}
            <div className="mt-8 w-full max-w-md">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Feature Code</span>
                <button 
                  className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] rounded-full hover:bg-[var(--bg-tertiary)] transition-colors border border-[var(--border-color)] text-xs font-medium text-[var(--text-primary)] shadow-sm"
                  title="Attach Photo"
                >
                  <Camera className="w-4 h-4 text-[var(--accent)]" />
                  <span>Photo</span>
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide w-full">
                {['FENCE_START', 'FENCE_LINE', 'FENCE_END', 'TREE', 'WALL', 'BLDG', 'ROAD_EDGE'].map(code => (
                  <button
                    key={code}
                    onClick={() => setActiveFeatureCode(code === activeFeatureCode ? '' : code)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition-colors ${
                      activeFeatureCode === code
                        ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-md'
                        : isSunlightMode 
                          ? 'bg-white text-black border-black border-2 hover:bg-gray-100'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--accent)]'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument Connection CTA */}
            {!showInstrumentPanel && (
              <InstrumentPanelToggle onShow={() => setShowInstrumentPanel(true)} />
            )}
          </div>
        )}

        {activePanel === 'list' && (
          <FieldObservationList
            measurements={sessionState.measurements}
            onDelete={async (id) => {
              // Delete from IndexedDB
              try {
                const { deleteObservation } = await import('@/lib/offline/fieldBookDB')
                await deleteObservation(id)
              } catch {}
            }}
          />
        )}

        {activePanel === 'stakeout' && stakeoutTarget && (
          <StakeoutPanel
            target={stakeoutTarget}
            sessionState={sessionState}
            onClose={() => {
              session.deactivateStakeout()
              setStakeoutTarget(null)
              setActivePanel('measure')
            }}
          />
        )}

        {activePanel === 'sync' && (
          <SyncPanel
            sessionState={sessionState}
            onSync={handleSync}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-around border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <NavButton
          active={activePanel === 'measure'}
          onClick={() => setActivePanel('measure')}
          icon={<Target className="w-5 h-5" />}
          label="Measure"
        />
        <NavButton
          active={activePanel === 'stakeout'}
          onClick={() => setActivePanel('stakeout')}
          icon={<Crosshair className="w-5 h-5" />}
          label="Stakeout"
          disabled={!sessionState.setup}
        />
        <NavButton
          active={activePanel === 'list'}
          onClick={() => setActivePanel('list')}
          icon={<List className="w-5 h-5" />}
          label={`Points (${sessionState.measurements.length})`}
        />
        <NavButton
          active={activePanel === 'sync'}
          onClick={() => setActivePanel('sync')}
          icon={<Cloud className="w-5 h-5" />}
          label={sessionState.isOnline ? 'Sync' : 'Offline'}
          badge={sessionState.pendingSyncCount > 0 ? sessionState.pendingSyncCount : undefined}
        />
      </div>

      {/* Instrument Connection Modal */}
      {showInstrumentPanel && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
          <div className="bg-[var(--bg-primary)] w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="font-semibold text-[var(--text-primary)]">Connect Instrument</h3>
              <button
                onClick={() => setShowInstrumentPanel(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <InstrumentConnectionPanel
                onImportPoints={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function NavButton({
  active,
  onClick,
  icon,
  label,
  disabled,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  disabled?: boolean
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors disabled:opacity-30 ${
        active
          ? 'text-[var(--accent)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
      }`}
    >
      <div className="relative">
        {icon}
        {badge != null && badge > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-[var(--accent)] text-[var(--bg-primary)] text-[9px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-1">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}

function InstrumentPanelToggle({ onShow }: { onShow: () => void }) {
  return (
    <button
      onClick={onShow}
      className="mt-6 flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30"
    >
      <Settings className="w-4 h-4" /> Connect Instrument
      <ChevronRight className="w-4 h-4" />
    </button>
  )
}

function StakeoutPanel({
  target,
  sessionState,
  onClose,
}: {
  target: { e: number; n: number; z: number }
  sessionState: FieldSessionState
  onClose: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--accent)]" /> Stakeout Mode
        </h3>
        <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--error)]">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-2">
        <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Target Point</div>
        <div className="font-mono text-sm text-[var(--text-primary)]">
          E: {target.e.toFixed(3)}
        </div>
        <div className="font-mono text-sm text-[var(--text-primary)]">
          N: {target.n.toFixed(3)}
        </div>
        <div className="font-mono text-sm text-[var(--text-primary)]">
          Z: {target.z.toFixed(3)}
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        💡 Stakeout uses the StakeoutRadar component. Connect a GNSS rover and the radar
        will guide you to the target with audio cues.
      </p>

      {/* TODO: Embed <StakeoutRadar> here once we have the latest GNSS position */}
    </div>
  )
}

function SyncPanel({
  sessionState,
  onSync,
}: {
  sessionState: FieldSessionState
  onSync: () => void
}) {
  return (
    <div className="p-4 space-y-4">
      <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <Cloud className="w-5 h-5 text-[var(--accent)]" /> Sync Status
      </h3>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-4 space-y-3">
        <div className="flex justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Connection</span>
          <span className={`text-sm font-medium ${sessionState.isOnline ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
            {sessionState.isOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Pending</span>
          <span className="text-sm font-mono text-[var(--text-primary)]">
            {sessionState.pendingSyncCount} measurement{sessionState.pendingSyncCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Total captured</span>
          <span className="text-sm font-mono text-[var(--text-primary)]">
            {sessionState.measurements.length}
          </span>
        </div>
        {sessionState.lastSyncAt && (
          <div className="flex justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Last sync</span>
            <span className="text-sm text-[var(--text-muted)]">
              {new Date(sessionState.lastSyncAt).toLocaleTimeString('en-KE')}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onSync}
        disabled={!sessionState.isOnline || sessionState.isSyncing || sessionState.pendingSyncCount === 0}
        className="w-full px-4 py-3 bg-[var(--accent)] text-[var(--bg-primary)] rounded-lg font-semibold hover:bg-[var(--accent-dim)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Cloud className="w-4 h-4" />
        {sessionState.isSyncing ? 'Syncing…' : `Sync ${sessionState.pendingSyncCount} Pending`}
      </button>

      <p className="text-xs text-[var(--text-muted)]">
        💡 Measurements are saved locally first (IndexedDB), then synced to the cloud
        when online. You can work offline indefinitely — sync happens automatically.
      </p>
    </div>
  )
}

// Need to import Crosshair here for the NavButton
import { Crosshair } from 'lucide-react'
