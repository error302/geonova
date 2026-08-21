'use client'

import React, { memo } from 'react'
import Link from 'next/link'
import {
  Folder, Map as MapIcon, Compass, Calculator, Database, FileText, Layers, Settings,
  type LucideIcon,
} from 'lucide-react'
import { NAV_RAIL_WIDTH, Z_INDEX } from '@/lib/map/workspaceLayout'

interface NavItem {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'projects', label: 'Projects', href: '/dashboard', icon: Folder },
  { id: 'map', label: 'Map', href: '/map', icon: MapIcon },
  { id: 'survey', label: 'Survey', href: '/tools', icon: Compass },
  { id: 'cogo', label: 'COGO', href: '/tools/cogo', icon: Calculator },
  { id: 'data', label: 'Data', href: '/registry', icon: Database },
  { id: 'reports', label: 'Reports', href: '/reports', icon: FileText },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
]

export const MapNavigation = memo(function MapNavigation({
  activeTab,
  onOpenLayers,
  onOpenData,
}: {
  activeTab?: string
  onOpenLayers: () => void
  onOpenData: () => void
}) {
  const currentPath = '/map'

  return (
    <nav
      aria-label="Survey workspace primary navigation"
      className="hidden md:flex flex-col items-center justify-between py-2 border-r border-[var(--border-color)] bg-[var(--bg-primary)] shrink-0 overflow-y-auto"
      style={{ width: NAV_RAIL_WIDTH, zIndex: Z_INDEX.navRail }}
    >
      <div className="flex flex-col items-center gap-1.5 w-full px-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = item.id === 'map' && currentPath === '/map'

          if (item.id === 'layers') {
            return (
              <button
                key={item.id}
                onClick={onOpenLayers}
                title="Map Layers & Basemaps"
                aria-label="Layers panel"
                className={`w-full h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
                  activeTab === 'layers'
                    ? 'text-[#D17B47] bg-[#D17B47]/10 border border-[#D17B47]/30 shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8.5px] font-medium tracking-tight">{item.label}</span>
              </button>
            )
          }

          if (item.id === 'data') {
            return (
              <button
                key={item.id}
                onClick={onOpenData}
                title="Survey Data & Features"
                aria-label="Data panel"
                className={`w-full h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all ${
                  activeTab === 'data'
                    ? 'text-[#D17B47] bg-[#D17B47]/10 border border-[#D17B47]/30 shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8.5px] font-medium tracking-tight">{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              href={item.href ?? '/map'}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all no-underline ${
                isActive
                  ? 'text-[#D17B47] bg-[#D17B47]/10 border border-[#D17B47]/30 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[8.5px] font-medium tracking-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="w-8 h-px bg-[var(--border-color)]/60 my-2" />
    </nav>
  )
})
