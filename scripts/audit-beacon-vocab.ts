/** Audit beacon symbol SVG vocabulary for the sanitizer whitelist. */
import { getBeaconSymbolSVG, BEACON_DEFINITIONS } from '../src/lib/compute/beaconSymbols'

const tags = new Set<string>()
const attrs = new Set<string>()

for (const t of Object.keys(BEACON_DEFINITIONS)) {
  const svg = getBeaconSymbolSVG(t as any, 'FOUND', 12)
  for (const m of svg.matchAll(/<([a-zA-Z][\w:-]*)/g)) tags.add(m[1])
  for (const m of svg.matchAll(/([\w:-]+)\s*=/g)) attrs.add(m[1])
}

console.log('BEACON TAGS:', JSON.stringify([...tags].sort()))
console.log('BEACON ATTRS:', JSON.stringify([...attrs].sort()))
