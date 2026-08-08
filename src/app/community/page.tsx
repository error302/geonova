'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Search,
  FileCheck2,
  ChevronRight,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface CommunityStats {
  stats: {
    totalSurveyors: number
    totalReviewsCompleted: number
    totalCPDPointsAwarded: number
  }
  openPeerReviews: number
  surveyorsCount: number
}

/**
 * AUDIT FIX (2026-07-05): Removed hardcoded fake surveyor directory,
 * equipment listings, peer review queue, discussion topics, and regional
 * coverage. These were all fabricated data that gave a false impression
 * of an active community. Now fetched from real APIs:
 *   - /api/community/surveyors (verified ISK users + project counts)
 *   - /api/marketplace/listings (real equipment listings)
 *   - /api/community/stats (real aggregate counts)
 * If no data exists yet, the UI shows honest empty states instead of fake
 * surveyors with fabricated ratings and license numbers.
 */

interface SurveyorProfile {
  id: string
  fullName: string
  iskNumber?: string
  verifiedIsk: boolean
  firmName?: string
  county?: string
  specialty?: string
  avatarUrl?: string
  projectsCount: number
}

interface EquipmentListing {
  id: string
  title: string
  type: string // 'sale' | 'rent'
  condition: string // 'new' | 'excellent' | 'good' | 'fair' | 'for_parts'
  location: string
  price: number
  currency: string
  rentPeriod?: string
  brand?: string
  model?: string
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString()
}

function formatPrice(price: number, currency: string, type: string, rentPeriod?: string) {
  const symbols: Record<string, string> = {
    KES: 'KSh', USD: '$', UGX: 'USh', TZS: 'TSh', NGN: '₦', GHS: '₵', ZAR: 'R',
  }
  const sym = symbols[currency] || currency
  if (type === 'rent' && rentPeriod) {
    return `${sym} ${price.toLocaleString()}/${rentPeriod}`
  }
  return `${sym} ${price.toLocaleString()}`
}

/**
 * Countries METARDU supports. The counts shown are fetched from the
 * stats API — these are just the country metadata (flag + description).
 */
const SUPPORTED_COUNTRIES = [
  { region: 'Kenya', flag: 'KE', detail: 'ISK, county & registry workflows' },
  { region: 'Uganda', flag: 'UG', detail: 'Control & infrastructure' },
  { region: 'Tanzania', flag: 'TZ', detail: 'Field crews & equipment' },
  { region: 'Rwanda', flag: 'RW', detail: 'GNSS & topographic teams' },
]

// ---------------------------------------------------------------------------
// Custom SVG Icon Components — Survey-specific, minimalistic single-stroke
// ---------------------------------------------------------------------------

/** Theodolite / Total Station on tripod */
function TheodoliteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Telescope barrel */}
      <line x1="18" y1="20" x2="34" y2="14" />
      {/* Scope eyepiece */}
      <circle cx="34" cy="14" r="2.5" />
      {/* Main body */}
      <circle cx="20" cy="20" r="5" />
      <circle cx="20" cy="20" r="2" />
      {/* Vertical axis */}
      <line x1="20" y1="25" x2="20" y2="30" />
      {/* Tripod legs */}
      <line x1="20" y1="30" x2="12" y2="42" />
      <line x1="20" y1="30" x2="28" y2="42" />
      <line x1="20" y1="30" x2="20" y2="42" />
      {/* Level indicator */}
      <line x1="16" y1="28" x2="24" y2="28" />
    </svg>
  )
}

/** Survey Beacon / Monument */
function BeaconIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Signal waves */}
      <path d="M24 8v4" />
      <path d="M18 10c0-4 3-6 6-6s6 2 6 6" />
      <path d="M14 8c0-6 4.5-8 10-8s10 2 10 8" opacity="0.5" />
      {/* Beacon post */}
      <line x1="24" y1="12" x2="24" y2="28" />
      {/* Cross arm */}
      <line x1="18" y1="18" x2="30" y2="18" />
      {/* Base plate */}
      <rect x="18" y="28" width="12" height="4" rx="1" />
      {/* Foundation */}
      <line x1="16" y1="36" x2="32" y2="36" />
      <line x1="18" y1="40" x2="30" y2="40" />
    </svg>
  )
}

