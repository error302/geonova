export const C_BLACK = '#000000'
export const C_GREEN = '#1A6B32'
export const C_RED = '#C0392B'
export const C_GRAY = '#888888'
export const C_GRID_MINOR = '#E0E4EC'
export const C_GRID_MAJOR = '#B0BDD0'
export const C_LOT_FILL = '#F5EDD6'
export const C_WARNING_BG = '#FFF9E6'

export function svgFoundMonument(cx: number, cy: number): string {
  return `<rect x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="${C_GREEN}" stroke="${C_BLACK}" stroke-width="0.5"/>`
}

export function svgSetMonument(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="${C_GREEN}" stroke-width="2"/>`
}

export function svgMasonryNail(cx: number, cy: number, calloutText?: string): string {
  const nail = [
    `<circle cx="${cx}" cy="${cy}" r="4" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.5"/>`,
    `<line x1="${cx - 3}" y1="${cy}" x2="${cx + 3}" y2="${cy}" stroke="white" stroke-width="0.8"/>`,
    `<line x1="${cx}" y1="${cy - 3}" x2="${cx}" y2="${cy + 3}" stroke="white" stroke-width="0.8"/>`,
  ].join('')
  if (!calloutText) return nail
  const leaderEndX = cx + 30
  const leaderY = cy
  const leader = `<line x1="${cx + 5}" y1="${leaderY}" x2="${leaderEndX}" y2="${leaderY}" stroke="${C_RED}" stroke-width="0.6" stroke-dasharray="2,2"/>`
  const lines = calloutText.split('\n')
  const textEls = lines.map((line, i) => {
    const yOffset = (i - (lines.length - 1) / 2) * 4
    return `<text x="${leaderEndX + 2}" y="${leaderY + yOffset}" font-family="Share Tech Mono, Courier New" font-size="4.5" fill="${C_RED}">${escapeXml(line)}</text>`
  }).join('')
  return nail + leader + textEls
}

export function svgIronPin(cx: number, cy: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="2.5" fill="${C_RED}" stroke="${C_BLACK}" stroke-width="0.4"/>`
}

export function svgCornerDot(cx: number, cy: number): string {
  return [
    `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${C_BLACK}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="4" fill="none" stroke="${C_BLACK}" stroke-width="1.5"/>`,
  ].join('')
}

export function svgNorthArrow(x: number, y: number, heightPx: number): string {
  const shaftH = heightPx * 0.7
  const arrowW = heightPx * 0.35
  const arrowH = heightPx * 0.3
  const shaft = `<rect x="${x - 1}" y="${y}" width="2" height="${shaftH}" fill="${C_BLACK}"/>`
  const northTipY = y - arrowH
  const northBaseY = y + 2
  const northArrow = `<polygon points="${x},${northTipY} ${x - arrowW / 2},${northBaseY} ${x + arrowW / 2},${northBaseY}" fill="${C_BLACK}"/>`
  const southBaseY = y + shaftH
  const southTipY = y + shaftH + arrowH
  const southArrow = `<polygon points="${x},${southTipY} ${x - arrowW / 2},${southBaseY} ${x + arrowW / 2},${southBaseY}" fill="none" stroke="${C_BLACK}" stroke-width="1.5"/>`
  const nLabel = `<text x="${x}" y="${northTipY - 6}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="11" font-weight="bold" fill="${C_BLACK}">N</text>`
  return shaft + northArrow + southArrow + nLabel
}

