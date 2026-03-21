interface MetarduLogoProps {
  color?: string
  size?: number
  showWordmark?: boolean
}

export default function MetarduLogo({
  color = 'currentColor',
  size = 24,
  showWordmark = true,
}: MetarduLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 30 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="METARDU logo"
      >
        <circle cx="15" cy="14" r="9" stroke={color} strokeWidth="1.4" />
        <polygon
          points="15,6 22,18 8,18"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <line
          x1="15" y1="6" x2="15" y2="18"
          stroke={color}
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeDasharray="1.5 1.5"
        />
        <line
          x1="15" y1="23" x2="15" y2="27"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <line
          x1="10" y1="27" x2="20" y2="27"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <line
          x1="10" y1="27" x2="7" y2="33"
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <line
          x1="15" y1="27" x2="15" y2="33"
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <line
          x1="20" y1="27" x2="23" y2="33"
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <line
          x1="6" y1="33" x2="24" y2="33"
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark && (
        <span
          style={{
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: color === 'currentColor' ? 'inherit' : color,
          }}
        >
          METARDU
        </span>
      )}
    </div>
  )
}
