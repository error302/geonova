'use client';

/**
 * TraverseDiagram — SVG visualisation of an adjusted traverse.
 *
 * Roadmap reference: docs/ROADMAP.md → Tool page deep refits →
 * "field-book table + output diagram pattern". Renders alongside the
 * existing tabular output on `/tools/traverse`.
 *
 * Draws:
 *   - Adjusted traverse as a solid accent-coloured polyline
 *   - Raw (unadjusted) traverse as a dashed muted polyline, showing the
 *     misclosure graphically
 *   - Closing error vector (red) from raw end back to the start
 *   - Station markers (filled circles) with labels
 *   - North arrow + scale bar
 *
 * Accepts the same `result` object shape that the traverse page's
 * tabular output already consumes (cast to `any` to match the existing
 * pattern — the runtime shape differs slightly from the TS type).
 */

import { useMemo } from 'react';

interface TraverseDiagramProps {
  result: any;
}

interface Point {
  name: string;
  easting: number;
  northing: number;
}

export function TraverseDiagram({ result }: TraverseDiagramProps) {
  const WIDTH = 800;
  const HEIGHT = 500;
  const PAD = 50;

  const { adjustedPath, rawPath, closingError } = useMemo(() => {
    const legs: any[] = result.legs || [];
    if (legs.length === 0) {
      return { adjustedPath: [], rawPath: [], closingError: 0 };
    }

    // Adjusted path: use adjEasting / adjNorthing from each leg's "to" point,
    // prepend the first leg's "from" point (initial coords).
    const adjustedPath: Point[] = [];
    // The first leg's "from" station's coordinates are the known starting
    // coords. We can derive them as: adjEasting(leg[0]) - adjDeltaE(leg[0])
    // But the page's result object has `adjEasting`/`adjNorthing` on each
    // leg = the "to" station's adjusted coords. So the start point is
    // leg[0].adjEasting - leg[0].correctedDeparture (or similar).
    // Simpler: walk from the end backwards using corrected deltas.
    // Even simpler: use the raw input coords for the first point.
    // The page stores the initial N/E on the leg input; the result legs
    // only carry the "to" coords. We'll back-compute the start.
    const firstLeg = legs[0];
    const startE = firstLeg.adjEasting - (firstLeg.correctedDeparture ?? firstLeg.adjDeltaE ?? 0);
    const startN = firstLeg.adjNorthing - (firstLeg.correctedLatitude ?? firstLeg.adjDeltaN ?? 0);
    adjustedPath.push({ name: firstLeg.from, easting: startE, northing: startN });
    for (const leg of legs) {
      adjustedPath.push({
        name: leg.to,
        easting: leg.adjEasting,
        northing: leg.adjNorthing,
      });
    }

    // Raw path: walk from the same start, accumulating raw deltas.
    const rawPath: Point[] = [adjustedPath[0]];
    let curE = startE;
    let curN = startN;
    for (const leg of legs) {
      const dE = leg.departure ?? leg.rawDeltaE ?? 0;
      const dN = leg.latitude ?? leg.rawDeltaN ?? 0;
      curE += dE;
      curN += dN;
      rawPath.push({ name: leg.to, easting: curE, northing: curN });
    }

    // Closing error = distance between raw end and start
    const rawEnd = rawPath[rawPath.length - 1];
    const closingError = Math.sqrt(
      Math.pow(rawEnd.easting - startE, 2) +
      Math.pow(rawEnd.northing - startN, 2)
    );

    return { adjustedPath, rawPath, closingError };
  }, [result]);

  if (adjustedPath.length < 2) {
    return (
      <p className="text-xs text-[var(--text-muted)] py-4 text-center">
        Not enough data to plot diagram.
      </p>
    );
  }

  // Compute bounds from all points (adjusted + raw)
  const allPoints = [...adjustedPath, ...rawPath];
  const es = allPoints.map(p => p.easting);
  const ns = allPoints.map(p => p.northing);
  const minE = Math.min(...es);
  const maxE = Math.max(...es);
  const minN = Math.min(...ns);
  const maxN = Math.max(...ns);
  const dx = maxE - minE || 1;
  const dy = maxN - minN || 1;
  // Maintain aspect ratio
  const scale = Math.min((WIDTH - 2 * PAD) / dx, (HEIGHT - 2 * PAD) / dy);
  const offsetX = (WIDTH - dx * scale) / 2;
  const offsetY = (HEIGHT - dy * scale) / 2;

  const tx = (e: number) => offsetX + (e - minE) * scale;
  // Invert Y because SVG Y grows downward but Northing grows upward
  const ty = (n: number) => HEIGHT - offsetY - (n - minN) * scale;

  // Build SVG path strings
  const adjustedD = adjustedPath
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tx(p.easting).toFixed(1)} ${ty(p.northing).toFixed(1)}`)
    .join(' ');
  const rawD = rawPath
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${tx(p.easting).toFixed(1)} ${ty(p.northing).toFixed(1)}`)
    .join(' ');

  // Closing error vector (from raw end back to start)
  const rawEnd = rawPath[rawPath.length - 1];
  const start = adjustedPath[0];

  // Scale bar: pick a round number that's about 1/4 of the diagram width
  const diagramWidthM = dx;
  const scaleBarM = niceRoundNumber(diagramWidthM / 4);
  const scaleBarPx = scaleBarM * scale;
  const scaleBarX = PAD;
  const scaleBarY = HEIGHT - 20;

  // North arrow position (top-right corner)
  const northX = WIDTH - 40;
  const northY = 40;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        style={{ minWidth: 600 }}
      >
        {/* Grid background */}
        <defs>
          <pattern id="traverse-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border-color)" strokeWidth="0.3" opacity="0.4" />
          </pattern>
        </defs>
        <rect x={PAD} y={PAD} width={WIDTH - 2 * PAD} height={HEIGHT - 2 * PAD} fill="url(#traverse-grid)" opacity="0.5" />

        {/* Raw (unadjusted) traverse — dashed muted */}
        <path
          d={rawD}
          fill="none"
          stroke="#71717a"
          strokeWidth="1.5"
          strokeDasharray="5,3"
          opacity="0.6"
        />

        {/* Closing error vector — red dashed */}
        {closingError > 0.001 && (
          <line
            x1={tx(rawEnd.easting)}
            y1={ty(rawEnd.northing)}
            x2={tx(start.easting)}
            y2={ty(start.northing)}
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeDasharray="3,3"
            opacity="0.7"
          />
        )}

        {/* Adjusted traverse — solid accent */}
        <path
          d={adjustedD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Station markers + labels */}
        {adjustedPath.map((p, i) => {
          const isStart = i === 0;
          const isEnd = i === adjustedPath.length - 1;
          const fill = isStart ? '#22c55e' : isEnd ? '#fbbf24' : 'var(--accent)';
          return (
            <g key={`stn-${i}`}>
              <circle
                cx={tx(p.easting)}
                cy={ty(p.northing)}
                r="5"
                fill={fill}
                stroke="#1A1816"
                strokeWidth="1.5"
              />
              <text
                x={tx(p.easting) + 8}
                y={ty(p.northing) - 8}
                fontSize="11"
                fill="var(--text-primary)"
                fontFamily="monospace"
                fontWeight="600"
              >
                {p.name}
              </text>
              {isStart && (
                <text
                  x={tx(p.easting) + 8}
                  y={ty(p.northing) + 4}
                  fontSize="9"
                  fill="#22c55e"
                  fontFamily="monospace"
                >
                  START
                </text>
              )}
              {isEnd && !isStart && (
                <text
                  x={tx(p.easting) + 8}
                  y={ty(p.northing) + 4}
                  fontSize="9"
                  fill="#fbbf24"
                  fontFamily="monospace"
                >
                  END
                </text>
              )}
            </g>
          );
        })}

        {/* North arrow */}
        <g transform={`translate(${northX} ${northY})`}>
          <circle cx="0" cy="0" r="18" fill="none" stroke="var(--text-muted)" strokeWidth="0.5" opacity="0.5" />
          <path d="M 0 -14 L -5 6 L 0 2 L 5 6 Z" fill="var(--accent)" stroke="var(--accent)" strokeWidth="0.5" />
          <text x="0" y="-20" textAnchor="middle" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace" fontWeight="700">
            N
          </text>
        </g>

        {/* Scale bar */}
        <g transform={`translate(${scaleBarX} ${scaleBarY})`}>
          <line x1="0" y1="0" x2={scaleBarPx} y2="0" stroke="var(--text-secondary)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--text-secondary)" strokeWidth="2" />
          <line x1={scaleBarPx} y1="-4" x2={scaleBarPx} y2="4" stroke="var(--text-secondary)" strokeWidth="2" />
          <text x={scaleBarPx / 2} y="-8" textAnchor="middle" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace">
            {scaleBarM >= 1000 ? `${(scaleBarM / 1000).toFixed(1)} km` : `${scaleBarM.toFixed(0)} m`}
          </text>
        </g>

        {/* Legend */}
        <g transform={`translate(${PAD} ${PAD - 15})`}>
          <line x1="0" y1="0" x2="20" y2="0" stroke="var(--accent)" strokeWidth="2.5" />
          <text x="25" y="3" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace">Adjusted</text>
          <line x1="90" y1="0" x2="110" y2="0" stroke="#71717a" strokeWidth="1.5" strokeDasharray="5,3" />
          <text x="115" y="3" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace">Raw (unadjusted)</text>
          {closingError > 0.001 && (
            <>
              <line x1="230" y1="0" x2="250" y2="0" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,3" />
              <text x="255" y="3" fontSize="10" fill="var(--text-secondary)" fontFamily="monospace">
                Closing error: {closingError.toFixed(4)} m
              </text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
}

/** Pick a nice round number close to the input (1, 2, 5, 10, 20, 50, 100, ...). */
function niceRoundNumber(x: number): number {
  if (x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  const f = x / Math.pow(10, exp);
  let nice: number;
  if (f < 1.5) nice = 1;
  else if (f < 3.5) nice = 2;
  else if (f < 7.5) nice = 5;
  else nice = 10;
  return nice * Math.pow(10, exp);
}
