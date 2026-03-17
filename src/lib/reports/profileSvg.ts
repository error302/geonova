export type LongitudinalProfilePoint = {
  chainage: number
  elevation: number
  label?: string
}

export type PageSize = 'A3' | 'A4'
export type PageOrientation = 'landscape' | 'portrait'

export type LongitudinalProfileSvgOptions = {
  page?: PageSize
  orientation?: PageOrientation
  horizontalScaleDenom?: number
  verticalScaleDenom?: number
  title?: string
  subtitle?: string
  units?: { chainage?: string; elevation?: string }
}

const PAGE_MM: Record<PageSize, { w: number; h: number }> = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function clampFinite(n: number, fallback: number) {
  return Number.isFinite(n) ? n : fallback
}

function niceStep(rawStep: number) {
  const step = Math.abs(rawStep)
  if (!Number.isFinite(step) || step <= 0) return 1

  const exponent = Math.floor(Math.log10(step))
  const fraction = step / Math.pow(10, exponent)
  let niceFraction = 1
  if (fraction <= 1) niceFraction = 1
  else if (fraction <= 2) niceFraction = 2
  else if (fraction <= 5) niceFraction = 5
  else niceFraction = 10
  return niceFraction * Math.pow(10, exponent)
}

function fitScaleDenom(groundSpanM: number, availableMm: number, allowed: number[], requested?: number) {
  const sorted = [...allowed].sort((a, b) => a - b)
  const startIdx = requested ? Math.max(0, sorted.findIndex((x) => x >= requested)) : 0

  for (let i = startIdx; i < sorted.length; i++) {
    const denom = sorted[i]
    const mmPerM = 1000 / denom
    const needed = groundSpanM * mmPerM
    if (needed <= availableMm) return denom
  }
  return sorted[sorted.length - 1]
}

function fmtScale(denom: number) {
  return `1:${Math.round(denom).toLocaleString('en-US')}`
}

function formatChainageKmPlus(m: number) {
  const km = Math.floor(m / 1000)
  const rem = m - km * 1000
  const mText = rem.toFixed(3).padStart(7, '0')
  return `${km}+${mText}`
}

