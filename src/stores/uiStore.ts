/**
 * METARDU Global UI State Store (Zustand)
 * ==========================================
 * Lightweight transient UI state — sidebar toggles, selected rows,
 * active panels, modals, theme preferences, etc.
 *
 * This store is intentionally UI-focused. Survey data (points, parcels,
 * observations) lives in dedicated domain stores that interface with
 * Web Workers and Yjs CRDTs for offline-first sync.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

// ─── Types ────────────────────────────────────────────────────────────────

export type SidebarPanel = 'none' | 'layers' | 'points' | 'properties' | 'measurements' | 'fieldbook'
export type BottomPanel = 'none' | 'observations' | 'coordinates' | 'journal' | 'console'
export type EditorTool = 'select' | 'point' | 'line' | 'polygon' | 'rectangle' | 'circle' | 'measure'

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  duration?: number // ms, 0 = persistent
  createdAt: number
}

export interface MapViewport {
  center: [number, number]
  zoom: number
  rotation: number
  projection: string
}

// ─── UI Store Interface ──────────────────────────────────────────────────

export interface UIState {
  // Sidebar & Panels
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  leftSidebarPanel: SidebarPanel
  rightSidebarOpen: boolean
  rightSidebarWidth: number
  bottomPanelOpen: boolean
  bottomPanelHeight: number
  bottomPanelTab: BottomPanel

  // Active Tool
  activeTool: EditorTool

  // Selection State
  selectedPointIds: string[]
  selectedFeatureId: string | null
  highlightedPointId: string | null

  // Map Viewport (synced from OL map)
  viewport: MapViewport | null

  // Theme
  colorScheme: 'dark' | 'light'
  highContrast: boolean

  // Command Palette
  commandPaletteOpen: boolean

  // Notifications (toast queue)
  notifications: Notification[]

  // Loading States
  globalLoading: boolean
  loadingMessage: string | null

  // ─── Actions ──────────────────────────────────────────────────────────

  // Sidebar
  toggleLeftSidebar: () => void
  setLeftSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (width: number) => void
  setLeftSidebarPanel: (panel: SidebarPanel) => void
  toggleRightSidebar: () => void
  setRightSidebarOpen: (open: boolean) => void
  setRightSidebarWidth: (width: number) => void
  toggleBottomPanel: () => void
  setBottomPanelOpen: (open: boolean) => void
  setBottomPanelHeight: (height: number) => void
  setBottomPanelTab: (tab: BottomPanel) => void

  // Tool
  setActiveTool: (tool: EditorTool) => void

  // Selection
  setSelectedPointIds: (ids: string[]) => void
  addSelectedPointId: (id: string) => void
  removeSelectedPointId: (id: string) => void
  clearSelection: () => void
  setSelectedFeatureId: (id: string | null) => void
  setHighlightedPointId: (id: string | null) => void

  // Map
  setViewport: (viewport: MapViewport) => void

  // Theme
  toggleColorScheme: () => void
  setColorScheme: (scheme: 'dark' | 'light') => void
  setHighContrast: (enabled: boolean) => void

  // Command Palette
  openCommandPalette: () => void
  closeCommandPalette: () => void

  // Notifications
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => string
  removeNotification: (id: string) => void
  clearNotifications: () => void

  // Loading
  setGlobalLoading: (loading: boolean, message?: string | null) => void
}

// ─── Store ───────────────────────────────────────────────────────────────

let notificationCounter = 0

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    // ─── Initial State ──────────────────────────────────────────────────

    leftSidebarOpen: true,
    leftSidebarWidth: 300,
    leftSidebarPanel: 'points',
    rightSidebarOpen: false,
    rightSidebarWidth: 320,
    bottomPanelOpen: false,
    bottomPanelHeight: 220,
    bottomPanelTab: 'observations',

    activeTool: 'select',

    selectedPointIds: [],
    selectedFeatureId: null,
    highlightedPointId: null,

    viewport: null,

    colorScheme: 'dark',
    highContrast: false,

    commandPaletteOpen: false,

    notifications: [],

    globalLoading: false,
    loadingMessage: null,

    // ─── Sidebar Actions ────────────────────────────────────────────────

    toggleLeftSidebar: () => set(s => ({ leftSidebarOpen: !s.leftSidebarOpen })),
    setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
    setLeftSidebarWidth: (width) => set({ leftSidebarWidth: Math.max(200, Math.min(500, width)) }),
    setLeftSidebarPanel: (panel) => set(() => ({
      leftSidebarPanel: panel,
      leftSidebarOpen: panel !== 'none'
    })),

    toggleRightSidebar: () => set(s => ({ rightSidebarOpen: !s.rightSidebarOpen })),
    setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
    setRightSidebarWidth: (width) => set({ rightSidebarWidth: Math.max(240, Math.min(480, width)) }),

    toggleBottomPanel: () => set(s => ({ bottomPanelOpen: !s.bottomPanelOpen })),
    setBottomPanelOpen: (open) => set({ bottomPanelOpen: open }),
    setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(120, Math.min(500, height)) }),
    setBottomPanelTab: (tab) => set(() => ({
      bottomPanelTab: tab,
      bottomPanelOpen: true
    })),

    // ─── Tool Actions ───────────────────────────────────────────────────

    setActiveTool: (tool) => set({ activeTool: tool }),

    // ─── Selection Actions ──────────────────────────────────────────────

    setSelectedPointIds: (ids) => set({ selectedPointIds: ids }),
    addSelectedPointId: (id) => set(s => ({
      selectedPointIds: s.selectedPointIds.includes(id)
        ? s.selectedPointIds
        : [...s.selectedPointIds, id]
    })),
    removeSelectedPointId: (id) => set(s => ({
      selectedPointIds: s.selectedPointIds.filter(pid => pid !== id)
    })),
    clearSelection: () => set({
      selectedPointIds: [],
      selectedFeatureId: null,
      highlightedPointId: null
    }),
    setSelectedFeatureId: (id) => set({ selectedFeatureId: id }),
    setHighlightedPointId: (id) => set({ highlightedPointId: id }),

    // ─── Map Actions ────────────────────────────────────────────────────

    setViewport: (viewport) => set({ viewport }),

    // ─── Theme Actions ──────────────────────────────────────────────────

    toggleColorScheme: () => set(s => ({ colorScheme: s.colorScheme === 'dark' ? 'light' : 'dark' })),
    setColorScheme: (scheme) => set({ colorScheme: scheme }),
    setHighContrast: (enabled) => set({ highContrast: enabled }),

    // ─── Command Palette ────────────────────────────────────────────────

    openCommandPalette: () => set({ commandPaletteOpen: true }),
    closeCommandPalette: () => set({ commandPaletteOpen: false }),

    // ─── Notification Actions ───────────────────────────────────────────

    addNotification: (notification) => {
      const id = `notif-${Date.now()}-${notificationCounter++}`
      const entry: Notification = {
        ...notification,
        id,
        createdAt: Date.now(),
      }
      set(s => ({ notifications: [...s.notifications, entry] }))

      // Auto-dismiss if duration is set
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          get().removeNotification(id)
        }, notification.duration)
      }

      return id
    },

    removeNotification: (id) => set(s => ({
      notifications: s.notifications.filter(n => n.id !== id)
    })),

    clearNotifications: () => set({ notifications: [] }),

    // ─── Loading Actions ────────────────────────────────────────────────

    setGlobalLoading: (loading, message = null) => set({
      globalLoading: loading,
      loadingMessage: loading ? message : null
    }),
  }))
)
