// GeoNova Engine - Coordinate conversions
// Based on N.N. Basak Surveying and Levelling

import { LatLon, UTMCoord, DMS } from './types';
import { decimalToDMS } from './angles';

// WGS84 ellipsoid
const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;

export function geographicToUTM(lat: number, lon: number, zone?: number): UTMCoord {
  const latRad = lat * Math.PI / 180;
  const lonRad = lon * Math.PI / 180;
  
  // Calculate zone if not provided
  const calculatedZone = zone || Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = (calculatedZone - 1) * 6 - 180 + 3;
  const lonOriginRad = lonOrigin * Math.PI / 180;
  
  const k0 = 0.9996;
  
  // Arc length
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = (WGS84_E2 / (1 - WGS84_E2)) * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);
  
  const M = WGS84_A * ((1 - WGS84_E2 / 4 - 3 * WGS84_E2 * WGS84_E2 / 64) * latRad 
               - (3 * WGS84_E2 / 8 + 3 * WGS84_E2 * WGS84_E2 / 32) * Math.sin(2 * latRad)
               + (15 * WGS84_E2 * WGS84_E2 / 256) * Math.sin(4 * latRad));
  
  let easting = k0 * N * (A + (1 - T + C) * A * A * A / 6
               + (5 - 18 * T + T * T) * A * A * A * A * A / 120) + 500000;
  
  let northing = k0 * (M + N * Math.tan(latRad) * (A * A / 2
               + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
               + (61 - 58 * T + T * T + 600 * C - 330 * C * C / (1 - WGS84_E2)) * A * A * A * A * A * A / 720));
  
  // Southern hemisphere
  const hemisphere: 'N' | 'S' = lat >= 0 ? 'N' : 'S';
  if (lat < 0) {
    northing += 10000000;
  }
  
  return {
    easting: Math.round(easting * 1000) / 1000,
    northing: Math.round(northing * 1000) / 1000,
    zone: calculatedZone,
    hemisphere
  };
}

export function utmToGeographic(easting: number, northing: number, zone: number, hemisphere: 'N' | 'S'): LatLon {
  const k0 = 0.9996;
  const e1 = (1 - Math.sqrt(1 - WGS84_E2)) / (1 + Math.sqrt(1 - WGS84_E2));
  
  let y = northing;
  if (hemisphere === 'S') {
    y -= 10000000;
  }
  
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const lonOriginRad = lonOrigin * Math.PI / 180;
  
  const M = y / k0;
  const mu = M / (WGS84_A * (1 - WGS84_E2 / 4 - 3 * WGS84_E2 * WGS84_E2 / 64));
  
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu)
             + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu)
             + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu);
  
  const N1 = WGS84_A / Math.sqrt(1 - WGS84_E2 * Math.sin(phi1) * Math.sin(phi1));
  const T1 = Math.tan(phi1) * Math.tan(phi1);
  const C1 = (WGS84_E2 / (1 - WGS84_E2)) * Math.cos(phi1) * Math.cos(phi1);
  const R1 = WGS84_A * (1 - WGS84_E2) / Math.pow(1 - WGS84_E2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const D = (easting - 500000) / (N1 * k0);
  
  let lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D * D / 2
             - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * WGS84_E2 / (1 - WGS84_E2)) * D * D * D * D / 24
             + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * WGS84_E2 / (1 - WGS84_E2) - 3 * C1 * C1) * D * D * D * D * D * D / 720);
  
  let lon = (lonOriginRad) + (D - (1 + 2 * T1 + C1) * D * D * D / 6
             + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * WGS84_E2 / (1 - WGS84_E2) + 24 * T1 * T1) * D * D * D * D * D / 120) / Math.cos(phi1);
  
  return {
    lat: Math.round(lat * 180 / Math.PI * 10000000) / 10000000,
    lon: Math.round(lon * 180 / Math.PI * 10000000) / 10000000
  };
}

export function latLonToString(lat: number, lon: number): string {
  const latDMS = decimalToDMS(lat, true);
  const lonDMS = decimalToDMS(lon, false);
  return `${latDMS.degrees}° ${latDMS.minutes}' ${latDMS.seconds.toFixed(3)}" ${latDMS.direction}, ${lonDMS.degrees}° ${lonDMS.minutes}' ${lonDMS.seconds.toFixed(3)}" ${lonDMS.direction}`;
}
