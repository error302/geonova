'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import AppSidebar from '@/components/layout/AppSidebar'
import { PerformanceMonitor } from '@/components/admin/PerformanceMonitor'
import MetarduLogo from '@/components/MetarduLogo'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — unified AppSidebar component */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-auto
          w-64 h-screen lg:h-auto
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <AppSidebar
          variant="admin"
          onNavigate={() => setSidebarOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Menu className="w-5 h-5" />
          </button>
          <MetarduLogo size={24} showWordmark={true} color="var(--text-primary)" />
          <span className="ml-auto text-xs text-[var(--text-muted)] uppercase tracking-wider">Admin</span>
        </div>

        {/* Page content */}
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>

        {/* Performance Monitor — admin-only Core Web Vitals overlay */}
        <PerformanceMonitor visible={true} />
      </div>
    </div>
  )
}