export function svgScaleBar(
  x: number, y: number,
  barLengthPx: number,
  segmentMetres: number,
  numSegments: number = 4
): string {
  const segmentW = barLengthPx / numSegments
  const barH = 8
  const labelGap = 6
  const segments: string[] = []
  const labels: string[] = []
  for (let i = 0; i < numSegments; i++) {
    const sx = x + i * segmentW
    if (i % 2 === 0) {
      segments.push(`<rect x="${sx}" y="${y}" width="${segmentW}" height="${barH}" fill="${C_BLACK}"/>`)
    } else {
      segments.push(`<rect x="${sx}" y="${y}" width="${segmentW}" height="${barH}" fill="white" stroke="${C_BLACK}" stroke-width="0.8"/>`)
    }
    if (i < numSegments) {
      labels.push(`<text x="${sx}" y="${y - labelGap}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">${i * segmentMetres}</text>`)
    }
  }
  labels.push(`<text x="${x + barLengthPx}" y="${y - labelGap}" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">${numSegments * segmentMetres}</text>`)
  const scaleLabel = `<text x="${x}" y="${y + barH + 8}" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">SCALE</text>`
  const metresLabel = `<text x="${x}" y="${y + barH + 14}" font-family="Share Tech Mono, Courier New" font-size="7" fill="${C_BLACK}">METRES</text>`
  return segments.join('') + labels.join('') + scaleLabel + metresLabel
}

export function svgSheetBorder(pageW: number, pageH: number, outerInset = 5, innerInset = 10): string {
  return [
    `<rect x="${outerInset}" y="${outerInset}" width="${pageW - outerInset * 2}" height="${pageH - outerInset * 2}" fill="none" stroke="${C_BLACK}" stroke-width="2.5"/>`,
    `<rect x="${innerInset}" y="${innerInset}" width="${pageW - innerInset * 2}" height="${pageH - innerInset * 2}" fill="none" stroke="${C_BLACK}" stroke-width="0.8"/>`,
  ].join('')
}

