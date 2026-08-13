'use client';

import React from 'react'

/* ──────────────────────────────────────────────────────────────────────
 *  PremiumIcons — Custom SVG icon set for METARDU Map
 *
 *  Design system:
 *    - 20x20 viewBox with 2px stroke, stroke-linecap="round", stroke-linejoin="round"
 *    - Linear gradients with brand orange (#D17B47) → lighter (#FFB84D)
 *    - Fill icons use subtle gradient fills
 *    - All icons are 20x20 by default, accept className for sizing
 * ────────────────────────────────────────────────────────────────────── */

const GRADIENT_DEFS = (
  <>
    <defs>
      <linearGradient id="icon-gradient-primary" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFB84D" />
        <stop offset="100%" stopColor="#D17B47" />
      </linearGradient>
      <linearGradient id="icon-gradient-orange" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFB84D" />
        <stop offset="100%" stopColor="#D17B47" />
      </linearGradient>
      <linearGradient id="icon-gradient-muted" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6b7280" />
        <stop offset="100%" stopColor="#4b5563" />
      </linearGradient>
      <linearGradient id="icon-gradient-danger" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f87171" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
      <linearGradient id="icon-gradient-success" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4ade80" />
        <stop offset="100%" stopColor="#22c55e" />
      </linearGradient>
      <linearGradient id="icon-gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
    </defs>
  </>
)

interface IconProps {
  className?: string
  active?: boolean
}

const sb = { strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/* ── MapPin: Location marker ────────────────────────────────────────── */
export function MapPinIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path
        d="M10 18s-7-5.5-7-10a7 7 0 1114 0c0 4.5-7 10-7 10z"
        stroke={stroke} {...sb}
      />
      <circle cx="10" cy="8" r="2.5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Pencil: Drawing / edit tool ────────────────────────────────────── */
export function PencilIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path
        d="M12.5 2.5l5 5-10 10H2.5v-5l10-10z"
        stroke={stroke} {...sb}
      />
      <path d="M10 5l5 5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Hexagon: Polygon shape ─────────────────────────────────────────── */
export function HexagonIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path
        d="M10 1.5l7.5 4.33v8.34L10 18.5 2.5 14.17V5.83L10 1.5z"
        stroke={stroke} {...sb}
      />
    </svg>
  )
}

/* ── Circle: Circle shape ───────────────────────────────────────────── */
export function CircleIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="8" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Globe: Basemap / world ─────────────────────────────────────────── */
export function GlobeIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="8" stroke={stroke} {...sb} />
      <ellipse cx="10" cy="10" rx="3.5" ry="8" stroke={stroke} {...sb} />
      <path d="M2 10h16" stroke={stroke} {...sb} />
      <path d="M3 6h14" stroke={stroke} {...sb} />
      <path d="M3 14h14" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Crosshair: Target / GPS ────────────────────────────────────────── */
export function CrosshairIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="8" stroke={stroke} {...sb} />
      <circle cx="10" cy="10" r="3" stroke={stroke} {...sb} />
      <path d="M10 1v4M10 15v4M1 10h4M15 10h4" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Satellite: Satellite imagery basemap ───────────────────────────── */
export function SatelliteIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <rect x="2" y="7" width="16" height="10" rx="1.5" stroke={stroke} {...sb} />
      <path d="M5 7V5.5a2.5 2.5 0 015 0V7" stroke={stroke} {...sb} />
      <circle cx="10" cy="12" r="1.5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Map: Terrain / standard map ────────────────────────────────────── */
export function MapIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M1 5l5.5 3L10 5l5.5 3L19 5v11l-3.5-2L10 17l-3.5-3L1 17V5z" stroke={stroke} {...sb} />
      <path d="M6.5 8v6.5M13.5 8v6.5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Trash: Delete / clear ──────────────────────────────────────────── */
export function TrashIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-danger)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M4 6h12M7 6V4.5a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0113 4.5V6" stroke={stroke} {...sb} />
      <path d="M5.5 6l.9 10.5a2 2 0 002 1.8h3.2a2 2 0 002-1.8L14.5 6" stroke={stroke} {...sb} />
      <path d="M8 9v5M12 9v5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Bolt: Quick action / energy ────────────────────────────────────── */
export function BoltIcon({ className = 'w-5 h-5', active }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path
        d="M11.5 1.5L4.5 11h5L8 18.5 15.5 9h-5l3.5-7.5z"
        stroke={active ? 'url(#icon-gradient-primary)' : 'currentColor'} {...sb}
        fill={active ? 'url(#icon-gradient-primary)' : 'none'}
        opacity={active ? 0.2 : 0}
      />
    </svg>
  )
}

/* ── Compass: Navigation / bearing ──────────────────────────────────── */
export function CompassIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="8" stroke={stroke} {...sb} />
      <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3" stroke={stroke} {...sb} strokeWidth={1.2} />
      <polygon points="10,5 12,10 10,15 8,10" stroke={active ? '#ef4444' : stroke} {...sb} />
      <polygon points="10,5 8,10 10,15 12,10" fill={active ? 'rgba(239,68,68,0.2)' : 'none'} />
    </svg>
  )
}