export function generateLongitudinalProfileSvg(points: LongitudinalProfilePoint[], opts: LongitudinalProfileSvgOptions = {}) {
  const clean = points
    .map((p) => ({ chainage: Number(p.chainage), elevation: Number(p.elevation), label: p.label }))
    .filter((p) => Number.isFinite(p.chainage) && Number.isFinite(p.elevation))
    .sort((a, b) => a.chainage - b.chainage)

  if (clean.length < 2) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="100mm" viewBox="0 0 210 100">\n<rect x=\"0\" y=\"0\" width=\"210\" height=\"100\" fill=\"#ffffff\"/>\n<text x=\"10\" y=\"50\" font-family=\"Arial\" font-size=\"12\" fill=\"#111\">Not enough points to generate profile.</text>\n</svg>\n`
  }

  const page = opts.page ?? 'A3'
  const orientation = opts.orientation ?? 'landscape'
  const base = PAGE_MM[page]
  const pageW = orientation === 'landscape' ? base.w : base.h
  const pageH = orientation === 'landscape' ? base.h : base.w

  const title = opts.title ?? 'LONGITUDINAL PROFILE'
  const subtitle = opts.subtitle ?? ''
  const u = { chainage: opts.units?.chainage ?? 'm', elevation: opts.units?.elevation ?? 'm' }

  const minCh = clean[0].chainage
  const maxCh = clean[clean.length - 1].chainage
  const minEl = Math.min(...clean.map((p) => p.elevation))
  const maxEl = Math.max(...clean.map((p) => p.elevation))

  const spanCh = Math.max(1e-9, maxCh - minCh)
  const spanEl = Math.max(1e-9, maxEl - minEl)

  const border = 10
  const footerH = 34
  const leftAxisW = 26
  const topPad = 10
  const rightPad = 10
  const bottomPad = 10

  const plotX0 = border + leftAxisW
  const plotY0 = border + topPad
  const plotX1 = pageW - border - rightPad
  const plotY1 = pageH - border - footerH - bottomPad
  const plotW = Math.max(10, plotX1 - plotX0)
  const plotH = Math.max(10, plotY1 - plotY0)

  const allowedH = [200, 250, 500, 1000, 2000, 2500, 5000, 10000]
  const allowedV = [10, 20, 50, 100, 200, 250, 500, 1000]

  const hDenom = fitScaleDenom(spanCh, plotW, allowedH, opts.horizontalScaleDenom)
  const vDenom = fitScaleDenom(spanEl, plotH, allowedV, opts.verticalScaleDenom)

  const mmPerM_H = 1000 / hDenom
  const mmPerM_V = 1000 / vDenom

  const usedW = spanCh * mmPerM_H
  const usedH = spanEl * mmPerM_V
  const spareW = Math.max(0, plotW - usedW)
  const spareH = Math.max(0, plotH - usedH)
  const padChM = spareW / (2 * mmPerM_H)
  const padElM = spareH / (2 * mmPerM_V)

  const axisMinCh = minCh - padChM
  const axisMaxCh = maxCh + padChM
  const axisMinEl = minEl - padElM
  const axisMaxEl = maxEl + padElM

  const x = (ch: number) => plotX0 + (ch - axisMinCh) * mmPerM_H
  const y = (el: number) => plotY1 - (el - axisMinEl) * mmPerM_V

  const hMajor = niceStep(spanCh / 8)
  const vMajor = niceStep(spanEl / 6)
  const hMinor = hMajor / 5
  const vMinor = vMajor / 5

  const xTicksMinor: number[] = []
  const xTicksMajor: number[] = []
  for (let v = Math.floor(axisMinCh / hMinor) * hMinor; v <= axisMaxCh + hMinor * 0.5; v += hMinor) xTicksMinor.push(v)
  for (let v = Math.floor(axisMinCh / hMajor) * hMajor; v <= axisMaxCh + hMajor * 0.5; v += hMajor) xTicksMajor.push(v)

  const yTicksMinor: number[] = []
  const yTicksMajor: number[] = []
  for (let v = Math.floor(axisMinEl / vMinor) * vMinor; v <= axisMaxEl + vMinor * 0.5; v += vMinor) yTicksMinor.push(v)
  for (let v = Math.floor(axisMinEl / vMajor) * vMajor; v <= axisMaxEl + vMajor * 0.5; v += vMajor) yTicksMajor.push(v)

  const gridMinor = xTicksMinor
    .map((t) => {
      const xx = x(t)
      if (xx < plotX0 - 1 || xx > plotX1 + 1) return ''
      return `<line x1="${xx.toFixed(3)}" y1="${plotY0.toFixed(3)}" x2="${xx.toFixed(3)}" y2="${plotY1.toFixed(3)}" stroke="#CBD5E1" stroke-opacity="0.25" stroke-width="0.25" vector-effect="non-scaling-stroke" />`
    })
    .join('\n')

  const gridMinorY = yTicksMinor
    .map((t) => {
      const yy = y(t)
      if (yy < plotY0 - 1 || yy > plotY1 + 1) return ''
      return `<line x1="${plotX0.toFixed(3)}" y1="${yy.toFixed(3)}" x2="${plotX1.toFixed(3)}" y2="${yy.toFixed(3)}" stroke="#CBD5E1" stroke-opacity="0.25" stroke-width="0.25" vector-effect="non-scaling-stroke" />`
    })
    .join('\n')

  const gridMajor = xTicksMajor
    .map((t) => {
      const xx = x(t)
      if (xx < plotX0 - 1 || xx > plotX1 + 1) return ''
      return `<line x1="${xx.toFixed(3)}" y1="${plotY0.toFixed(3)}" x2="${xx.toFixed(3)}" y2="${plotY1.toFixed(3)}" stroke="#64748B" stroke-opacity="0.35" stroke-width="0.35" vector-effect="non-scaling-stroke" />`
    })
    .join('\n')

  const gridMajorY = yTicksMajor
    .map((t) => {
      const yy = y(t)
      if (yy < plotY0 - 1 || yy > plotY1 + 1) return ''
      return `<line x1="${plotX0.toFixed(3)}" y1="${yy.toFixed(3)}" x2="${plotX1.toFixed(3)}" y2="${yy.toFixed(3)}" stroke="#64748B" stroke-opacity="0.35" stroke-width="0.35" vector-effect="non-scaling-stroke" />`
    })
    .join('\n')

  const xLabels = xTicksMajor
    .map((t) => {
      const xx = x(t)
      if (xx < plotX0 - 1 || xx > plotX1 + 1) return ''
      const label = formatChainageKmPlus(t)
      return `<text x="${xx.toFixed(3)}" y="${(plotY1 + 6).toFixed(3)}" text-anchor="middle" font-family="Arial" font-size="2.6" fill="#0F172A">${escapeXml(label)}</text>`
    })
    .join('\n')

  const yLabels = yTicksMajor
    .map((t) => {
      const yy = y(t)
      if (yy < plotY0 - 1 || yy > plotY1 + 1) return ''
      const label = t.toFixed(2)
      return `<text x="${(plotX0 - 2).toFixed(3)}" y="${(yy + 0.9).toFixed(3)}" text-anchor="end" font-family="Arial" font-size="2.6" fill="#0F172A">${escapeXml(label)}</text>`
    })
    .join('\n')

  const path = clean
    .map((p, idx) => {
      const xx = x(p.chainage)
      const yy = y(p.elevation)
      return `${idx === 0 ? 'M' : 'L'} ${xx.toFixed(3)} ${yy.toFixed(3)}`
    })
    .join(' ')

  const pointMarks = clean
    .map((p) => {
      const xx = x(p.chainage)
      const yy = y(p.elevation)
      const safeX = clampFinite(xx, plotX0)
      const safeY = clampFinite(yy, plotY0)
      return `<circle cx="${safeX.toFixed(3)}" cy="${safeY.toFixed(3)}" r="0.9" fill="#E8841A" stroke="#111827" stroke-width="0.2" vector-effect="non-scaling-stroke" />`
    })
    .join('\n')

  const titleBlockX = pageW - border - 140
  const titleBlockY = pageH - border - footerH + 4
  const titleBlockW = 140
  const titleBlockH = footerH - 6

  const exaggeration = (mmPerM_V / mmPerM_H) || 1

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}">\n` +
    `<rect x="0" y="0" width="${pageW}" height="${pageH}" fill="#ffffff"/>\n` +
    `<rect x="${border}" y="${border}" width="${(pageW - 2 * border).toFixed(3)}" height="${(pageH - 2 * border).toFixed(3)}" fill="none" stroke="#0F172A" stroke-width="0.6" vector-effect="non-scaling-stroke"/>\n` +
    `\n` +
    `<g>\n` +
    `${gridMinor}\n${gridMinorY}\n${gridMajor}\n${gridMajorY}\n` +
    `<rect x="${plotX0.toFixed(3)}" y="${plotY0.toFixed(3)}" width="${plotW.toFixed(3)}" height="${plotH.toFixed(3)}" fill="none" stroke="#0F172A" stroke-width="0.5" vector-effect="non-scaling-stroke"/>\n` +
    `<path d="${path}" fill="none" stroke="#E8841A" stroke-width="0.8" vector-effect="non-scaling-stroke"/>\n` +
    `${pointMarks}\n` +
    `${xLabels}\n${yLabels}\n` +
    `<text x="${((plotX0 + plotX1) / 2).toFixed(3)}" y="${(plotY1 + 12).toFixed(3)}" text-anchor="middle" font-family="Arial" font-size="3.0" fill="#0F172A">Chainage (${escapeXml(u.chainage)})</text>\n` +
    `<text x="${(border + 6).toFixed(3)}" y="${((plotY0 + plotY1) / 2).toFixed(3)}" text-anchor="middle" font-family="Arial" font-size="3.0" fill="#0F172A" transform="rotate(-90 ${(border + 6).toFixed(3)} ${((plotY0 + plotY1) / 2).toFixed(3)})">Elevation (${escapeXml(u.elevation)})</text>\n` +
    `</g>\n` +
    `\n` +
    `<g>\n` +
    `<rect x="${titleBlockX.toFixed(3)}" y="${titleBlockY.toFixed(3)}" width="${titleBlockW.toFixed(3)}" height="${titleBlockH.toFixed(3)}" fill="#ffffff" stroke="#0F172A" stroke-width="0.4" vector-effect="non-scaling-stroke"/>\n` +
    `<text x="${(titleBlockX + 3).toFixed(3)}" y="${(titleBlockY + 6).toFixed(3)}" font-family="Arial" font-size="4.0" fill="#0F172A" font-weight="700">${escapeXml(title)}</text>\n` +
    (subtitle ? `<text x="${(titleBlockX + 3).toFixed(3)}" y="${(titleBlockY + 11).toFixed(3)}" font-family="Arial" font-size="3.2" fill="#334155">${escapeXml(subtitle)}</text>\n` : '') +
    `<text x="${(titleBlockX + 3).toFixed(3)}" y="${(titleBlockY + 18).toFixed(3)}" font-family="Arial" font-size="3.0" fill="#334155">Horizontal scale: ${escapeXml(fmtScale(hDenom))}</text>\n` +
    `<text x="${(titleBlockX + 3).toFixed(3)}" y="${(titleBlockY + 23).toFixed(3)}" font-family="Arial" font-size="3.0" fill="#334155">Vertical scale: ${escapeXml(fmtScale(vDenom))} (VE ×${exaggeration.toFixed(2)})</text>\n` +
    `<text x="${(titleBlockX + 3).toFixed(3)}" y="${(titleBlockY + 28).toFixed(3)}" font-family="Arial" font-size="3.0" fill="#334155">Chainage: ${escapeXml(formatChainageKmPlus(minCh))} → ${escapeXml(formatChainageKmPlus(maxCh))}</text>\n` +
    `</g>\n` +
    `</svg>\n`
}
