export type TotalStationFormat = 
  | 'gsi' | 'jobxml' | 'landxml' | 'trimble_dc' | 'carlson_rw5' | 'topcon' | 'sokkia' | 'south' | 'csv' | 'unknown'

export function detectTotalStationFormat(
  content: string, 
  filename: string
): TotalStationFormat {
  const ext = filename.toLowerCase().split('.').pop()
  const trimmed = content.trim()
  const firstLine = trimmed.split('\n')[0]?.trim() || ''

  if (ext === 'gsi') return 'gsi'
  if (ext === 'job' || ext === 'jxl') return 'jobxml'
  if (ext === 'xml') {
    if (content.includes('<LandXML') || content.includes('<CgPoint')) return 'landxml'
    if (content.includes('<JOBFile')) return 'jobxml'
  }
  if (ext === 'dc') return 'trimble_dc'
  if (ext === 'raw' || ext === 'rw5') return 'carlson_rw5'
  if (ext === 'sdr') return 'sokkia'
  if (ext === 'dat') return 'south'

  // Content-based inspection
  if (content.includes('<LandXML') || (content.includes('<CgPoint') && content.includes('<CgPoints>'))) {
    return 'landxml'
  }
  if (content.includes('<JOBFile') || content.includes('<PointRecord')) {
    return 'jobxml'
  }
  if (firstLine.startsWith('JB,') || firstLine.startsWith('SP,') || firstLine.startsWith('MO,') || firstLine.startsWith('OC,')) {
    return 'carlson_rw5'
  }
  if (/^10,\w+,[\d.]+,[\d.]+/.test(firstLine) || /^00,\w+/.test(firstLine) || /^01,\w+/.test(firstLine)) {
    return 'trimble_dc'
  }
  if (firstLine.startsWith('*') || /^\d{2}[0-9A-F]{2}/.test(firstLine)) {
    return 'gsi'
  }
  if (firstLine.startsWith('08')) return 'sokkia'

  // South detection: explicit header or SS observation row with DMS angles
  if (firstLine.toLowerCase().startsWith('south,')) return 'south'
  if (/^SS,\d+,/.test(firstLine) && /\d{2,3}\.\d{4}/.test(firstLine)) return 'south'

  if (/^\w+,[\d.]+,[\d.]+,[\d.]+/.test(firstLine)) return 'topcon'

  return 'unknown'
}

