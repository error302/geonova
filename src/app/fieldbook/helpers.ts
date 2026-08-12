import { normalizeBearing, parseDMSString } from '@/lib/engine/angles'

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function asNumber(value: string): number | null {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

export function asBearing(bearingText: string): number | null {
  const parsed = parseDMSString(bearingText)
  if (parsed === null) {
    const raw = asNumber(bearingText)
    return raw === null ? null : normalizeBearing(raw)
  }
  return normalizeBearing(parsed)
}
