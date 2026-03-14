'use client'
import { getUTMZoneFromLatLng } from '@/lib/engine/utmZones'

interface UTMZonePickerProps {
  value: number
  hemisphere: 'N' | 'S'
  onChange: (zone: number, hemisphere: 'N' | 'S') => void
}

export default function UTMZonePicker({ 
  value, 
  hemisphere, 
  onChange 
}: UTMZonePickerProps) {
  const commonZones = [
    { zone: 30, label: 'W.Africa/UK' },
    { zone: 32, label: 'C.Europe' },
    { zone: 33, label: 'E.Africa' },
    { zone: 36, label: 'Tanzania' },
    { zone: 37, label: 'Kenya/Uganda' },
    { zone: 43, label: 'India' },
    { zone: 54, label: 'Japan' },
    { zone: 55, label: 'Australia' },
  ]

  const detectFromGPS = () => {
    if (!navigator.geolocation) {
      alert('GPS not supported in your browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { zone, hemisphere: h } = getUTMZoneFromLatLng(
          pos.coords.latitude,
          pos.coords.longitude
        )
        onChange(zone, h)
      },
      () => {
        alert('Could not get GPS location')
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-400 mb-1">UTM Zone</label>
          <input
            type="number"
            min={1}
            max={60}
            value={value}
            onChange={e => onChange(Number(e.target.value), hemisphere)}
            className="w-20 bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 font-mono"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Hemisphere</label>
          <select
            value={hemisphere}
            onChange={e => onChange(value, e.target.value as 'N' | 'S')}
            className="bg-gray-800 text-white px-3 py-2 rounded border border-gray-700"
          >
            <option value="N">N — Northern</option>
            <option value="S">S — Southern</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm text-gray-400 mb-1">Coverage</label>
          <p className="text-amber-500 text-sm">
            Zone {value}{hemisphere} — {(value - 1) * 6 - 180}° to {value * 6 - 180}°
          </p>
        </div>
      </div>

      <div>
        <p className="text-gray-500 text-xs mb-2">Quick select:</p>
        <div className="flex flex-wrap gap-2">
          {commonZones.map(cz => (
            <button
              key={cz.zone}
              onClick={() => onChange(cz.zone, hemisphere)}
              className={`text-xs px-2 py-1 rounded border transition ${
                value === cz.zone
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-amber-500'
              }`}
            >
              {cz.zone} — {cz.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {Array.from({ length: 60 }, (_, i) => i + 1).map(zone => (
          <button
            key={zone}
            onClick={() => onChange(zone, hemisphere)}
            className={`flex-none w-6 h-8 text-xs rounded transition ${
              value === zone
                ? 'bg-amber-500 text-black font-bold'
                : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
            }`}
          >
            {zone % 10 === 0 ? zone : ''}
          </button>
        ))}
      </div>

      <button
        onClick={detectFromGPS}
        className="text-sm text-amber-500 underline"
      >
        📍 Detect from my GPS location
      </button>
    </div>
  )
}