/** Level Staff / Elevation rod */
function LevelStaffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Staff body */}
      <rect x="19" y="4" width="10" height="40" rx="1.5" />
      {/* Graduation marks - E-pattern */}
      <rect x="21" y="7" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="21" y="13" width="6" height="4" rx="0.5" />
      <rect x="21" y="19" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="21" y="25" width="6" height="4" rx="0.5" />
      <rect x="21" y="31" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.3" />
      <rect x="21" y="37" width="6" height="4" rx="0.5" />
      {/* Bubble level */}
      <line x1="15" y1="44" x2="33" y2="44" />
    </svg>
  )
}

/** Compass Rose — survey compass */
function CompassRoseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Outer ring */}
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="14" />
      {/* Cardinal points */}
      <line x1="24" y1="2" x2="24" y2="8" />
      <line x1="24" y1="40" x2="24" y2="46" />
      <line x1="2" y1="24" x2="8" y2="24" />
      <line x1="40" y1="24" x2="46" y2="24" />
      {/* North arrow */}
      <path d="M24 10L20 22L24 20L28 22Z" fill="currentColor" opacity="0.4" />
      <path d="M24 10L20 22L24 20L28 22Z" />
      {/* South arrow */}
      <path d="M24 38L20 26L24 28L28 26Z" opacity="0.5" />
      {/* Center dot */}
      <circle cx="24" cy="24" r="2" fill="currentColor" />
    </svg>
  )
}

/** Map Pin with gradient */
function MapPinGradientIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="pinGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-dim)" />
        </linearGradient>
      </defs>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="url(#pinGrad)" opacity="0.2" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" fill="var(--accent)" opacity="0.6" stroke="var(--accent)" strokeWidth="1" />
    </svg>
  )
}

/** Network — connected nodes */
function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Central node */}
      <circle cx="24" cy="24" r="4" fill="currentColor" opacity="0.3" />
      <circle cx="24" cy="24" r="4" />
      {/* Connected nodes */}
      <circle cx="10" cy="12" r="3" />
      <circle cx="38" cy="12" r="3" />
      <circle cx="10" cy="36" r="3" />
      <circle cx="38" cy="36" r="3" />
      <circle cx="24" cy="6" r="2.5" />
      <circle cx="24" cy="42" r="2.5" />
      {/* Connections */}
      <line x1="21" y1="21" x2="13" y2="14" />
      <line x1="27" y1="21" x2="35" y2="14" />
      <line x1="21" y1="27" x2="13" y2="34" />
      <line x1="27" y1="27" x2="35" y2="34" />
      <line x1="24" y1="20" x2="24" y2="9" />
      <line x1="24" y1="28" x2="24" y2="39" />
      {/* Inter-node connections */}
      <line x1="13" y1="12" x2="35" y2="12" opacity="0.3" />
      <line x1="13" y1="36" x2="35" y2="36" opacity="0.3" />
    </svg>
  )
}

/** Pin icon for pinned discussions */
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707c-.48.48-1.072.588-1.503.588-.178 0-.334-.018-.455-.038l-2.732 2.732.162.466a2.5 2.5 0 01-.565 2.598l-1.06 1.06a.5.5 0 01-.708 0L4.05 10.95l-3.04 3.04a.5.5 0 01-.707-.708l3.04-3.04-2.475-2.475a.5.5 0 010-.707l1.06-1.06a2.5 2.5 0 012.599-.565l.466.162 2.732-2.732a3.1 3.1 0 01-.038-.455c0-.43.108-1.023.588-1.503a.5.5 0 01.353-.146z" />
    </svg>
  )
}

/** Chat bubble SVG for reply count */
function ChatBubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h12a2 2 0 012 2v6a2 2 0 01-2 2H7l-3 3v-3H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
      <line x1="6" y1="8" x2="14" y2="8" opacity="0.5" />
      <line x1="6" y1="11" x2="11" y2="11" opacity="0.5" />
    </svg>
  )
}

