/**
 * METARDU Enterprise Yjs Offline Mesh Network
 * ===========================================
 * Replaces HTTP polling with true Peer-to-Peer CRDTs using WebRTC.
 * Allows surveyors to sync GNSS points locally over Wi-Fi without internet.
 */

import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { IndexeddbPersistence } from 'y-indexeddb'

export interface PresenceUser {
  userId: string
  userName: string
  color: string
  cursor?: { lat: number; lng: number }
  onlineAt?: string
}

class YjsMeshNetwork {
  private docs: Map<string, Y.Doc> = new Map()
  private providers: Map<string, WebrtcProvider> = new Map()
  private persistences: Map<string, IndexeddbPersistence> = new Map()

  public getDoc(projectId: string): Y.Doc {
    const existing = this.docs.get(projectId)
    if (existing) return existing

    const doc = new Y.Doc()
    this.docs.set(projectId, doc)

    // Offline persistence via IndexedDB
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      try {
        const persistence = new IndexeddbPersistence(`metardu-sync-${projectId}`, doc)
        this.persistences.set(projectId, persistence)
      } catch {
        // Fallback gracefully if IndexedDB is disabled/blocked in iframe
      }
    }

    // WebRTC Provider for P2P Local LAN sync (using public & local signaling)
    if (typeof window !== 'undefined') {
      try {
        const signalingServers = ['wss://signaling.yjs.dev', 'ws://localhost:4444']
        const customSignaling = process.env.NEXT_PUBLIC_COLLAB_SIGNALING_URL
        if (customSignaling) {
          signalingServers.unshift(customSignaling)
        }

        const provider = new WebrtcProvider(`metardu-mesh-${projectId}`, doc, {
          signaling: signalingServers,
          password: 'metardu-secure-field',
        })
        this.providers.set(projectId, provider)
      } catch {
        // Fallback gracefully if WebRTC is blocked
      }
    }

    return doc
  }

  public getProvider(projectId: string): WebrtcProvider | undefined {
    return this.providers.get(projectId)
  }

  /**
   * Broadcasts a newly captured survey point across all active mesh peers in real time
   */
  public broadcastPoint(projectId: string, point: { id: string; easting: number; northing: number; elevation?: number; code?: string; timestamp?: number }): void {
    const doc = this.getDoc(projectId)
    const yPoints = doc.getMap<unknown>('live_points')
    doc.transact(() => {
      yPoints.set(point.id, {
        ...point,
        timestamp: point.timestamp || Date.now(),
      })
    })
  }

  /**
   * Retrieves all live synchronized points from the project's CRDT document
   */
  public getLivePoints(projectId: string): Array<{ id: string; easting: number; northing: number; elevation?: number; code?: string }> {
    const doc = this.getDoc(projectId)
    const yPoints = doc.getMap<unknown>('live_points')
    const results: Array<{ id: string; easting: number; northing: number; elevation?: number; code?: string }> = []
    yPoints.forEach((val) => {
      if (val && typeof val === 'object') {
        results.push(val as any)
      }
    })
    return results
  }

  public async unsubscribe(projectId: string): Promise<void> {
    const provider = this.providers.get(projectId)
    if (provider) {
      provider.disconnect()
      provider.destroy()
      this.providers.delete(projectId)
    }

    const persistence = this.persistences.get(projectId)
    if (persistence) {
      persistence.destroy()
      this.persistences.delete(projectId)
    }

    const doc = this.docs.get(projectId)
    if (doc) {
      doc.destroy()
      this.docs.delete(projectId)
    }
  }

  public async unsubscribeAll(): Promise<void> {
    for (const projectId of Array.from(this.docs.keys())) {
      await this.unsubscribe(projectId)
    }
  }
}

export const realtimeService = new YjsMeshNetwork()

export function subscribeToProjectChanges(
  projectId: string,
  user: { id: string; email?: string; name?: string },
  callbacks: {
    onPointsChange?: (payload: unknown) => void
    onTraverseChange?: (payload: unknown) => void
    onLevelingChange?: (payload: unknown) => void
    onPresenceChange?: (users: PresenceUser[]) => void
  }
): { unsubscribe: () => Promise<void> } {
  const doc = realtimeService.getDoc(projectId)
  const activeProvider = realtimeService.getProvider(projectId)

  // Listen to points changes
  if (callbacks.onPointsChange) {
    const yPoints = doc.getMap('live_points')
    const handlePointsChange = () => {
      const pts = realtimeService.getLivePoints(projectId)
      callbacks.onPointsChange?.(pts)
    }
    yPoints.observe(handlePointsChange)
  }

  if (activeProvider && callbacks.onPresenceChange) {
    const awareness = activeProvider.awareness

    // Set local presence
    awareness.setLocalStateField('user', {
      userId: user.id,
      userName: user.name || user.email || 'Unknown Surveyor',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      onlineAt: new Date().toISOString(),
    })

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().values())
      const users = states
        .filter((state: { user?: { userId?: string } }) => state.user && state.user.userId !== user.id)
        .map((state) => state.user as PresenceUser)
      callbacks.onPresenceChange?.(users)
    }

    awareness.on('change', handleAwarenessChange)
    handleAwarenessChange()

    return {
      unsubscribe: async () => {
        awareness.off('change', handleAwarenessChange)
      },
    }
  }

  return {
    unsubscribe: async () => {},
  }
}

