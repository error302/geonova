export type TotalStationFormat = 
  'gsi' | 'jobxml' | 'topcon' | 'sokkia' | 'csv' | 'unknown'

export function detectTotalStationFormat(
  content: string, 
  filename: string
): TotalStationFormat {
  const ext = filename.toLowerCase().split('.').pop()
  const firstLine = content.trim().split('\n')[0]?.trim() || ''

  if (ext === 'gsi') return 'gsi'
  if (ext === 'job' || ext === 'jxl') return 'jobxml'
  if (ext === 'sdr') return 'sokkia'

  if (content.includes('<JOBFile') || content.includes('<PointRecord')) 
    return 'jobxml'
  if (firstLine.startsWith('*') || /^\d{2}[0-9A-F]{2}/.test(firstLine)) 
    return 'gsi'
  if (firstLine.startsWith('08')) return 'sokkia'
  if (/^\w+,[\d.]+,[\d.]+,[\d.]+/.test(firstLine)) return 'topcon'

  return 'unknown'
}