export function svgPanelDivider(x: number, pageH: number, topMargin: number, bottomMargin: number): string {
  return `<line x1="${x}" y1="${topMargin}" x2="${x}" y2="${pageH - bottomMargin}" stroke="${C_BLACK}" stroke-width="2"/>`
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function polylineFromPoints(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  close = true
): string {
  const coords: string[] = []
  for (const p of points) {
    coords.push(`${toSvgX(p.easting)},${toSvgY(p.northing)}`)
  }
  if (close && points.length > 0) {
    coords.push(`${toSvgX(points[0].easting)},${toSvgY(points[0].northing)}`)
  }
  return `<polyline points="${coords.join(' ')}" fill="none" stroke="${C_BLACK}"/>`
}

export function svgFenceLine(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  type: 'fence_on_boundary' | 'chain_link' | 'board_fence' | 'iron_fence' | 'galv_iron' | 'no_fence' | 'end_of_fence' | 'end_of_bf'
): string {
  if (points.length < 2) return ''
  const coords: string[] = points.map(p => `${toSvgX(p.easting)},${toSvgY(p.northing)}`)
  coords.push(`${toSvgX(points[0].easting)},${toSvgY(points[0].northing)}`)
  const polyline = `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666"/>`
  switch (type) {
    case 'fence_on_boundary':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="4,4"/>`
    case 'chain_link':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8"/>` +
        chainLinkTicks(points, toSvgX, toSvgY)
    case 'board_fence':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="1.5"/>`
    case 'iron_fence':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8"/>`
    case 'galv_iron':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="8,3,2,3"/>`
    case 'no_fence':
    case 'end_of_fence':
    case 'end_of_bf':
      return `<polyline points="${coords.join(' ')}" fill="none" stroke="#666666" stroke-width="0.8" stroke-dasharray="2,6"/>`
    default:
      return polyline
  }
}

function chainLinkTicks(
  points: Array<{ easting: number; northing: number }>,
  toSvgX: (m: number) => number,
  toSvgY: (m: number) => number,
  spacingM = 0.5
): string {
  let svg = ''
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length
    const dx = points[j].easting - points[i].easting
    const dy = points[j].northing - points[i].northing
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len === 0) continue
    const ux = dx / len; const uy = dy / len
    const perpX = -uy; const perpY = ux
    const ticks = Math.floor(len / spacingM)
    for (let t = 1; t < ticks; t++) {
      const frac = t / ticks
      const mx = points[i].easting + dx * frac
      const my = points[i].northing + dy * frac
      const sx = toSvgX(mx); const sy = toSvgY(my)
      const ts = 4
      svg += `<line x1="${sx - perpX * ts}" y1="${sy - perpY * ts}" x2="${sx + perpX * ts}" y2="${sy + perpY * ts}" stroke="#666666" stroke-width="0.5"/>`
    }
  }
  return svg
}

export function svgFenceCallout(
  x1: number, y1: number,
  x2: number, y2: number,
  offsetMetres: number
): string {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  const arrowLen = 6
  const a1 = angle * Math.PI / 180
  const a2 = (angle + 150) * Math.PI / 180
  const a3 = (angle - 150) * Math.PI / 180
  const ax1 = midX + arrowLen * Math.cos(a2)
  const ay1 = midY + arrowLen * Math.sin(a2)
  const ax2 = midX + arrowLen * Math.cos(a3)
  const ay2 = midY + arrowLen * Math.sin(a3)
  const ax3 = midX + arrowLen * Math.cos(a1)
  const ay3 = midY + arrowLen * Math.sin(a1)
  const label = offsetMetres.toFixed(3)
  const tw = label.length * 5.5 + 4
  const th = 10
  let rot = angle
  if (rot > 90 || rot < -90) rot += 180
  return [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000000" stroke-width="0.5"/>`,
    `<polygon points="${ax1},${ay1} ${midX},${midY} ${ax2},${ay2}" fill="#000000"/>`,
    `<polygon points="${ax3},${ay3} ${x1},${y1} ${x1 + 4 * Math.cos(a1)},${y1 + 4 * Math.sin(a1)}" fill="#000000" transform="translate(${x1 - midX},${y1 - midY})"/>`,
    `<g transform="translate(${midX},${midY}) rotate(${rot})">`,
    `<rect x="${-tw/2}" y="${-th/2}" width="${tw}" height="${th}" fill="white" stroke="none"/>`,
    `<text x="0" y="3" text-anchor="middle" font-family="Share Tech Mono, Courier New" font-size="7" fill="#000000">${label}</text>`,
    `</g>`,
  ].join('')
}

export function svgIndicatoryBeacon(cx: number, cy: number): string {
  const size = 5
  return [
    `<polygon points="${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}" fill="none" stroke="${C_GREEN}" stroke-width="1.5"/>`,
  ].join('')
}

export function svgIndicatoryBeaconCallout(
  cx: number, cy: number,
  cornerX: number, cornerY: number,
  scale: number
): string {
  const note = 'CORNER REFERENCED BY INDICATORY BEACON \u2014 CAP. 299 REG. 45'
  const tickLen = 5
  const midX = (cx + cornerX) / 2
  const midY = (cy + cornerY) / 2
  const leaderLine = `<line x1="${cornerX}" y1="${cornerY}" x2="${cx}" y2="${cy}" stroke="${C_GREEN}" stroke-width="0.5" stroke-dasharray="2,2"/>`
  const tw = note.length * 4.2 + 4
  const th = 10
  const angle = Math.atan2(cy - cornerY, cx - cornerX) * 180 / Math.PI
  let rot = angle
  if (rot > 90 || rot < -90) rot += 180
  return [
    leaderLine,
    svgIndicatoryBeacon(cx, cy),
    `<g transform="translate(${cx},${cy}) rotate(${rot})">`,
    `<rect x="${tw/2}" y="${-th/2}" width="${tw}" height="${th}" fill="white" stroke="none" opacity="0.9"/>`,
    `<text x="${tw/2 + 2}" y="3" font-family="Share Tech Mono, Courier New" font-size="3.5" fill="${C_GREEN}">${escapeXml(note)}</text>`,
    '</g>',
  ].join('')
}