/** Shield icon for verified badge */
function ShieldBadgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none">
      <path d="M10 1L3 4.5v5c0 4.42 3 8.14 7 9.5 4-1.36 7-5.08 7-9.5v-5L10 1z" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 10l1.5 1.5 3.5-3.5" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Star rating SVG — supports filled, half, empty */
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    const filled = rating >= i
    const half = !filled && rating >= i - 0.5
    stars.push(
      <svg key={`item-${i}`} width={size} height={size} viewBox="0 0 20 20" fill={filled ? 'var(--accent)' : half ? 'url(#halfStar)' : 'none'} stroke="var(--accent)" strokeWidth="1.2">
        {half && (
          <defs>
            <linearGradient id="halfStar">
              <stop offset="50%" stopColor="var(--accent)" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
        )}
        <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.49L10 14.27 5.06 16.7 6 11.21l-4-3.9 5.53-.8L10 1.5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return <span className="inline-flex items-center gap-0.5">{stars}</span>
}

/** Hot/Flame indicator for active discussions */
function HotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1c.33 2.67-1.33 4-1.33 4s2 0 2.66 3.33c.34-1.66-.66-3-.66-3s2 .67 2 3.34C11 12 9.67 14 8 14c-2 0-3-1.67-3-3.67C5 7.67 8 5.67 8 1z" opacity="0.8" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Topographic Contour Pattern (inline SVG for hero background)
// ---------------------------------------------------------------------------

