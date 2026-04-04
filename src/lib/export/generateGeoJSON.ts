import { utmToGeographic } from '@/lib/engine/coordinates'

export interface SurveyPoint {
  id?: string
  name: string
  easting: number
  northing: number
  elevation?: number | null
  is_control?: boolean
  control_order?: string
}

/**
 * Generate a GeoJSON FeatureCollection.
 * Coordinates are converted to WGS84 lat/lon as required by the GeoJSON spec (RFC 7946).
 * UTM coordinates are retained as properties for reference.
 */
export function generateGeoJSON(
  points: SurveyPoint[],
  projectName: string,
  utmZone: number = 37,
  hemisphere: 'N' | 'S' = 'S'
): string {
  const features = points.map((p: any) => {
    const { lat, lon } = utmToGeographic(p.easting, p.northing, utmZone, hemisphere)
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        // GeoJSON uses [longitude, latitude, elevation]
        coordinates: [
          parseFloat(lon.toFixed(8)),
          parseFloat(lat.toFixed(8)),
          p.elevation ?? 0,
        ],
      },
      properties: {
        name: p.name,
        elevation_m: p.elevation ?? 0,
        easting_utm: p.easting,
        northing_utm: p.northing,
        utm_zone: `${utmZone}${hemisphere}`,
        is_control: p.is_control || false,
        control_order: p.control_order || null,
        point_type: p.is_control ? 'control' : 'survey',
      },
    }
  })

  return JSON.stringify({
    type: 'FeatureCollection',
    name: projectName,
    // WGS84 is the default/required CRS for GeoJSON per RFC 7946
    features,
  }, null, 2)
}

export function downloadGeoJSON(
  points: SurveyPoint[],
  projectName: string,
  utmZone?: number,
  hemisphere?: 'N' | 'S'
): void {
  const content = generateGeoJSON(points, projectName, utmZone ?? 37, hemisphere ?? 'S')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'application/geo+json' }))
  a.download = `${projectName.replace(/\s+/g, '_')}_WGS84.geojson`
  a.click()
}
