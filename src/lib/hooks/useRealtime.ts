'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import { subscribeToProjectChanges, PresenceUser, supabase } from '@/lib/realtime'
import { savePointsOffline, getOfflinePoints } from '@/lib/offline/syncQueue'

export function useRealtimeCollaboration(
  projectId: string | null,
  user: User | null,
  options?: {
    enablePoints?: boolean
    enableTraverse?: boolean
    enableLeveling?: boolean
    onPresenceChange?: (users: PresenceUser[]) => void
  }
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [unsubscribe, setUnsubscribe] = useState<{ unsubscribe: () => Promise<void> } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableOptions = useMemo(() => options, [options?.enablePoints, options?.enableTraverse, options?.enableLeveling])

  useEffect(() => {
    if (!projectId || !user) return

    let mounted = true

    const setupSubscription = async () => {
      const subscription = subscribeToProjectChanges(
        projectId,
        user,
        {
          onPresenceChange: (users) => {
            if (mounted) {
              setOnlineUsers(users)
              stableOptions?.onPresenceChange?.(users)
            }
          },
          onPointsChange: async (payload) => {
            if (!mounted) return
            
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await savePointsOffline([payload.new])
            } else if (payload.eventType === 'DELETE') {
              const points = await getOfflinePoints(projectId)
              const filtered = points.filter(p => p.id !== payload.old.id)
              await savePointsOffline(filtered)
            }
          }
        }
      )

      if (mounted) {
        setUnsubscribe(subscription)
        setIsConnected(true)
      }
    }

    setupSubscription()

    return () => {
      mounted = false
      unsubscribe?.unsubscribe()
      setIsConnected(false)
    }
  }, [projectId, user?.id, stableOptions]) // eslint-disable-line react-hooks/exhaustive-deps

  const updatePresence = useCallback(async (data: Partial<PresenceUser>) => {
    if (!projectId) return
    const { realtimeService } = await import('@/lib/realtime')
    await realtimeService.updatePresence(projectId, data)
  }, [projectId])

  const updateCursor = useCallback(async (x: number, y: number) => {
    await updatePresence({ cursor: { x, y } })
  }, [updatePresence])

  const updateActiveTool = useCallback(async (tool: string) => {
    await updatePresence({ active_tool: tool })
  }, [updatePresence])

  return {
    onlineUsers,
    isConnected,
    updateCursor,
    updateActiveTool,
    otherUsers: onlineUsers.filter(u => u.user_id !== user?.id)
  }
}

export function useProjectRealtime(
  projectId: string | null,
  user: User | null
) {
  const [points, setPoints] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!projectId || !user) {
      setIsLoading(false)
      return
    }

    let mounted = true

    const loadInitialData = async () => {
      setIsLoading(true)
      
      const offlinePoints = await getOfflinePoints(projectId)
      if (offlinePoints.length > 0) {
        setPoints(offlinePoints)
      }

      if (!supabase) {
        console.error('Supabase not initialized')
        if (mounted) setIsLoading(false)
        return
      }

      const { data: remotePoints } = await supabase
        .from('survey_points')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })

      if (mounted && remotePoints) {
        setPoints(remotePoints)
        await savePointsOffline(remotePoints)
      }
      
      if (mounted) setIsLoading(false)
    }

    loadInitialData()

    if (!supabase) {
      console.error('Supabase not initialized')
      return
    }

    const subscription = supabase
      .channel(`project-points:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'survey_points',
        filter: `project_id=eq.${projectId}`
      }, (payload) => {
        if (!mounted) return

        setPoints(current => {
          if (payload.eventType === 'INSERT') {
            return [...current, payload.new]
          }
          if (payload.eventType === 'UPDATE') {
            return current.map(p => p.id === payload.new.id ? payload.new : p)
          }
          if (payload.eventType === 'DELETE') {
            return current.filter(p => p.id !== payload.old.id)
          }
          return current
        })
      })
      .subscribe()

    return () => {
      mounted = false
      if (supabase) {
        supabase.removeChannel(subscription)
      }
    }
  }, [projectId, user])

  return { points, isLoading }
}
