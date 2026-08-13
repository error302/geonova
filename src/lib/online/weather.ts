/**
 * Weather & EDM Corrections Service
 * Phase 7 - Online Power Features
 * Real-time atmospheric corrections for EDM measurements
 */

export interface WeatherData {
  temperature: number
  pressure: number
  humidity: number
  elevation?: number
}

export interface EDMCorrection {
  ppm: number
  description: string
}

export interface WeatherResult {
  temperature: number
  pressure: number
  humidity: number
  elevation?: number
  edmCorrection: EDMCorrection
  atmosphericCondition: 'normal' | 'humid' | 'dry'
  recommendations: string[]
}

const ATMOSPHERIC_REFRACTIVE_INDEX = 281.85
const WATER_VAPOR_CONSTANT = 0.0024

export function calculateEDMCorrection(weather: WeatherData): WeatherResult {
  const { temperature, pressure, humidity, elevation } = weather
  const tempK = temperature + 273.15
  
  const saturationVaporPressure = 6.1094 * Math.exp((17.625 * temperature) / (temperature + 243.04))
  const actualVaporPressure = (humidity / 100) * saturationVaporPressure
  
  const refractiveIndex = (ATMOSPHERIC_REFRACTIVE_INDEX / tempK) * (pressure - 0.000378 * actualVaporPressure) + (WATER_VAPOR_CONSTANT * actualVaporPressure / tempK)
  
  const ppm = (refractiveIndex - 1) * 1e6
  
  let condition: 'normal' | 'humid' | 'dry' = 'normal'
  if (humidity > 80) condition = 'humid'
  else if (humidity < 30 || temperature > 40) condition = 'dry'
  
  const recommendations: string[] = []
  
  if (Math.abs(ppm) > 50) {
    recommendations.push('Extreme atmospheric conditions - consider rescheduling measurements')
  }
  
  if (temperature > 35) {
    recommendations.push('High temperature may cause thermal refraction - use multiple observations')
  }
  
  if (humidity > 85) {
    recommendations.push('High humidity affects signal quality - verify instrument settings')
  }
  
  if (elevation !== undefined && elevation > 2000) {
    recommendations.push('High altitude - standard ppm may need adjustment')
  }
  
  if (Math.abs(ppm) > 30 && Math.abs(ppm) <= 50) {
    recommendations.push('Moderate atmospheric correction applied')
  }
  
  recommendations.push(`Apply ${ppm.toFixed(1)} ppm correction to all distances`)
  
  return {
    temperature,
    pressure,
    humidity,
    elevation,
    edmCorrection: {
      ppm: Math.round(ppm * 10) / 10,
      description: `Atmospheric correction: ${ppm.toFixed(1)} ppm`
    },
    atmosphericCondition: condition,
    recommendations
  }
}

export function getRecommendedPPM(temperature: number, pressure: number): number {
  const result = calculateEDMCorrection({ temperature, pressure, humidity: 50 })
  return result.edmCorrection.ppm
}

export interface ScaleCorrection {
  factor: number
  description: string
}

export function calculateScaleCorrection(
  elevation: number,
  latitude: number
): ScaleCorrection {
  const earthRadius = 6371000
  const scaleFactor = 1 + (elevation / earthRadius) + (Math.pow(latitude * Math.PI / 180, 2) / 2)
  
  return {
    factor: Math.round(scaleFactor * 1e8) / 1e8,
    description: `Height above sea level scale correction: ${((scaleFactor - 1) * 1e6).toFixed(2)} ppm`
  }
}

export function combinedEDMCorrection(
  measuredDistance: number,
  weather: WeatherData,
  elevation?: number,
  latitude?: number
): number {
  const weatherResult = calculateEDMCorrection(weather)
  let corrected = measuredDistance * (1 + weatherResult.edmCorrection.ppm / 1e6)
  
  if (elevation !== undefined && latitude !== undefined) {
    const scale = calculateScaleCorrection(elevation, latitude)
    corrected *= scale.factor
  }
  
  return corrected
}

export function getWeatherDescription(condition: 'normal' | 'humid' | 'dry'): string {
  switch (condition) {
    case 'humid':
      return 'High humidity conditions - expect possible signal attenuation'
    case 'dry':
      return 'Dry conditions - ensure adequate signal return'
    default:
      return 'Normal atmospheric conditions - optimal for surveying'
  }
}

export function estimateAccuracy(
  distance: number,
  weather: WeatherData,
  instrumentAccuracy: number = 3
): { estimatedError: number; confidence: string } {
  const correction = calculateEDMCorrection(weather)
  const ppmError = Math.abs(correction.edmCorrection.ppm) * distance / 1e6
  
  const totalError = Math.sqrt(Math.pow(instrumentAccuracy, 2) + Math.pow(ppmError * 1000, 2))
  
  let confidence: string
  if (totalError < 5) confidence = 'High'
  else if (totalError < 15) confidence = 'Medium'
  else confidence = 'Low'
  
  return {
    estimatedError: Math.round(totalError * 100) / 100,
    confidence
  }
}
