// Shapefile export using shp-write (npm i shp-write)
import shpwrite from 'shp-write'

import type { ReportPoint } from '@/lib/reports/surveyReport/types'
import type { BoundaryPoint } from '@/lib/reports/surveyPlan/types'
import type { Parcel } from '@/lib/reports/surveyPlan/types'

interface ShapefileExportData {
  submission_number: string
  beacons: ReportPoint[]
  boundaryLines: Array<{ from: string; to: string; bearing: number; distance: number }>
  parcels: Parcel[]
  utmZone: number
  hemisphere: 'N' | 'S'
}

export async function generateShapefileZip(
  data: ShapefileExportData
): Promise<Blob> {
  const options = {
    folder: data.submission_number,
    types: {
      point: `${data.submission_number}_Beacons`,
      polyline: `${data.submission_number}_Boundaries`,
      polygon: `${data.submission_number}_Parcels`,
    }
  }

  // Beacons as points
  const pointsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: data.beacons.map(b => ({
      type: 'Feature' as const,
      geometry: { 
        type: 'Point' as const, 
        coordinates: [b.easting, b.northing] 
      },
      properties: {
        STATION: b.name,
        CLASS: b.monumentType || 'unknown',
        EASTING: b.easting,
        NORTHING: b.northing,
        HEIGHT: b.elevation ?? null,
      }
    }))
  }

  // Boundary lines
  const linesGeoJSON = {
    type: 'FeatureCollection' as const,
    features: data.boundaryLines.map(line => {
      // Find actual coordinates
      const fromBeacon = data.beacons.find(b => b.name === line.from)
      const toBeacon = data.beacons.find(b => b.name === line.to)
      if (!fromBeacon || !toBeacon) return null as any
      
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: [
            [fromBeacon.easting, fromBeacon.northing],
            [toBeacon.easting, toBeacon.northing],
          ]
        },
        properties: {
          FROM: line.from,
          TO: line.to,
          BEARING: line.bearing.toFixed(4),
          DISTANCE: line.distance.toFixed(3),
        }
      }
    }).filter(Boolean) as any[]
  }

  // Parcels as polygons
  const polygonsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: data.parcels.map((parcel, i) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [
          parcel.boundaryPoints.map(p => [p.easting, p.northing]).concat([
            parcel.boundaryPoints[0] ? [parcel.boundaryPoints[0].easting, parcel.boundaryPoints[0].northing] : [0, 0]
          ])
        ]
      },
      properties: {
        PARCEL_ID: `Parcel_${i + 1}`,
        AREA_SQM: parcel.area_sqm?.toFixed(2) || 0,
        PERIMETER_M: parcel.perimeter_m?.toFixed(2) || 0,
      }
    }))
  }

  // Generate PRJ file content for UTM projection
  const prjContent = getUTMPrj(data.utmZone, data.hemisphere)

  // Download ZIP with all shapefile components (.shp, .shx, .dbf, .prj, etc.)
  const zipBlob = await shpwrite.download(
    { points: pointsGeoJSON, lines: linesGeoJSON, polygons: polygonsGeoJSON },
    options
  )

  return zipBlob
}

function getUTMPrj(zone: number, hemisphere: 'N' | 'S'): string {
  const northing = hemisphere === 'N' ? 0 : 10000000
  return `PROJCS["WGS 84 / UTM zone ${zone}${hemisphere}",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.01745329251994328,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${(zone * 6) - 183}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",${northing}],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],AUTHORITY["EPSG",${32600 + zone}]]`
}

