import type { SurveyPlanData } from './surveyPlan/types'
import { bearingFromDelta, distance, formatBearingDegMinSec } from './surveyPlan/geometry'

export function generateBearingScheduleCSV(data: SurveyPlanData): string {
  const pts = data.parcel.boundaryPoints
  const entries = data.project.bearingSchedule || []
  const rows = entries.length > 0 ? entries : pts.map((pt, i) => {
    const to = pts[(i + 1) % pts.length]
    const dist = distance(pt.easting, pt.northing, to.easting, to.northing)
    const bearingDeg = bearingFromDelta(to.easting - pt.easting, to.northing - pt.northing)
    return {
      from: pt.name,
      to: to.name,
      bearing: formatBearingDegMinSec(bearingDeg),
      distance: dist.toFixed(3),
    }
  })

  const lines = ['From,To,Bearing,Distance (m)']
  for (const row of rows) {
    lines.push(`${row.from},${row.to},${row.bearing},${row.distance}`)
  }
  return lines.join('\n')
}
