'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { subscribeToProjectChanges, PresenceUser, realtimeService } from './index'
import { initProjectSync } from './zustand-yjs-sync'

export interface Collaborator {
  userId: string
  userName: string
  color: string
  cursor?: { lat: number; lng: number }
}

interface UseCollaborationProps {
  projectId: string | null
  userId?: string
  userName?: string
}

interface UseCollaborationReturn {
  collaborators: Collaborator[]
  isConnected: boolean
  conflictWarnings: string[]
  sendCursor: (lat: number, lng: number) => void
  sendFeatureEdit: (feature: any) => void
  sendFeatureDelete: (featureId: string) => void
  sendChat: (message: string) => void
  onFeatureEdit?: (feature: any, userId: string) => void
  onFeatureDelete?: (featureId: string, userId: string) => void
  onChat?: (message: string, userName: string, userId: string) => void
}

export function useCollaboration({
  projectId,
  userId,
  userName,
}: UseCollaborationProps): UseCollaborationReturn {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [conflictWarnings] = useState<string[]>([])
  
  const callbacksRef = useRef<{
    onFeatureEdit?: (feature: any, userId: string) => void
    onFeatureDelete?: (featureId: string, userId: string) => void
    onChat?: (message: string, userName: string, userId: string) => void
  }>({})

  useEffect(() => {
    if (!projectId || !userId) return

    // 1. Initialize Zustand-Yjs Data Sync
    initProjectSync(projectId)

    // 2. Initialize Presence via Yjs Awareness
    const subscription = subscribeToProjectChanges(
      projectId,
      { id: userId, name: userName },
      {
        onPresenceChange: (users: PresenceUser[]) => {
          setCollaborators(users.map(u => ({
            userId: u.userId,
            userName: u.userName,
            color: u.color,
            cursor: u.cursor
          })))
        }
      }
    )

    // Monitor WebRTC connection state
    const provider = realtimeService.getProvider(projectId)
    if (provider) {
      provider.on('status', ({ connected }: { connected: boolean }) => {
        setIsConnected(connected)
      })
      // If already connected before listener was attached
      setIsConnected(provider.connected)
    }

    return () => {
      subscription.unsubscribe()
    }
  }, [projectId, userId, userName])

  // Real-time Chat via Yjs Array
  const sendChat = useCallback((message: string) => {
    if (!projectId || !userId) return
    const doc = realtimeService.getDoc(projectId)
    const yChat = doc.getArray('chat')
    yChat.push([{
      userId,
      userName: userName || 'Unknown',
      message,
      timestamp: Date.now()
    }])
  }, [projectId, userId, userName])

  // Setup Chat Observer
  useEffect(() => {
    if (!projectId) return
    const doc = realtimeService.getDoc(projectId)
    const yChat = doc.getArray('chat')
    
    const observer = (event: any) => {
      event.changes.added.forEach((item: any) => {
        item.content.getContent().forEach((msg: any) => {
          if (msg.userId !== userId) {
            callbacksRef.current.onChat?.(msg.message, msg.userName, msg.userId)
          }
        })
      })
    }
    
    yChat.observe(observer)
    return () => yChat.unobserve(observer)
  }, [projectId, userId])

  // Mouse Cursor Sharing via Yjs Awareness
  const sendCursor = useCallback((lat: number, lng: number) => {
    if (!projectId || !userId) return
    const provider = realtimeService.getProvider(projectId)
    if (provider) {
      const awareness = provider.awareness
      const localState = awareness.getLocalState()
      awareness.setLocalState({
        ...localState,
        user: { ...localState?.user, cursor: { lat, lng } }
      })
    }
  }, [projectId, userId])

  // Feature Edits are now handled automatically by the Zustand-Yjs sync layer.
  // These are kept as no-ops to satisfy the component prop types.
  const sendFeatureEdit = useCallback(() => {}, [])
  const sendFeatureDelete = useCallback(() => {}, [])

  return {
    collaborators,
    isConnected,
    conflictWarnings,
    sendCursor,
    sendFeatureEdit,
    sendFeatureDelete,
    sendChat,
    ...callbacksRef.current,
  }
}
