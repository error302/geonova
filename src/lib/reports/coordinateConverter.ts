export interface ConvertedCoordinate {
  id?: string
  easting: number
  northing: number
  datum: string
  epsg: number
}

export interface ConversionResult {
  success: boolean
  coordinates: ConvertedCoordinate[]
  error?: string
}

export async function convertToArc1960(
  coordinates: Array<{ id?: string; easting: number; northing: number }>
): Promise<ConversionResult> {
  try {
    const response = await fetch('/api/convert-datum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coords: coordinates,
        fromDatum: 'WGS84',
        toDatum: 'ARC1960'
      })
    })
    const data = await response.json()
    if (response.ok && data.data) {
      const coords = data.data.map((c: any) => ({
        id: c.id,
        easting: c.easting,
        northing: c.northing,
        datum: c.datum || 'ARC1960',
        epsg: 21037
      }))
      return { success: true, coordinates: coords }
    }
    return { success: false, coordinates: [], error: data.error || 'Conversion failed' }
  } catch (err) {
    return { success: false, coordinates: [], error: 'Network error' }
  }
}

export async function convertFromArc1960(
  coordinates: Array<{ id?: string; easting: number; northing: number }>
): Promise<ConversionResult> {
  try {
    const response = await fetch('/api/convert-datum', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        coords: coordinates,
        fromDatum: 'ARC1960',
        toDatum: 'WGS84'
      })
    })
    const data = await response.json()
    if (response.ok && data.data) {
      const coords = data.data.map((c: any) => ({
        id: c.id,
        easting: c.easting,
        northing: c.northing,
        datum: c.datum || 'WGS84',
        epsg: 32637
      }))
      return { success: true, coordinates: coords }
    }
    return { success: false, coordinates: [], error: data.error || 'Conversion failed' }
  } catch (err) {
    return { success: false, coordinates: [], error: 'Network error' }
  }
}

export function isArc1960Easting(easting: number): boolean {
  return easting >= 166000 && easting <= 850000
}

export function isArc1960Northing(northing: number): boolean {
  return northing >= 9500000 || (northing >= 0 && northing < 500000)
}

export function isWgs84UtmEasting(easting: number): boolean {
  return easting >= 166000 && easting <= 850000
}

export function isWgs84UtmNorthing(northing: number): boolean {
  return (northing >= 0 && northing < 1100000) || (northing > 10000000)
}
