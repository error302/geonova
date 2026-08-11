import { SurveyDataset } from '../workflows/workflowEngine'

export function detectSurveyType(
  headers: string[], 
  rows: Record<string, string>[]
): SurveyDataset['surveyType'] {
  
  const h = headers.map((h) => h.toLowerCase().trim())
  
  // Leveling detection
  if (h.includes('bs') || h.includes('fs') || h.includes('is')) {
    return 'leveling'
  }
  
  // Traverse detection  
  if (
    (h.includes('bearing') || h.includes('wcb')) && 
    (h.includes('distance') || h.includes('length'))
  ) {
    return 'traverse'
  }
  
  // Radiation detection
  if (
    h.includes('angle') && h.includes('distance') &&
    !h.includes('bearing')
  ) {
    return 'radiation'
  }
  
  // Coordinate data
  if (h.includes('easting') && h.includes('northing')) {
    return 'coordinates'
  }
  
  return 'unknown'
}
