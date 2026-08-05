'use client'

import Image from 'next/image'

export default function RootLoading() {
  return (
    <div className="metardu-loading-root">
      {/* Topographic Background Image */}
      <div className="topo-bg" aria-hidden />

      {/* Densely Compact Orange Contour Lines Overlay (SVG) */}
      <svg className="topo-svg-overlay" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <g stroke="rgba(209, 123, 71, 0.28)" strokeWidth="1.2" fill="none" className="topo-lines-group">
          {/* Dense concentric undulating topographic contours */}
          {Array.from({ length: 28 }).map((_, i) => {
            const r = 40 + i * 28
            const d = `M ${500 - r} 500 
                       C ${500 - r * 0.8} ${500 - r * 0.9}, ${500 + r * 0.3} ${500 - r * 1.1}, ${500 + r} 500 
                       C ${500 + r * 1.1} ${500 + r * 0.8}, ${500 - r * 0.4} ${500 + r * 1.2}, ${500 - r} 500 Z`
            return (
              <path
                key={i}
                d={d}
                style={{
                  animation: `topo-pulse ${4 + (i % 5)}s ease-in-out infinite alternate`,
                  animationDelay: `${i * 0.15}s`,
                  stroke: i % 4 === 0 ? 'rgba(255, 120, 30, 0.45)' : 'rgba(209, 123, 71, 0.22)',
                  strokeWidth: i % 4 === 0 ? '1.8' : '1.1',
                }}
              />
            )
          })}
          {/* Second offset topographic elevation cluster */}
          {Array.from({ length: 20 }).map((_, i) => {
            const r = 30 + i * 32
            const cx = 820
            const cy = 250
            const d = `M ${cx - r} ${cy} 
                       C ${cx - r * 0.85} ${cy - r * 0.95}, ${cx + r * 0.4} ${cy - r * 1.05}, ${cx + r} ${cy} 
                       C ${cx + r * 1.05} ${cy + r * 0.85}, ${cx - r * 0.5} ${cy + r * 1.15}, ${cx - r} ${cy} Z`
            return (
              <path
                key={`sec-${i}`}
                d={d}
                style={{
                  stroke: i % 3 === 0 ? 'rgba(209, 123, 71, 0.35)' : 'rgba(209, 123, 71, 0.18)',
                  strokeWidth: '1.2',
                }}
              />
            )
          })}
          {/* Third offset elevation cluster */}
          {Array.from({ length: 22 }).map((_, i) => {
            const r = 25 + i * 30
            const cx = 180
            const cy = 800
            const d = `M ${cx - r} ${cy} 
                       C ${cx - r * 0.9} ${cy - r * 0.8}, ${cx + r * 0.5} ${cy - r * 1.1}, ${cx + r} ${cy} 
                       C ${cx + r * 1.1} ${cy + r * 0.9}, ${cx - r * 0.4} ${cy + r * 1.05}, ${cx - r} ${cy} Z`
            return (
              <path
                key={`third-${i}`}
                d={d}
                style={{
                  stroke: i % 3 === 0 ? 'rgba(255, 140, 40, 0.35)' : 'rgba(209, 123, 71, 0.16)',
                  strokeWidth: '1.2',
                }}
              />
            )
          })}
        </g>
      </svg>

      {/* Dark radial gradient vignette to frame the centre branding */}
      <div className="topo-vignette" aria-hidden />

      {/* Centre Content */}
      <div className="loading-content">
        <div className="logo-ring">
          <Image
            src="/metardu-icon.png"
            alt="METARDU"
            width={56}
            height={56}
            className="rounded-xl"
            priority
          />
        </div>
        <span className="wordmark">METARDU</span>
        <div className="progress-track" role="progressbar" aria-label="Loading">
          <div className="progress-fill" />
        </div>
      </div>

      <style>{`
        .metardu-loading-root {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #050b14;
          z-index: 9999;
        }

        /* ── Topo Background Image ── */
        .topo-bg {
          position: absolute;
          inset: 0;
          background-image: url('/landing/hero-topo.webp');
          background-size: cover;
          background-position: center;
          filter: brightness(0.25) contrast(1.4) hue-rotate(-10deg);
          opacity: 0.85;
        }

        /* ── Topo SVG Overlay ── */
        .topo-svg-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          opacity: 0.9;
        }

        @keyframes topo-pulse {
          0% {
            transform: scale(1) rotate(0deg);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.03) rotate(0.5deg);
            opacity: 1;
          }
        }

        .topo-lines-group {
          transform-origin: center;
        }

        /* ── Dark Vignette ── */
        .topo-vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, rgba(5,11,20,0.65) 0%, rgba(5,11,20,0.95) 85%, #050b14 100%);
        }

        /* ── Centre Content ── */
        .loading-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        /* Orange contour ring behind logo */
        .logo-ring {
          position: relative;
          padding: 3px;
          border-radius: 18px;
          background: linear-gradient(135deg, #D17B47, #FF8C00, #B85C24);
          box-shadow: 0 0 35px 6px rgba(209, 123, 71, 0.45);
          animation: logo-glow 3s ease-in-out infinite alternate;
        }

        @keyframes logo-glow {
          0% {
            box-shadow: 0 0 25px 4px rgba(209, 123, 71, 0.35);
          }
          100% {
            box-shadow: 0 0 45px 10px rgba(255, 140, 40, 0.6);
          }
        }

        .logo-ring > img {
          display: block;
          border-radius: 15px;
          background: #050b14;
        }

        .wordmark {
          font-family: ui-monospace, 'Courier New', monospace;
          font-size: 12px;
          letter-spacing: 0.38em;
          font-weight: 700;
          color: #D17B47;
          text-transform: uppercase;
          animation: fade-pulse 2s ease-in-out infinite;
        }

        @keyframes fade-pulse {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }

        /* ── Progress bar ── */
        .progress-track {
          width: 90px;
          height: 2.5px;
          background: rgba(209, 123, 71, 0.15);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          width: 40%;
          border-radius: 999px;
          background: linear-gradient(90deg, #D17B47, #FF8C00);
          animation: progress-slide 1.4s ease-in-out infinite;
        }

        @keyframes progress-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}
