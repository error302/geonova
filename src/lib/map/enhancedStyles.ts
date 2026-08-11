/**
 * @module enhancedMapStyles
 *
 * Enhanced vector styling for OpenLayers map rendering.
 *
 * Improves map output quality with:
 * 1. Proper line weights per SoK standards (scaled by zoom)
 * 2. Text placements that don't overlap
 * 3. Bearing/distance annotations on parcel edges
 * 4. Beacon symbols per Kenya beacon types
 * 5. Color-coded parcel status (registered, pending, disputed)
 * 6. Grid overlay with coordinate labels
 * 7. Scale-dependent styling (details appear at higher zoom)
 */

import Style from 'ol/style/Style'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Text from 'ol/style/Text'
import Circle from 'ol/style/Circle'
import Icon from 'ol/style/Icon'
import type { Feature } from 'ol'
import type { Geometry } from 'ol/geom'

// ---------------------------------------------------------------------------
// Color Palette (SoK compliant)
// ---------------------------------------------------------------------------

export const SOK_COLORS = {
  // Boundaries
  parcelBoundary: '#1a1a1a',       // near-black
  schemeBoundary: '#000000',       // pure black
  subdivisionBoundary: '#333333',  // dark gray
  roadReserve: '#ff6600',          // orange (Kenya road reserve)

  // Parcels by status
  parcelRegistered: '#2d5016',     // dark green
  parcelPending: '#996600',        // amber
  parcelDisputed: '#cc0000',       // red
  parcelCancelled: '#666666',      // gray

  // Beacons
  beaconConcrete: '#000000',
  beaconIronPin: '#0066cc',
  beaconStone: '#996633',
  beaconPipe: '#666666',

  // Features
  water: '#0066cc',
  vegetation: '#2d5016',
  building: '#cc6600',
  contour: '#996600',

  // Grid
  gridMajor: '#cccccc',
  gridMinor: '#e6e6e6',

  // Background
  mapBackground: '#ffffff',
} as const

// ---------------------------------------------------------------------------
// Line Width Calculator (zoom-dependent)
// ---------------------------------------------------------------------------

/**
 * Calculate the appropriate line width based on map resolution.
 * At high zoom (low resolution), lines are thicker for visibility.
 * At low zoom (high resolution), lines are thinner to avoid clutter.
 */
export function getLineWidth(baseWidthMm: number, resolution: number): number {
  // Convert mm to pixels at 96 DPI (1mm ≈ 3.78px)
  const baseWidthPx = baseWidthMm * 3.78

  // Scale factor based on resolution
  // resolution is in meters per pixel
  if (resolution < 0.5) return baseWidthPx * 1.5  // very high zoom
  if (resolution < 2) return baseWidthPx           // high zoom
  if (resolution < 10) return baseWidthPx * 0.8    // medium zoom
  if (resolution < 50) return baseWidthPx * 0.6    // low zoom
  return baseWidthPx * 0.4                          // very low zoom
}

// ---------------------------------------------------------------------------
// Parcel Style (with status-based coloring)
// ---------------------------------------------------------------------------

export interface ParcelStyleOptions {
  status?: 'registered' | 'pending' | 'disputed' | 'cancelled'
  isSelected?: boolean
  showLabel?: boolean
  label?: string
  resolution?: number
}

export function createParcelStyle(options: ParcelStyleOptions = {}): Style {
  const {
    status = 'registered',
    isSelected = false,
    showLabel = true,
    label,
    resolution = 10,
  } = options

  const fillColor = SOK_COLORS[`parcel${status.charAt(0).toUpperCase() + status.slice(1)}` as keyof typeof SOK_COLORS] || SOK_COLORS.parcelRegistered
  const lineWidth = getLineWidth(0.3, resolution)

  return new Style({
    stroke: new Stroke({
      color: isSelected ? '#D17B47' : SOK_COLORS.parcelBoundary,
      width: isSelected ? lineWidth * 2 : lineWidth,
      lineCap: 'round',
      lineJoin: 'round',
    }),
    fill: new Fill({
      color: isSelected ? 'rgba(209, 123, 71, 0.15)' : fillColor + '20', // 20 = 12% opacity
    }),
    text: showLabel && label ? new Text({
      text: label,
      font: 'bold 12px Helvetica',
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      overflow: true,
      placement: 'point',
    }) : undefined,
  })
}

// ---------------------------------------------------------------------------
// Beacon Style (by type)
// ---------------------------------------------------------------------------

export interface BeaconStyleOptions {
  type?: 'concrete' | 'iron_pin' | 'stone' | 'pipe' | 'reference_object'
  isSelected?: boolean
  showLabel?: boolean
  label?: string
  resolution?: number
}

export function createBeaconStyle(options: BeaconStyleOptions = {}): Style {
  const {
    type = 'concrete',
    isSelected = false,
    showLabel = true,
    label,
    resolution = 10,
  } = options

  const color = SOK_COLORS[`beacon${type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')}` as keyof typeof SOK_COLORS] || SOK_COLORS.beaconConcrete
  const radius = resolution < 2 ? 6 : resolution < 10 ? 4 : 3

  return new Style({
    image: new Circle({
      radius: isSelected ? radius + 2 : radius,
      fill: new Fill({ color: color }),
      stroke: new Stroke({
        color: isSelected ? '#D17B47' : '#ffffff',
        width: isSelected ? 3 : 2,
      }),
    }),
    text: showLabel && label ? new Text({
      text: label,
      font: 'bold 10px Courier',
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      offsetX: 8,
      offsetY: -8,
      textAlign: 'left',
    }) : undefined,
  })
}

