'use client';
import dynamic from 'next/dynamic';
import { useState, useRef } from 'react';
import { FieldParcel, FieldWalkPoint, MapLayer } from '@/types/field';
import { watchPosition, clearWatch, haversineDistance, computeAreaM2, computePerimeterM } from '@/lib/field/gps';
import { Play, Square, RotateCcw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { logger } from '@/lib/logger'

const MapViewer = dynamic(() => import('@/components/field/MapViewer'), { ssr: false });

const MIN_DISTANCE_M = 3.0; // ignore GPS jitter below 3m

export default function WalkPage() {
  const [walking, setWalking] = useState(false);
  const [points, setPoints] = useState<FieldWalkPoint[]>([]);
  const [parcel, setParcel] = useState<FieldParcel | null>(null);
  const watchIdRef = useRef<string | null>(null);

  async function startWalk() {
    setWalking(true);
    setPoints([]);
    let seq = 0;
    let lastPoint: FieldWalkPoint | null = null;

    const id = await watchPosition(
      (coord) => {
        if (lastPoint) {
          const dist = haversineDistance(lastPoint.coordinate, coord);
          if (dist < MIN_DISTANCE_M) return; // filter jitter
        }
        const wp: FieldWalkPoint = { coordinate: coord, sequence: seq++ };
        lastPoint = wp;
        setPoints(prev => [...prev, wp]);
      },
      (err) => { logger.error('Walk GPS error:', { error: err }); }
    );
    watchIdRef.current = id;
  }

  async function stopWalk() {
    if (watchIdRef.current) {
      await clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setWalking(false);
    // Compute area and perimeter
    setPoints(prev => {
      const coords = prev.map(p => p.coordinate);
      const areaM2 = computeAreaM2(coords);
      const perimeterM = computePerimeterM(coords);
      setParcel({
        id: `parcel_${Date.now()}`,
        label: 'Parcel 1',
        walkPoints: prev,
        computedAreaM2: areaM2,
        computedPerimeterM: perimeterM,
        closedAt: Date.now(),
      });
      return prev;
    });
  }

  function reset() {
    setPoints([]);
    setParcel(null);
    setWalking(false);
  }

  const areaHa = parcel?.computedAreaM2 ? (parcel.computedAreaM2 / 10000).toFixed(4) : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 z-10">
        <Link href="/field"><ArrowLeft className="w-5 h-5 text-gray-400 hover:text-white" /></Link>
        <span className="font-semibold text-sm flex-1">Walk Perimeter</span>
        <span className="text-xs text-gray-400">{points.length} pts</span>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapViewer layers={[] as MapLayer[]} beacons={[]} parcels={parcel ? [parcel] : []} />

        {/* Control buttons — floating */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-3 w-max">
          {!walking && !parcel && (
            <button onClick={startWalk}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-full shadow-lg transition">
              <Play className="w-5 h-5" /> Start Walk
            </button>
          )}
          {walking && (
            <button onClick={stopWalk}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-full shadow-lg animate-pulse transition">
              <Square className="w-5 h-5" /> Stop & Close
            </button>
          )}
          {parcel && (
            <button onClick={reset}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-full shadow-lg transition">
              <RotateCcw className="w-4 h-4" /> New Walk
            </button>
          )}
        </div>
      </div>

      {/* Results panel */}
      {parcel && (
        <div className="bg-gray-800 border-t border-gray-700 px-4 py-4 z-10">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400">Points</div>
              <div className="text-xl font-bold">{points.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Area</div>
              <div className="text-xl font-bold">{areaHa} ha</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Perimeter</div>
              <div className="text-xl font-bold">{parcel.computedPerimeterM?.toFixed(0)} m</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
