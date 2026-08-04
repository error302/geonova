'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FieldBeacon } from '@/types/field';
import { beaconsToTraverseStations, buildTraverseURL, detectUTMZone } from '@/lib/field/pushToTraverse';
import { ArrowRight, AlertTriangle } from 'lucide-react';

interface Props {
  beacons: FieldBeacon[];
}

export default function PushToTraverse({ beacons }: Props) {
  const router = useRouter();
  const [crs, setCRS] = useState<'EPSG:21036' | 'EPSG:21037'>('EPSG:21037');
  const [error, setError] = useState<string | null>(null);

  if (beacons.length < 2) {
    return (
      <div className="p-4 text-gray-500 text-sm flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-600" />
        Collect at least 2 beacons to push to traverse.
      </div>
    );
  }

  function handlePush() {
    try {
      const stations = beaconsToTraverseStations(beacons, crs);
      const url = buildTraverseURL(stations);
      router.push(url);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="font-semibold text-sm">Push {beacons.length} beacons to Traverse</h3>
      <div>
        <label className="text-xs text-gray-400 block mb-1" htmlFor="target-coordinate-system">Target coordinate system</label>
        <select
           id="target-coordinate-system" value={crs}
          onChange={e => setCRS(e.target.value as 'EPSG:21036' | 'EPSG:21037')}
          className="bg-gray-700 text-sm px-3 py-1.5 rounded border border-gray-600 text-white w-full">
          <option value="EPSG:21037">Arc 1960 / UTM Zone 37S (East Kenya — Nairobi, Coast, Eastern)</option>
          <option value="EPSG:21036">Arc 1960 / UTM Zone 36S (West Kenya — Rift Valley, Nyanza, Western)</option>
        </select>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400 space-y-1">
        {beacons.slice(0, 5).map(b => {
          const zone = detectUTMZone(b.coordinate.lng);
          return (
            <div key={b.id} className="flex justify-between font-mono">
              <span className="text-yellow-400">{b.label}</span>
              <span>{b.coordinate.lat.toFixed(6)}, {b.coordinate.lng.toFixed(6)}</span>
              <span className="text-gray-500">→ {zone === 'EPSG:21036' ? 'Arc1960 36S' : 'Arc1960 37S'}</span>
            </div>
          );
        })}
        {beacons.length > 5 && <div className="text-gray-500">+ {beacons.length - 5} more</div>}
      </div>
      <button onClick={handlePush}
        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded-lg text-sm">
        Open in Traverse Field Book
        <ArrowRight className="w-4 h-4" />
      </button>
      <p className="text-xs text-gray-500">
        Kenya Survey Regulations 1994 Reg. 13: GPS-derived coordinates require verification against a registered control beacon before use as survey data.
      </p>
    </div>
  );
}
