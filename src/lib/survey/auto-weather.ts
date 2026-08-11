// ──────────────────────────────────────────────────────────────────────────
// METARDU — Auto Weather Fetcher for EDM Corrections
// ──────────────────────────────────────────────────────────────────────────
// Automatically fetches temperature, pressure, and humidity for a given
// location so the surveyor doesn't have to manually enter atmospheric
// conditions. Uses free weather APIs.
//
// EDM corrections depend on atmospheric conditions:
//   - Temperature affects the speed of light in air
//   - Pressure affects air density
//   - Humidity affects the refractive index
//
// Wrong atmospheric data = wrong EDM corrections = distance errors up to
// several ppm (parts per million). Over a 500m line, 5ppm = 2.5mm error.
//
// Usage:
//   const weather = await fetchWeatherForLocation(-1.286389, 36.817223);
//   // weather.temperature = 24.5 (°C)
//   // weather.pressure = 1013.2 (hPa)
//   // weather.humidity = 65 (%)
// ──────────────────────────────────────────────────────────────────────────
import { logger } from '@/lib/logger'

export interface WeatherData {
  temperature: number;  // °C
  pressure: number;     // hPa (hectopascals / millibars)
  humidity: number;     // % relative humidity
  source: string;       // 'open-meteo' | 'default' | 'cache'
  fetchedAt: string;    // ISO timestamp
  location: { lat: number; lon: number };
}

// ─── Kenya Default Conditions ────────────────────────────────────────────
// When weather API is unavailable, use reasonable defaults for Kenya.
// These are based on typical conditions at survey sites:
//   - Nairobi: ~24°C, ~1013 hPa, ~60% humidity, elevation ~1795m
//   - Mombasa: ~28°C, ~1010 hPa, ~75% humidity
//   - Highland sites: ~18°C, ~1015 hPa, ~50% humidity

const KENYA_DEFAULTS: WeatherData = {
  temperature: 24,
  pressure: 1013.25,
  humidity: 60,
  source: 'default',
  fetchedAt: new Date().toISOString(),
  location: { lat: -1.286389, lon: 36.817223 }, // Nairobi
};

// ─── Cache ───────────────────────────────────────────────────────────────
// Cache weather data for 30 minutes to avoid hammering the API.
// Weather doesn't change fast enough to justify per-observation requests.

const weatherCache = new Map<string, { data: WeatherData; expiresAt: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCacheKey(lat: number, lon: number): string {
  // Round to ~1km grid to share cache across nearby points
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

// ─── Main Function ───────────────────────────────────────────────────────

/**
 * Fetch current weather conditions for EDM corrections.
 *
 * @param lat - Latitude (decimal degrees, WGS84)
 * @param lon - Longitude (decimal degrees, WGS84)
 * @returns WeatherData with temperature, pressure, humidity
 *
 * Uses Open-Meteo API (free, no API key required, no rate limits).
 * Falls back to Kenya defaults if API fails.
 */
export async function fetchWeatherForLocation(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  // Check cache
  const cacheKey = getCacheKey(lat, lon);
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, source: 'cache' };
  }

  try {
    // Open-Meteo API — free, no key needed
    // Docs: https://open-meteo.com/en/docs
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toFixed(4));
    url.searchParams.set('longitude', lon.toFixed(4));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,surface_pressure');
    url.searchParams.set('timezone', 'Africa/Nairobi');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!response.ok) {
      logger.warn(`[Weather] API returned ${response.status}, using defaults`);
      return { ...KENYA_DEFAULTS, location: { lat, lon } };
    }

    const json = (await response.json()) as { current?: { temperature_2m?: number; surface_pressure?: number; relative_humidity_2m?: number } };
    const current = json.current;

    if (!current) {
      return { ...KENYA_DEFAULTS, location: { lat, lon } };
    }

    const data: WeatherData = {
      temperature: current.temperature_2m ?? KENYA_DEFAULTS.temperature,
      pressure: current.surface_pressure ?? KENYA_DEFAULTS.pressure,
      humidity: current.relative_humidity_2m ?? KENYA_DEFAULTS.humidity,
      source: 'open-meteo',
      fetchedAt: new Date().toISOString(),
      location: { lat, lon },
    };

    // Cache it
    weatherCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });

    return data;
  } catch (err) {
    logger.warn('[Weather] Fetch failed, using Kenya defaults:', { error: err });
    return { ...KENYA_DEFAULTS, location: { lat, lon } };
  }
}

// ─── Elevation-Adjusted Pressure ─────────────────────────────────────────

/**
 * Compute barometric pressure at a given elevation using the
 * barometric formula. Useful when the surveyor knows the site
 * elevation but doesn't have a barometer.
 *
 * @param elevationM - Site elevation in metres above sea level
 * @param seaLevelPressure - Pressure at sea level (default 1013.25 hPa)
 * @returns Pressure in hPa at the given elevation
 */
export function pressureFromElevation(
  elevationM: number,
  seaLevelPressure: number = 1013.25,
): number {
  // Barometric formula (ISA):
  // P = P₀ × (1 - 0.0000225577 × h)^5.25588
  return seaLevelPressure * Math.pow(1 - 0.0000225577 * elevationM, 5.25588);
}

/**
 * Estimate temperature at a given elevation.
 * Standard lapse rate: 6.5°C per 1000m in the troposphere.
 *
 * @param elevationM - Site elevation in metres
 * @param seaLevelTemp - Temperature at sea level (default 30°C for Kenya)
 * @returns Estimated temperature in °C
 */
export function temperatureFromElevation(
  elevationM: number,
  seaLevelTemp: number = 30,
): number {
  return seaLevelTemp - 0.0065 * elevationM;
}

// ─── Quick Helper for Field Book ─────────────────────────────────────────

/**
 * Get weather data from the field book's location.
 * If GPS coordinates are available, fetches live weather.
 * Otherwise, returns Kenya defaults.
 *
 * This is the function the field book component should call.
 */
export async function getFieldBookWeather(
  gpsLat?: number,
  gpsLon?: number,
  elevation?: number,
): Promise<WeatherData> {
  // If GPS coordinates available, fetch live weather
  if (gpsLat !== undefined && gpsLon !== undefined) {
    return fetchWeatherForLocation(gpsLat, gpsLon);
  }

  // If elevation known, compute adjusted defaults
  if (elevation !== undefined) {
    return {
      temperature: temperatureFromElevation(elevation),
      pressure: pressureFromElevation(elevation),
      humidity: 60, // Default for Kenya highlands
      source: 'elevation-estimated',
      fetchedAt: new Date().toISOString(),
      location: { lat: 0, lon: 0 },
    };
  }

  // Fall back to Kenya defaults
  return { ...KENYA_DEFAULTS, source: 'default' };
}
