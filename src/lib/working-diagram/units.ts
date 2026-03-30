export const CONVERSION = {
  perches: 5.0292,
  links: 0.201168,
  chains: 20.1168,
  feet: 0.3048,
} as const

export type LegacyUnit = keyof typeof CONVERSION

export function metersToLegacy(meters: number, unit: LegacyUnit): number {
  return parseFloat((meters / CONVERSION[unit]).toFixed(3))
}

export function legacyToMeters(value: number, unit: LegacyUnit): number {
  return parseFloat((value * CONVERSION[unit]).toFixed(4))
}

export function formatLegacy(value: number, unit: LegacyUnit): string {
  const suffixes: Record<LegacyUnit, string> = {
    perches: 'P',
    links: 'Lk',
    chains: 'Ch',
    feet: 'ft',
  }
  return `${value}${suffixes[unit]}`
}

export function dmsToDeg(dms: string): number {
  const match = dms.match(/(\d+)[°\-\s]\s*(\d+)['\-\s]\s*([\d.]+)/)
  if (!match) throw new Error(`Invalid DMS: ${dms}`)
  const [, d, m, s] = match.map(Number)
  return d + m / 60 + s / 3600
}

export function degToDMS(deg: number): string {
  const d = Math.floor(deg)
  const mTotal = (deg - d) * 60
  const m = Math.floor(mTotal)
  const s = ((mTotal - m) * 60).toFixed(2)
  return `${d}° ${String(m).padStart(2, '0')}' ${String(s).padStart(5, '0')}''`
}