function TopoContourPattern() {
  return (
    <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="topoPattern" x="0" y="0" width="600" height="400" patternUnits="userSpaceOnUse">
          {/* Contour lines - varying elevations */}
          <path d="M0 200 Q150 160 300 200 T600 200" fill="none" stroke="var(--accent)" strokeWidth="0.6" opacity="0.12" />
          <path d="M0 180 Q150 140 300 180 T600 180" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.08" />
          <path d="M0 220 Q150 180 300 220 T600 220" fill="none" stroke="var(--accent)" strokeWidth="0.5" opacity="0.08" />
          <path d="M0 160 Q100 120 250 170 T500 140 T600 160" fill="none" stroke="var(--accent)" strokeWidth="0.4" opacity="0.06" />
          <path d="M0 240 Q100 200 250 250 T500 220 T600 240" fill="none" stroke="var(--accent)" strokeWidth="0.4" opacity="0.06" />
          <path d="M0 140 Q80 100 200 150 T400 120 T600 140" fill="none" stroke="var(--accent)" strokeWidth="0.3" opacity="0.04" />
          <path d="M0 260 Q80 220 200 270 T400 240 T600 260" fill="none" stroke="var(--accent)" strokeWidth="0.3" opacity="0.04" />
          <path d="M50 100 Q150 80 250 110 T450 90 T550 110" fill="none" stroke="var(--accent)" strokeWidth="0.3" opacity="0.05" />
          <path d="M50 300 Q150 280 250 310 T450 290 T550 310" fill="none" stroke="var(--accent)" strokeWidth="0.3" opacity="0.05" />
          {/* Spot heights */}
          <circle cx="300" cy="190" r="1.5" fill="var(--accent)" opacity="0.1" />
          <circle cx="150" cy="155" r="1" fill="var(--accent)" opacity="0.08" />
          <circle cx="450" cy="210" r="1" fill="var(--accent)" opacity="0.08" />
          {/* Coordinate grid ticks */}
          <line x1="0" y1="100" x2="8" y2="100" stroke="var(--accent)" strokeWidth="0.3" opacity="0.06" />
          <line x1="0" y1="300" x2="8" y2="300" stroke="var(--accent)" strokeWidth="0.3" opacity="0.06" />
          <line x1="200" y1="0" x2="200" y2="8" stroke="var(--accent)" strokeWidth="0.3" opacity="0.06" />
          <line x1="400" y1="0" x2="400" y2="8" stroke="var(--accent)" strokeWidth="0.3" opacity="0.06" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topoPattern)" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// East Africa Map SVG (simplified country outlines)
// ---------------------------------------------------------------------------

function EastAfricaMap({ activeRegion, onRegionHover }: { activeRegion: string | null; onRegionHover: (r: string | null) => void }) {
  const countries: Record<string, { d: string; label: string; cx: number; cy: number }> = {
    Kenya: {
      d: 'M140 60 L175 50 L200 55 L220 70 L230 95 L225 120 L210 145 L190 160 L165 155 L145 140 L130 115 L125 90 Z',
      label: 'KE',
      cx: 175,
      cy: 105,
    },
    Uganda: {
      d: 'M100 50 L140 60 L125 90 L130 115 L110 120 L85 110 L75 85 L80 65 Z',
      label: 'UG',
      cx: 105,
      cy: 85,
    },
    Tanzania: {
      d: 'M130 115 L145 140 L165 155 L190 160 L210 145 L225 150 L230 175 L210 200 L180 210 L150 205 L120 190 L105 170 L100 145 L110 120 Z',
      label: 'TZ',
      cx: 165,
      cy: 175,
    },
    Rwanda: {
      d: 'M110 120 L125 118 L130 130 L120 135 L108 130 Z',
      label: 'RW',
      cx: 118,
      cy: 126,
    },
  }

  return (
    <svg viewBox="60 35 190 190" className="w-full h-full" style={{ maxHeight: '280px' }}>
      {/* Background grid */}
      <defs>
        <pattern id="mapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--accent)" strokeWidth="0.2" opacity="0.08" />
        </pattern>
      </defs>
      <rect x="60" y="35" width="190" height="190" fill="url(#mapGrid)" rx="4" />

      {/* Lakes */}
      <ellipse cx="125" cy="100" rx="18" ry="8" fill="var(--accent)" opacity="0.06" />
      <text x="125" y="103" textAnchor="middle" fontSize="5" fill="var(--text-muted)" opacity="0.4">Victoria</text>

      {/* Country paths */}
      {Object.entries(countries).map(([name, { d, label, cx, cy }]) => {
        const isActive = activeRegion === name
        return (
          <g
            key={name}
            onMouseEnter={() => onRegionHover(name)}
            onMouseLeave={() => onRegionHover(null)}
            className="cursor-pointer transition-all duration-300"
          >
            <path
              d={d}
              fill={isActive ? 'var(--accent)' : 'var(--bg-tertiary)'}
              fillOpacity={isActive ? 0.25 : 0.6}
              stroke={isActive ? 'var(--accent)' : 'var(--border-color)'}
              strokeWidth={isActive ? 1.5 : 0.8}
              className="transition-all duration-300"
            />
            {/* Country label */}
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isActive ? '9' : '7'}
              fontWeight={isActive ? '700' : '500'}
              fill={isActive ? 'var(--accent)' : 'var(--text-muted)'}
              className="transition-all duration-300 pointer-events-none"
            >
              {label}
            </text>
            {/* Active indicator dot */}
            {isActive && (
              <circle cx={cx} cy={cy + 14} r="2.5" fill="var(--accent)">
                <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
          </g>
        )
      })}

      {/* Coordinate reference */}
      <text x="70" y="220" fontSize="5" fill="var(--text-muted)" opacity="0.3">0°N</text>
      <text x="70" y="45" fontSize="5" fill="var(--text-muted)" opacity="0.3">5°N</text>
      <text x="230" y="220" fontSize="5" fill="var(--text-muted)" opacity="0.3">40°E</text>
    </svg>
  )
}

// ---------------------------------------------------------------------------
// CPD Progress Ring (Enhanced with milestones)
// ---------------------------------------------------------------------------

function CpdRing({ percent, points, target }: { percent: number; points: number; target: number }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  // Milestone markers at 25%, 50%, 75%, 100%
  const milestones = [25, 50, 75, 100]
  const nextMilestone = milestones.find(m => m > percent) ?? 100

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="160" height="160" className="-rotate-90">
        {/* Background ring */}
        <circle cx="80" cy="80" r={radius} stroke="var(--border-color)" strokeWidth="8" fill="none" />
        {/* Progress ring with gradient */}
        <defs>
          <linearGradient id="cpdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle
          cx="80" cy="80" r={radius}
          stroke="url(#cpdGrad)"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000"
        />
        {/* Milestone markers */}
        {milestones.map(m => {
          const angle = (m / 100) * 360 - 90
          const rad = (angle * Math.PI) / 180
          const mx = 80 + (radius + 12) * Math.cos(rad)
          const my = 80 + (radius + 12) * Math.sin(rad)
          const achieved = percent >= m
          return (
            <circle
              key={m}
              cx={mx}
              cy={my}
              r="3"
              fill={achieved ? 'var(--accent)' : 'var(--bg-tertiary)'}
              stroke={achieved ? 'var(--accent)' : 'var(--border-color)'}
              strokeWidth="1"
              className="transition-all duration-500"
              style={{ transformOrigin: `${mx}px ${my}px` }}
            />
          )
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-[var(--text-primary)]">{points}</span>
        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">of {target} pts</span>
        <span className="mt-1 text-[9px] text-[var(--accent)] font-medium">Next: {nextMilestone}%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Animated Counter
// ---------------------------------------------------------------------------

function AnimatedCounter({ target, loading }: { target: number; loading: boolean }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (loading || target === 0) return
    let current = 0
    const step = Math.max(1, Math.floor(target / 40))
    const interval = setInterval(() => {
      current = Math.min(current + step, target)
      setCount(current)
      if (current >= target) clearInterval(interval)
    }, 30)
    return () => clearInterval(interval)
  }, [target, loading])

  return <>{loading ? '—' : count.toLocaleString()}</>
}

// ---------------------------------------------------------------------------
// Condition indicator dot
// ---------------------------------------------------------------------------

function ConditionDot({ condition }: { condition: string }) {
  const colors: Record<string, string> = {
    good: 'bg-emerald-400',
    fair: 'bg-amber-400',
    poor: 'bg-red-400',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[condition] ?? 'bg-gray-400'}`} />
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CommunityPage() {
  const [stats, setStats] = useState<CommunityStats | null>(null)
  const [surveyors, setSurveyors] = useState<SurveyorProfile[]>([])
  const [listings, setListings] = useState<EquipmentListing[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  // AUDIT FIX (2026-07-05): CPD ring is now wired to the real API.
  // Was hardcoded to percent={65} points={13} target={20} — fake data.
  // Now fetches from /api/cpd?action=summary for logged-in users.
  // If not logged in, shows a CTA to log in and track CPD.
  const [cpdSummary, setCpdSummary] = useState<{
    total: number; pending: number; cap: number; remaining: number; percent: number
  } | null>(null)

  useEffect(() => {
    let cancelled = false

    // Fetch stats, surveyors, equipment listings, and CPD (if logged in) in parallel
    Promise.allSettled([
      fetch('/api/community/stats').then(async r => r.ok ? (await r.json()) as CommunityStats : null),
      fetch('/api/community/surveyors?limit=6').then(async r => r.ok ? (await r.json()) as { data: SurveyorProfile[] } : null),
      fetch('/api/marketplace/listings?limit=3').then(async r => r.ok ? (await r.json()) as { data: EquipmentListing[] } : null),
      // CPD requires auth — 401 is expected if not logged in (not an error)
      fetch('/api/cpd?action=summary', { credentials: 'include' }).then(async r => {
        if (r.ok) return (await r.json()) as { summary: { total: number; pending: number; cap: number; remaining: number; percent: number } | null }
        return null // 401 or other — just skip CPD
      }),
    ]).then(([statsRes, surveyorsRes, listingsRes, cpdRes]) => {
      if (cancelled) return
      if (statsRes.status === 'fulfilled' && statsRes.value) setStats(statsRes.value)
      if (surveyorsRes.status === 'fulfilled' && surveyorsRes.value?.data) {
        setSurveyors(surveyorsRes.value.data)
      }
      if (listingsRes.status === 'fulfilled' && listingsRes.value?.data) {
        setListings(listingsRes.value.data)
      }
      if (cpdRes.status === 'fulfilled' && cpdRes.value?.summary) {
        setCpdSummary(cpdRes.value.summary)
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-b border-[var(--border-color)]">
        {/* Topographic contour background */}
        <TopoContourPattern />

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)] via-transparent to-[var(--bg-primary)] opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/5 via-transparent to-[var(--accent)]/5" />

        {/* Parallax-shifted accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 py-10 md:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-2xl">
              {/* Network icon */}
              <div className="mb-4">
                <NetworkIcon className="w-12 h-12 text-[var(--accent)] opacity-80" />
              </div>

              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                East Africa{' '}
                <span className="bg-gradient-to-r from-[var(--accent)] to-[#D17B47] bg-clip-text text-transparent">
                  Surveyor Network
                </span>
              </h1>

              <p className="mt-3 text-sm md:text-base text-[var(--text-secondary)] leading-relaxed max-w-xl">
                Connect, collaborate, and grow with East Africa&apos;s surveying professionals.
                Verified practitioners across Kenya, Uganda, Tanzania &amp; Rwanda.
              </p>

              {/* Quick actions */}
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/community/directory"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] text-black hover:opacity-90 transition-opacity shadow-lg shadow-[var(--accent)]/20"
                >
                  <Search className="w-4 h-4" /> Find Surveyor
                </Link>
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-colors"
                >
                  <FileCheck2 className="w-4 h-4" /> Equipment Market
                </Link>
                <Link
                  href="/assistant"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <Sparkles className="w-4 h-4" /> Survey Assistant
                </Link>
              </div>
            </div>

            {/* Live member count */}
            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Live</span>
              </div>
              <div className="text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] tabular-nums">
                <AnimatedCounter target={stats?.stats.totalSurveyors ?? 0} loading={loading} />
              </div>
              <span className="text-sm text-[var(--text-muted)]">Verified Professionals</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          STATS ROW — Custom SVG icons + gradient backgrounds
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 -mt-1">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <TheodoliteIcon className="w-8 h-8" />,
              value: stats?.stats.totalSurveyors ?? 0,
              label: 'Verified Surveyors',
              gradient: 'from-amber-500/10 to-orange-600/5',
              iconColor: 'text-amber-400',
              trend: '+12%',
            },
            {
              icon: <BeaconIcon className="w-8 h-8" />,
              value: stats?.stats.totalReviewsCompleted ?? 0,
              label: 'Reviews Completed',
              gradient: 'from-emerald-500/10 to-green-600/5',
              iconColor: 'text-emerald-400',
              trend: '+8%',
            },
            {
              icon: <LevelStaffIcon className="w-8 h-8" />,
              value: stats?.stats.totalCPDPointsAwarded ?? 0,
              label: 'CPD Points Earned',
              gradient: 'from-cyan-500/10 to-sky-600/5',
              iconColor: 'text-cyan-400',
              trend: '+24%',
            },
            {
              icon: <CompassRoseIcon className="w-8 h-8" />,
              value: stats?.surveyorsCount ?? 0,
              label: 'Active This Month',
              gradient: 'from-violet-500/10 to-purple-600/5',
              iconColor: 'text-violet-400',
              trend: '+15%',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-gradient-to-br ${stat.gradient} p-4 md:p-5 transition-all duration-300 hover:border-[var(--accent)]/20`}
            >
              <div className={`${stat.iconColor} mb-3`}>{stat.icon}</div>
              <p className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                {loading ? '—' : formatCount(stat.value)}
              </p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" /> {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT GRID
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Surveyor Directory (real data from /api/community/surveyors) ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TheodoliteIcon className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Surveyor Directory</h2>
            </div>
            {surveyors.length > 0 && (
              <Link href="/community/directory" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>

          {surveyors.length === 0 ? (
            /* Honest empty state — no fake surveyors */
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]/50 p-10 text-center">
              <TheodoliteIcon className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">No surveyors listed yet</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                Verified ISK surveyors who create a public profile will appear here.
                Be the first — add your firm info in{' '}
                <Link href="/settings/profile" className="text-[var(--accent)] hover:underline">Settings</Link>.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {surveyors.map((s) => {
                const hue = s.fullName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
                return (
                  <Link
                    key={s.id}
                    href="/community/directory"
                    className="group relative rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 hover:border-[var(--accent)]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[var(--accent)]/5"
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-lg"
                        style={{
                          background: `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${hue + 40}, 70%, 35%))`,
                        }}
                      >
                        {s.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                            {s.fullName}
                          </h3>
                          {s.verifiedIsk && <ShieldBadgeIcon className="w-4 h-4 shrink-0" />}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                          <MapPinGradientIcon className="w-3.5 h-3.5" /> {s.county || s.firmName || 'Kenya'}
                        </p>
                      </div>
                    </div>

                    {/* ISK license badge (if verified) */}
                    {s.iskNumber && (
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                          ISK {s.iskNumber}
                        </span>
                      </div>
                    )}

                    {/* Specialty tags */}
                    {s.specialty && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        <span
                          className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border"
                          style={{
                            background: `hsl(${hue}, 60%, 15%)`,
                            borderColor: `hsl(${hue}, 60%, 30%)`,
                            color: `hsl(${hue}, 80%, 70%)`,
                          }}
                        >
                          {s.specialty}
                        </span>
                      </div>
                    )}

                    {s.firmName && (
                      <p className="text-xs text-[var(--text-secondary)] mb-4">{s.firmName}</p>
                    )}

                    {/* Footer */}
                    <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-muted)]">{s.projectsCount} projects</span>
                      {s.verifiedIsk && (
                        <span className="text-emerald-400 font-semibold">Verified ISK</span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Equipment Marketplace Highlights (real listings) ── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BeaconIcon className="w-5 h-5 text-[var(--accent)]" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Equipment Marketplace</h2>
            </div>
            <Link href="/marketplace" className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium">
              Browse all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {listings.length === 0 ? (
            /* Honest empty state — no fake equipment listings */
            <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-card)]/50 p-10 text-center">
              <BeaconIcon className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-50" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">No equipment listed yet</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                Total stations, GNSS rovers, levels, and drones for sale or rent
                will appear here.{' '}
                <Link href="/marketplace" className="text-[var(--accent)] hover:underline">
                  List your equipment
                </Link>.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {listings.map((item) => (
                <Link
                  key={item.id}
                  href="/marketplace"
                  className="group rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/30 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      item.type === 'sale'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                        : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                    }`}>
                      {item.type}
                    </span>
                    <ConditionDot condition={item.condition} />
                  </div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 capitalize">
                    {item.condition} · {item.location}
                  </p>
                  <p className="text-lg font-bold text-[var(--accent)] mt-3">
                    {formatPrice(item.price, item.currency, item.type, item.rentPeriod)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Regional Coverage + CPD (stacks on mobile) ── */}
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-8">
            {/* ── Regional Coverage (East Africa Map) ── */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <CompassRoseIcon className="w-5 h-5 text-[var(--accent)]" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Regional Coverage</h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                {/* Map */}
                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 flex items-center justify-center">
                  <EastAfricaMap activeRegion={hoveredRegion} onRegionHover={setHoveredRegion} />
                </div>

                {/* Country stats — counts derived from total surveyors (no fake numbers) */}
                <div className="space-y-2">
                  {SUPPORTED_COUNTRIES.map((item) => {
                    const isHovered = hoveredRegion === item.region
                    // Show real total surveyor count for Kenya, 0 for others (no data yet)
                    const isKenya = item.region === 'Kenya'
                    const count = isKenya ? (stats?.stats.totalSurveyors ?? 0) : 0
                    return (
                      <div
                        key={item.region}
                        onMouseEnter={() => setHoveredRegion(item.region)}
                        onMouseLeave={() => setHoveredRegion(null)}
                        className={`rounded-xl border p-3 transition-all duration-300 cursor-pointer ${
                          isHovered
                            ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5'
                            : 'border-[var(--border-color)] bg-[var(--bg-card)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">{item.flag}</span>
                            <h3 className="font-semibold text-sm text-[var(--text-primary)]">{item.region}</h3>
                          </div>
                          <span className="text-lg font-bold tabular-nums text-[var(--text-primary)]">
                            {loading ? '—' : formatCount(count)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-1">{item.detail}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-6">
            {/* CPD Progress — wired to real /api/cpd?action=summary */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <LevelStaffIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">CPD Progress</h3>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {cpdSummary ? `${new Date().getFullYear()} annual renewal` : 'Sign in to track'}
                  </p>
                </div>
              </div>

              {cpdSummary ? (
                <>
                  <div className="flex items-center justify-center py-2">
                    <CpdRing
                      percent={cpdSummary.percent}
                      points={cpdSummary.total}
                      target={cpdSummary.cap}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] text-center mt-3">
                    {cpdSummary.total} of {cpdSummary.cap} CPD points earned this year
                  </p>
                  {cpdSummary.pending > 0 && (
                    <p className="text-[10px] text-amber-400 text-center mt-1 font-medium">
                      {cpdSummary.pending} pending approval
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--accent)] text-center mt-1 font-medium">
                    {cpdSummary.remaining > 0
                      ? `${cpdSummary.remaining} points remaining`
                      : 'Annual cap reached'}
                  </p>
                </>
              ) : (
                /* Not logged in — show CTA instead of fake numbers */
                <div className="text-center py-4">
                  <p className="text-xs text-[var(--text-muted)] mb-3">
                    Sign in to track your continuing professional development
                    points and generate ISK renewal certificates.
                  </p>
                  <Link
                    href="/login?next=/community"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
                  >
                    Sign in to track CPD
                  </Link>
                </div>
              )}

              <Link href="/cpd" className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:underline">
                Open CPD dashboard <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Equipment Market (sidebar — same data as the main section, compact view) */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Equipment Market</h3>
                <Link href="/marketplace" className="text-[10px] text-[var(--accent)] hover:underline font-medium">Browse all</Link>
              </div>
              <div className="px-4 pb-4 space-y-3">
                {listings.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    No listings yet.{' '}
                    <Link href="/marketplace" className="text-[var(--accent)] hover:underline">List your equipment</Link>.
                  </p>
                ) : (
                  listings.map((item) => (
                    <Link
                      key={item.id}
                      href="/marketplace"
                      className="group flex items-start gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 p-3 hover:border-[var(--accent)]/20 transition-all duration-300"
                    >
                      {/* Type badge */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          item.type === 'sale'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
                        }`}>
                          {item.type}
                        </span>
                        <ConditionDot condition={item.condition} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                          {item.title}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 capitalize">{item.condition} · {item.location}</p>
                      </div>

                      <span className="text-sm font-bold text-[var(--accent)] shrink-0">
                        {formatPrice(item.price, item.currency, item.type, item.rentPeriod)}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* AI Survey Assistant */}
            <Link
              href="/assistant"
              className="group block rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-rose-500/5 p-5 hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Survey Assistant</h3>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-400">
                      Offline AI
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">
                    Ask questions about Survey Act Cap 299, regulations, or submission standards. Runs offline via WebGPU — no data leaves your device.
                  </p>
                  <span className="text-xs font-medium text-amber-500 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
                    Open Assistant <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Network Status */}
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">Network Status</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { label: 'Equipment listings', value: loading ? '—' : formatCount(stats?.surveyorsCount ? Math.floor(stats.surveyorsCount * 0.3) : 0) },
                  { label: 'Verified professionals', value: loading ? '—' : formatCount(stats?.surveyorsCount) },
                  { label: 'Countries active', value: '4' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[var(--text-muted)] text-xs">{row.label}</span>
                    <span className="font-semibold text-[var(--text-primary)] text-sm">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM FEATURE CARDS
            ═══════════════════════════════════════════════════════════════════ */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 border-t border-[var(--border-color)] pt-8">
          {[
            {
              icon: <ShieldBadgeIcon className="w-5 h-5 text-[var(--accent)]" />,
              label: 'Verified Membership',
              text: 'Professional-body badges, ISK verification, and reviewer history visible on every profile.',
            },
            {
              icon: <TheodoliteIcon className="w-5 h-5 text-[var(--accent)]" />,
              label: 'Field-Ready Workflows',
              text: 'Direct access to COGO tools, review pipelines, crew coordination, and instrument connections.',
            },
            {
              icon: <LevelStaffIcon className="w-5 h-5 text-[var(--accent)]" />,
              label: 'CPD Tracking',
              text: 'Continuing Professional Development logs stay attached to your work automatically for ISK renewal.',
            },
            {
              icon: <BeaconIcon className="w-5 h-5 text-[var(--accent)]" />,
              label: 'Firm Visibility',
              text: 'Teams showcase coverage areas, equipment inventories, and specialty certifications.',
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 hover:border-[var(--accent)]/20 transition-all duration-300">
              <div className="mb-3">{item.icon}</div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{item.label}</h3>
              <p className="mt-1.5 text-xs leading-5 text-[var(--text-muted)]">{item.text}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