/* ── Ruler: Measurement ─────────────────────────────────────────────── */
export function RulerIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <rect x="2" y="6.5" width="16" height="7" rx="1" stroke={stroke} {...sb} transform="rotate(-30 10 10)" />
      <path d="M5 9h2M9 7.5h2M13 6h2" stroke={stroke} {...sb} transform="rotate(-30 10 10)" />
    </svg>
  )
}

/* ── Layers: Layer control ──────────────────────────────────────────── */
export function LayersIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M10 3L1.5 8.5L10 14l8.5-5.5L10 3z" stroke={stroke} {...sb} />
      <path d="M1.5 11.5L10 17l8.5-5.5" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Edit: Modify / edit vertices ───────────────────────────────────── */
export function EditIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M14.5 2.5l3 3L6 17H3v-3L14.5 2.5z" stroke={stroke} {...sb} />
      <path d="M12.5 4.5l3 3" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Undo: Undo action ──────────────────────────────────────────────── */
export function UndoIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M3 7h9a4 4 0 110 8H8" stroke={stroke} {...sb} />
      <path d="M6 4L3 7l3 3" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Redo: Redo action ──────────────────────────────────────────────── */
export function RedoIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M17 7H8a4 4 0 100 8h4" stroke={stroke} {...sb} />
      <path d="M14 4l3 3-3 3" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Target: Fit to / zoom ──────────────────────────────────────────── */
export function TargetIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="7.5" stroke={stroke} {...sb} />
      <circle cx="10" cy="10" r="4" stroke={stroke} {...sb} />
      <circle cx="10" cy="10" r="0.8" fill={active ? '#D17B47' : 'currentColor'} />
    </svg>
  )
}

/* ── Upload: Import file ────────────────────────────────────────────── */
export function UploadIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M10 14V3M10 3l-3.5 3.5M10 3l3.5 3.5" stroke={stroke} {...sb} />
      <path d="M3 13v3.5a1 1 0 001 1h12a1 1 0 001-1V13" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── Download: Export file ──────────────────────────────────────────── */
export function DownloadIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M10 3v11M10 14l-3.5-3.5M10 14l3.5-3.5" stroke={stroke} {...sb} />
      <path d="M3 13v3.5a1 1 0 001 1h12a1 1 0 001-1V13" stroke={stroke} {...sb} />
    </svg>
  )
}

/* ── ChevronLeft: Collapse panel ────────────────────────────────────── */
export function ChevronLeftIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M13 4l-6 6 6 6" stroke="currentColor" {...sb} />
    </svg>
  )
}

/* ── ChevronRight: Expand panel ─────────────────────────────────────── */
export function ChevronRightIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M7 4l6 6-6 6" stroke="currentColor" {...sb} />
    </svg>
  )
}

/* ── X / Close icon ─────────────────────────────────────────────────── */
export function XIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" {...sb} />
    </svg>
  )
}

/* ── Menu / Hamburger ───────────────────────────────────────────────── */
export function MenuIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" {...sb} />
    </svg>
  )
}

/* ── Search: Coordinate search ──────────────────────────────────────── */
export function SearchIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" {...sb} />
      <path d="M13 13l4.5 4.5" stroke="currentColor" {...sb} />
    </svg>
  )
}

/* ── LocationDot: GPS position ──────────────────────────────────────── */
export function LocationDotIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-success)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <circle cx="10" cy="10" r="8" stroke={stroke} {...sb} />
      <circle cx="10" cy="10" r="3" fill={active ? 'url(#icon-gradient-success)' : 'currentColor'} />
    </svg>
  )
}

/* ── Moon: Dark mode basemap ────────────────────────────────────────── */
export function MoonIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path
        d="M17.3 12.3A7.5 7.5 0 118.7 2.7a5.5 5.5 0 008.6 9.6z"
        stroke={stroke} {...sb}
      />
    </svg>
  )
}

/* ── Mountain / Terrain basemap ─────────────────────────────────────── */
export function TerrainIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <path d="M2 16l5-8 3 4 4-7 4 11H2z" stroke={stroke} {...sb} />
      <circle cx="15" cy="5" r="1.2" fill={active ? '#FFB84D' : 'currentColor'} />
    </svg>
  )
}

/* ── Grid: Square grid for area measurement ─────────────────────────── */
export function GridIcon({ className = 'w-5 h-5', active }: IconProps) {
  const stroke = active ? 'url(#icon-gradient-primary)' : 'currentColor'
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      {GRADIENT_DEFS}
      <rect x="2" y="2" width="16" height="16" rx="1" stroke={stroke} {...sb} />
      <path d="M2 7h16M2 13h16M7 2v16M13 2v16" stroke={stroke} {...sb} strokeWidth={1} />
    </svg>
  )
}

/* ── Opacity / Eye icon ─────────────────────────────────────────────── */
export function OpacityIcon({ className = 'w-5 h-5' }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M10 3.5C10 3.5 4 7.5 4 11a6 6 0 1012 0c0-3.5-6-7.5-6-7.5z"
        stroke="currentColor" {...sb}
      />
    </svg>
  )
}
