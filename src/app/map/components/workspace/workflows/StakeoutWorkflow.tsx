'use client'

import React, { memo } from 'react'
import {
  Target, Navigation, Play, StopCircle, Compass,
} from 'lucide-react'
import { useMapContext } from '@/app/map/MapReactContext'

export const StakeoutWorkflow = memo(function StakeoutWorkflow({
  onClose,
}: {
  onClose: () => void
}) {
  const {
    stakeoutActive, toggleStakeout, stakeoutTarget, stakeoutInfo,
    gpsTracking, toggleGPS, gpsPos,
  } = useMapContext()

  const info = stakeoutInfo?.()

  return (
    <div className="p-4 space-y-3 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D17B47] animate-ping" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
            GNSS STAKEOUT WORKFLOW
          </h3>
        </div>
        <span className="text-[10px] text-[#D17B47] font-mono font-bold">
          {stakeoutActive ? 'LIVE GUIDANCE ACTIVE' : 'SELECT TARGET TO STAKE'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Target Coordinates */}
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] font-mono text-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-sans block">
            Target Mark
          </span>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Target E:</span>
            <span className="font-bold text-[#D17B47]">
              {stakeoutTarget ? stakeoutTarget.e.toFixed(3) : '250150.000'} m
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Target N:</span>
            <span className="font-bold text-[#D17B47]">
              {stakeoutTarget ? stakeoutTarget.n.toFixed(3) : '9851450.000'} m
            </span>
          </div>
        </div>

        {/* Current Position */}
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] font-mono text-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-sans block">
            Rover Position
          </span>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Current E:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {gpsPos ? gpsPos.lon.toFixed(5) : '250148.820'} m
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Current N:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {gpsPos ? gpsPos.lat.toFixed(5) : '9851448.150'} m
            </span>
          </div>
        </div>

        {/* Delta Offsets & Distance */}
        <div className="p-3 rounded-xl bg-[#D17B47]/10 border border-[#D17B47]/30 font-mono text-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#D17B47] font-sans block">
            Deviation Guidance
          </span>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Distance:</span>
            <span className="text-sm font-bold text-[#D17B47]">
              {info ? info.distance.toFixed(2) : '2.14'} m
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Bearing:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {info ? info.bearing.toFixed(1) : '38.4'}°
            </span>
          </div>
        </div>
      </div>

      {/* Trigger Button */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
        <button
          onClick={toggleGPS}
          className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            gpsTracking
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>{gpsTracking ? 'GNSS RTK Connected' : 'Connect GNSS RTK'}</span>
        </button>

        <button
          onClick={toggleStakeout}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
            stakeoutActive
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-[#D17B47] text-white hover:bg-[#B35E2D]'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>{stakeoutActive ? 'STOP STAKEOUT' : 'START STAKEOUT'}</span>
        </button>
      </div>
    </div>
  )
})
