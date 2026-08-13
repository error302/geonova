import Image from 'next/image'

interface MetarduLogoProps {
  color?: string
  size?: number
  showWordmark?: boolean
  className?: string
}

/**
 * METARDU Logo Component
 *
 * Uses the official METARDU logo image (public/metardu-icon.png) — a
 * square PNG cropped from the original metardu-logo.jpg.
 *
 * The wordmark text color is controlled by the `color` prop.
 */
export default function MetarduLogo({
  color = 'currentColor',
  size = 32,
  showWordmark = true,
  className = '',
}: MetarduLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Official METARDU logo image */}
      <Image
        src="/metardu-icon.png"
        alt="METARDU logo"
        width={size}
        height={size}
        className="shrink-0 rounded"
        priority
      />

      {showWordmark && (
        <span
          className="font-bold tracking-tight"
          style={{
            fontSize: `${size * 0.47}px`,
            letterSpacing: '0.05em',
            color: color === 'currentColor' ? 'inherit' : color,
          }}
        >
          METARDU
        </span>
      )}
    </div>
  )
}