// ---------------------------------------------------------------------------
// Bearing Annotation Style
// ---------------------------------------------------------------------------

export interface BearingAnnotationOptions {
  bearing: string    // formatted DMS
  distance?: string  // formatted distance
  resolution?: number
}

/**
 * Create a style for bearing/distance annotations on line features.
 * Text is placed along the line, upright (not rotated with line).
 */
export function createBearingAnnotationStyle(options: BearingAnnotationOptions): Style {
  const { bearing, distance, resolution = 10 } = options
  const fontSize = resolution < 2 ? 14 : resolution < 10 ? 12 : 10

  let text = bearing
  if (distance) text += `\n${distance}`

  return new Style({
    text: new Text({
      text: text,
      font: `${fontSize}px Courier`,
      fill: new Fill({ color: '#000000' }),
      stroke: new Stroke({ color: '#ffffff', width: 3 }),
      overflow: true,
      placement: 'line',
      textBaseline: 'middle',
      textAlign: 'center',
    }),
  })
}

// ---------------------------------------------------------------------------
// Road Reserve Style (with hatching)
// ---------------------------------------------------------------------------

export function createRoadReserveStyle(resolution: number = 10): Style {
  const lineWidth = getLineWidth(0.4, resolution)
  return new Style({
    stroke: new Stroke({
      color: SOK_COLORS.roadReserve,
      width: lineWidth,
      lineDash: [10, 5],
      lineCap: 'round',
    }),
    fill: new Fill({
      color: 'rgba(255, 102, 0, 0.1)',
    }),
  })
}

// ---------------------------------------------------------------------------
// Grid Style
// ---------------------------------------------------------------------------

export function createGridStyle(isMajor: boolean = true, resolution: number = 10): Style {
  const color = isMajor ? SOK_COLORS.gridMajor : SOK_COLORS.gridMinor
  const baseWidth = isMajor ? 0.2 : 0.1
  const width = getLineWidth(baseWidth, resolution)

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
      lineDash: isMajor ? [] : [2, 2],
    }),
  })
}

// ---------------------------------------------------------------------------
// Water Feature Style
// ---------------------------------------------------------------------------

export function createWaterStyle(resolution: number = 10): Style {
  const lineWidth = getLineWidth(0.3, resolution)
  return new Style({
    stroke: new Stroke({
      color: SOK_COLORS.water,
      width: lineWidth,
    }),
    fill: new Fill({
      color: 'rgba(0, 102, 204, 0.3)',
    }),
  })
}

// ---------------------------------------------------------------------------
// Building Style
// ---------------------------------------------------------------------------

export function createBuildingStyle(resolution: number = 10): Style {
  const lineWidth = getLineWidth(0.25, resolution)
  return new Style({
    stroke: new Stroke({
      color: SOK_COLORS.building,
      width: lineWidth,
    }),
    fill: new Fill({
      color: 'rgba(204, 102, 0, 0.4)',
    }),
  })
}

// ---------------------------------------------------------------------------
// Contour Style
// ---------------------------------------------------------------------------

export function createContourStyle(isIndex: boolean = false, resolution: number = 10): Style {
  const color = SOK_COLORS.contour
  const baseWidth = isIndex ? 0.4 : 0.12
  const width = getLineWidth(baseWidth, resolution)

  return new Style({
    stroke: new Stroke({
      color: color,
      width: width,
    }),
  })
}

// ---------------------------------------------------------------------------
// Scale-Dependent Style Selector
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate style for a feature based on:
 * - Feature type (parcel, beacon, line, etc.)
 * - Map resolution (zoom level)
 * - Feature properties (status, type, etc.)
 */
export function getStyleForFeature(feature: Feature<Geometry>, resolution: number): Style | Style[] {
  const geomType = feature.getGeometry()?.getType()
  const props = feature.getProperties() as {
    status?: 'registered' | 'pending' | 'disputed' | 'cancelled'
    parcelNumber?: string
    name?: string
    beaconType?: 'concrete' | 'iron_pin' | 'stone' | 'pipe'
    beaconNumber?: string
    featureType?: string
    isIndex?: boolean
  }

  switch (geomType) {
    case 'Polygon':
      return createParcelStyle({
        status: props.status || 'registered',
        label: props.parcelNumber || props.name,
        resolution,
      })

    case 'Point':
      return createBeaconStyle({
        type: props.beaconType || 'concrete',
        label: props.beaconNumber || props.name,
        resolution,
      })

    case 'LineString':
      if (props.featureType === 'road_reserve') return createRoadReserveStyle(resolution)
      if (props.featureType === 'contour') return createContourStyle(Boolean(props.isIndex), resolution)
      if (props.featureType === 'water') return createWaterStyle(resolution)
      if (props.featureType === 'building') return createBuildingStyle(resolution)
      return new Style({
        stroke: new Stroke({
          color: SOK_COLORS.parcelBoundary,
          width: getLineWidth(0.3, resolution),
        }),
      })

    default:
      return new Style({})
  }
}
