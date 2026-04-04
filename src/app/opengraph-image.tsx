import { ImageResponse } from 'next/og'

export const dynamic = 'force-dynamic'

export const alt = 'METARDU — Professional Surveying Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0f',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#E8841A" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(232,132,26,0.15) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: '#E8841A',
            letterSpacing: '-1px',
            marginBottom: 16,
          }}
        >
          METARDU
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#e5e5e5',
            marginBottom: 8,
            fontWeight: 500,
          }}
        >
          Professional Surveying Platform
        </div>

        <div
          style={{
            fontSize: 18,
            color: '#737373',
            marginBottom: 48,
          }}
        >
          Traverse · Leveling · COGO · GPS Stakeout · PDF Reports
        </div>

        {/* Stat pills */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: '15+ Tools', sub: 'Offline ready' },
            { label: '18+ Tools', sub: 'Full precision' },
            { label: '10 Languages', sub: 'Built in Africa' },
          ].map((item: any) => (
            <div
              key={item.label}
              style={{
                padding: '12px 24px',
                background: 'rgba(232,132,26,0.08)',
                border: '1px solid rgba(232,132,26,0.25)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#E8841A', fontSize: 18, fontWeight: 600 }}>{item.label}</div>
              <div style={{ color: '#737373', fontSize: 13, marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{ position: 'absolute', bottom: 32, color: '#444', fontSize: 14 }}>
{process.env.NEXT_PUBLIC_APP_URL ? process.env.NEXT_PUBLIC_APP_URL.replace('https://', '') : 'metardu.app'}
        </div>
      </div>
    ),
    { ...size }
  )
}
