// ──────────────────────────────────────────────────────────────────────────
// METARDU — Auto Weather Panel for EDM Corrections
// ──────────────────────────────────────────────────────────────────────────
// Auto-fetches temperature, pressure, and humidity for the survey site.
// Shows current conditions and lets the surveyor override if needed.
// ──────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useCallback } from 'react';
import { CloudSun, Thermometer, Gauge, Droplets, RefreshCw, MapPin, Loader2 } from 'lucide-react';

interface WeatherData {
  temperature: number;
  pressure: number;
  humidity: number;
  source: string;
  fetchedAt: string;
}

interface WeatherPanelProps {
  /** GPS latitude (if available from device) */
  lat?: number;
  /** GPS longitude */
  lon?: number;
  /** Site elevation in metres */
  elevation?: number;
  /** Callback when weather data is available */
  onWeatherChange?: (data: { temperature: number; pressure: number; humidity: number }) => void;
  /** Translator */
  t?: (key: string) => string;
}

export function WeatherPanel({ lat, lon, elevation, onWeatherChange, t: _t }: WeatherPanelProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTemp, setManualTemp] = useState('24');
  const [manualPressure, setManualPressure] = useState('1013');
  const [manualHumidity, setManualHumidity] = useState('60');

  const fetchWeather = useCallback(async () => {
    if (!lat || !lon) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,surface_pressure&timezone=Africa/Nairobi`);
      const json = (await res.json()) as { current?: { temperature_2m?: number; surface_pressure?: number; relative_humidity_2m?: number } };
      const current = json.current;
      if (current) {
        const data: WeatherData = {
          temperature: current.temperature_2m ?? 24,
          pressure: current.surface_pressure ?? 1013,
          humidity: current.relative_humidity_2m ?? 60,
          source: 'open-meteo',
          fetchedAt: new Date().toISOString(),
        };
        setWeather(data);
        onWeatherChange?.(data);
      }
    } catch {
      // Fallback to defaults
      const defaults = { temperature: 24, pressure: 1013, humidity: 60, source: 'fallback', fetchedAt: new Date().toISOString() };
      setWeather(defaults);
      onWeatherChange?.(defaults);
    } finally {
      setLoading(false);
    }
  }, [lat, lon, onWeatherChange]);

  // Auto-fetch on mount if GPS coordinates available
  useEffect(() => {
    if (lat !== undefined && lon !== undefined) {
      fetchWeather();
    } else {
      // Use Kenya defaults
      const defaults = {
        temperature: elevation ? 30 - 0.0065 * elevation : 24,
        pressure: elevation ? 1013.25 * Math.pow(1 - 0.0000225577 * elevation, 5.25588) : 1013.25,
        humidity: 60,
        source: elevation ? 'elevation-estimated' : 'kenya-default',
        fetchedAt: new Date().toISOString(),
      };
      setWeather(defaults);
      onWeatherChange?.(defaults);
    }
  }, [lat, lon, elevation, fetchWeather, onWeatherChange]);

  // Notify parent when manual values change
  useEffect(() => {
    if (manualMode) {
      onWeatherChange?.({
        temperature: parseFloat(manualTemp) || 24,
        pressure: parseFloat(manualPressure) || 1013,
        humidity: parseFloat(manualHumidity) || 60,
      });
    }
  }, [manualMode, manualTemp, manualPressure, manualHumidity, onWeatherChange]);

  const activeData = manualMode
    ? { temperature: parseFloat(manualTemp) || 24, pressure: parseFloat(manualPressure) || 1013, humidity: parseFloat(manualHumidity) || 60 }
    : weather || { temperature: 24, pressure: 1013, humidity: 60 };

  return (
    <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
      <button
        onClick={() => setManualMode(!manualMode)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)] text-sm font-medium hover:bg-[color-mix(in_srgb,var(--border-color)_30%,transparent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <CloudSun className="w-4 h-4 text-blue-400" />
          <span>Atmospheric Conditions</span>
          <span className="text-xs text-[var(--text-muted)] font-normal">
            ({weather?.source === 'open-meteo' ? 'Live' : weather?.source === 'elevation-estimated' ? 'Estimated' : 'Default'})
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">{manualMode ? 'Manual' : 'Auto'}</span>
      </button>

      <div className="p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3 h-3 text-orange-400" />
            <div>
              <div className="text-[var(--text-muted)]">Temp</div>
              {manualMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={manualTemp}
                  onChange={(e) => setManualTemp(e.target.value)}
                  className="input input-sm font-mono w-16 text-xs"
                  aria-label="Temperature °C"
                />
              ) : (
                <div className="font-mono font-medium">{activeData.temperature.toFixed(1)}°C</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Gauge className="w-3 h-3 text-blue-400" />
            <div>
              <div className="text-[var(--text-muted)]">Pressure</div>
              {manualMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={manualPressure}
                  onChange={(e) => setManualPressure(e.target.value)}
                  className="input input-sm font-mono w-16 text-xs"
                  aria-label="Pressure hPa"
                />
              ) : (
                <div className="font-mono font-medium">{activeData.pressure.toFixed(1)} hPa</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <div>
              <div className="text-[var(--text-muted)]">Humidity</div>
              {manualMode ? (
                <input
                  type="number"
                  step="1"
                  value={manualHumidity}
                  onChange={(e) => setManualHumidity(e.target.value)}
                  className="input input-sm font-mono w-16 text-xs"
                  aria-label="Humidity %"
                />
              ) : (
                <div className="font-mono font-medium">{activeData.humidity.toFixed(0)}%</div>
              )}
            </div>
          </div>
        </div>

        {/* GPS + Refresh */}
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          {lat !== undefined && lon !== undefined ? (
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{lat.toFixed(4)}, {lon.toFixed(4)}</span>
            </div>
          ) : (
            <span>No GPS — using {elevation ? 'elevation estimate' : 'Kenya defaults'}</span>
          )}
          {lat !== undefined && (
            <button
              onClick={fetchWeather}
              disabled={loading}
              className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
