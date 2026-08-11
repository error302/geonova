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
    if (this.docs.has(projectId)) return this.docs.get(projectId)!

    const doc = new Y.Doc()
    this.docs.set(projectId, doc)

    // Offline persistence
    const persistence = new IndexeddbPersistence(`metardu-sync-${projectId}`, doc)
    this.persistences.set(projectId, persistence)

    // WebRTC Provider for P2P Local LAN sync (using public/local signaling)
    const provider = new WebrtcProvider(`metardu-mesh-${projectId}`, doc, {
      signaling: ['wss://signaling.yjs.dev', 'ws://localhost:4444'], // Add local fallback if deployed offline
      password: 'metardu-secure-field'
    })
    this.providers.set(projectId, provider)

    return doc
  }

  public getProvider(projectId: string): WebrtcProvider | undefined {
    return this.providers.get(projectId)
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
  // This is a compatibility layer for the old HTTP polling interface.
  // In the new architecture, Zustand automatically syncs with Yjs via the sync layer.
  // We just handle presence here.

  const provider = realtimeService.getProvider(projectId)
  if (!provider) {
    // Force init
    realtimeService.getDoc(projectId)
  }
  
  const activeProvider = realtimeService.getProvider(projectId)
  if (activeProvider && callbacks.onPresenceChange) {
    const awareness = activeProvider.awareness

    // Set local presence
    awareness.setLocalStateField('user', {
      userId: user.id,
      userName: user.name || user.email || 'Unknown Surveyor',
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      onlineAt: new Date().toISOString()
    })

    const handleAwarenessChange = () => {
      const states = Array.from(awareness.getStates().values())
      const users = states
        .filter((state: { user?: { userId?: string } }) => state.user && state.user.userId !== user.id)
        .map(state => state.user as PresenceUser)
      callbacks.onPresenceChange!(users)
    }

    awareness.on('change', handleAwarenessChange)
    
    // Initial emit
    handleAwarenessChange()

    return {
      unsubscribe: async () => {
        awareness.off('change', handleAwarenessChange)
      }
    }
  }

  return {
    unsubscribe: async () => {}
  }
}
