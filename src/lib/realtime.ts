/**
 * Realtime module — Supabase-free stub
 * 
 * Provides the same API surface but uses the local Supabase compat client.
 * Real-time features (presence, live updates) require a WebSocket server
 * on the VM (future enhancement). For now, presence is a no-op.
 */

import { createClient } from '@/lib/supabase/client'

export interface PresenceUser {
  id: string
  email: string
  name?: string
  avatar_url?: string
  status: string
  last_seen: string
  cursor?: { x: number; y: number }
  active_tool?: string
}

export const realtimeService = {
  async updatePresence(_projectId: string, _data: Partial<PresenceUser>) {
    // No-op — WebSocket server required for real presence
  },
  async removePresence(_projectId: string) {
    // No-op
  }
}

export function subscribeToProjectChanges(
  _projectId: string,
  _user: { id: string; email?: string },
  _options?: {
    onPresenceChange?: (users: PresenceUser[]) => void
    onPointsChange?: (payload: { eventType: string; new: unknown; old: unknown }) => void
  }
) {
  // No-op — realtime requires a WebSocket server
  return {
    unsubscribe: async () => {}
  }
}

export type SubscribeCallback = (payload: { eventType: string; new: unknown; old: unknown }) => void

export function subscribeToFieldbookChanges(
  _projectId: string,
  _callback: SubscribeCallback
) {
  // No-op — realtime requires a WebSocket server
  return {
    unsubscribe: async () => {}
  }
}

export function subscribeToPresence(
  _roomId: string,
  _onSync: (state: unknown) => void
) {
  return {
    track: (_payload: Record<string, unknown>) => {},
    untrack: async () => {},
    unsubscribe: async () => {}
  }
}