'use client';

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { GNSSConnectionPanel } from '@/components/gnss/GNSSConnectionPanel';
import { CoordinateDisplay } from '@/components/gnss/CoordinateDisplay';
import { type NMEAPosition } from '@/lib/gnss';

export default function GNSSPage() {
  const [position, setPosition] = useState<NMEAPosition | null>(null);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="bg-[#1B3A5C] text-white px-4 py-3 flex items-center gap-3">
        <Link href="/field" className="p-2 -ml-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold">GNSS Receiver</h1>
      </div>

      <div className="p-4 space-y-4">
        <GNSSConnectionPanel
          onPosition={setPosition}
          onConnect={() => {}}
          onDisconnect={() => setPosition(null)}
        />

        {position && (
          <CoordinateDisplay
            position={position}
            showKenya={true}
            onCopy={() => {}}
          />
        )}

        <div className="p-4 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] rounded-lg">
          <h3 className="font-medium text-[var(--accent)] mb-2">Instructions</h3>
          <ol className="text-sm text-[var(--text-secondary)] space-y-1 list-decimal list-inside">
            <li>Enable Bluetooth on your device</li>
            <li>Turn on your GNSS receiver</li>
            <li>Tap &quot;Scan for GNSS&quot; to find devices</li>
            <li>Select your receiver and tap &quot;Connect&quot;</li>
            <li>Coordinates will stream automatically</li>
          </ol>
        </div>

        <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg">
          <h3 className="font-medium text-[var(--text-primary)] mb-2">Supported Receivers</h3>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            <li>• Trimble R Series (R2, R4, R6, R8, R10)</li>
            <li>• Leica GS Series (GS14, GS16, GS18)</li>
            <li>• Topcon HiPer Series</li>
            <li>• South S Series</li>
            <li>• Generic NMEA 0183 receivers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
