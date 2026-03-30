'use client'
interface Props {
  x: number
  y: number
  bearing: string
  type: 'grid' | 'true' | 'magnetic'
}

export function NorthArrow({ x, y, bearing, type }: Props) {
  const label = type === 'grid' ? 'GN' : type === 'true' ? 'TN' : 'MN'
  return (
    <g transform={`translate(${x}, ${y})`}>
      <line x1={0} y1={30} x2={0} y2={-30} stroke="#111" strokeWidth={1.5} />
      <polygon points="0,-30 -5,-10 5,-10" fill="#111" />
      <polygon points="0,30 -5,10 5,10" fill="#fff" stroke="#111" strokeWidth={1} />
      <text x={0} y={-34} textAnchor="middle" fontSize={10} fontWeight="bold" fontFamily="monospace">N</text>
      <text x={0} y={44} textAnchor="middle" fontSize={7} fontFamily="monospace">{label}</text>
      <text x={0} y={54} textAnchor="middle" fontSize={7} fontFamily="monospace" fill="#555">{bearing}</text>
    </g>
  )
}
