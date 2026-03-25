import { createClient, RealtimeChannel, User } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export { supabase }

export interface PresenceUser {
  user_id: string
  user_email: string
  cursor?: { x: number; y: number }
  active_tool?: string
  project_id?: string
}

export interface RealtimeConfig {
  table: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map()
  private presenceHandlers: Map<string, (users: PresenceUser[]) => void> = new Map()

  async subscribeToTable(
    projectId: string,
    config: RealtimeConfig,
    user: User
  ): Promise<RealtimeChannel> {
    if (!supabase) {
      throw new Error('Supabase not initialized')
    }
    
    const channelName = `${config.table}:${projectId}`
    
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!
    }

    const channel = supabase.channel(channelName)

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: config.table,
          filter: config.filter ? `${config.filter}=eq.${projectId}` : `project_id=eq.${projectId}`
        },
        (payload) => config.onInsert?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: config.table,
          filter: config.filter ? `${config.filter}=eq.${projectId}` : `project_id=eq.${projectId}`
        },
        (payload) => config.onUpdate?.(payload)
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: config.table,
          filter: config.filter ? `${config.filter}=eq.${projectId}` : `project_id=eq.${projectId}`
        },
        (payload) => config.onDelete?.(payload)
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceUser>()
        const users = Object.values(state)
          .flat()
          .filter((u) => u !== null && 'user_id' in u)
        this.presenceHandlers.get(channelName)?.(users as PresenceUser[])
      })

    await channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          user_email: user.email,
          project_id: projectId,
          online_at: new Date().toISOString()
        })
      }
    })

    this.channels.set(channelName, channel)
    return channel
  }

  subscribeToPresence(
    projectId: string,
    callback: (users: PresenceUser[]) => void
  ): () => void {
    const channelName = `presence:${projectId}`
    this.presenceHandlers.set(channelName, callback)

    return () => {
      this.presenceHandlers.delete(channelName)
    }
  }

  async updatePresence(projectId: string, data: Partial<PresenceUser>): Promise<void> {
    const channelEntries = Array.from(this.channels.entries())
    for (const [name, channel] of channelEntries) {
      if (name.includes(projectId)) {
        await channel.track({
          ...data,
          project_id: projectId,
          online_at: new Date().toISOString()
        })
      }
    }
  }

  async unsubscribe(projectId: string): Promise<void> {
    const toRemove: string[] = []
    const channelEntries = Array.from(this.channels.entries())
    
    for (const [name, channel] of channelEntries) {
      if (name.includes(projectId)) {
        await channel.unsubscribe()
        toRemove.push(name)
      }
    }

    toRemove.forEach(name => {
      this.channels.delete(name)
      this.presenceHandlers.delete(name)
    })
  }

  async unsubscribeAll(): Promise<void> {
    const channelValues = Array.from(this.channels.values())
    for (const channel of channelValues) {
      await channel.unsubscribe()
    }
    this.channels.clear()
    this.presenceHandlers.clear()
  }

  getOnlineUsers(projectId: string): PresenceUser[] {
    const channelName = `presence:${projectId}`
    const channel = this.channels.get(channelName)
    
    if (!channel) return []
    
    const state = channel.presenceState<PresenceUser>()
    return Object.values(state).flat().filter((u) => u !== null && 'user_id' in u) as PresenceUser[]
  }
}

export const realtimeService = new RealtimeService()

export async function enableRealtimeForTable(table: string): Promise<void> {
  if (!supabase) return
  try {
    const { error } = await supabase.rpc('enable_realtime_for_table', { table_name: table })
    if (error) {
      console.error(`Failed to enable realtime for ${table}:`, error)
    }
  } catch (err) {
    console.error(`Failed to enable realtime for ${table}:`, err)
  }
}

export function subscribeToProjectChanges(
  projectId: string,
  user: User,
  callbacks: {
    onPointsChange?: (payload: any) => void
    onTraverseChange?: (payload: any) => void
    onLevelingChange?: (payload: any) => void
    onPresenceChange?: (users: PresenceUser[]) => void
  }
): { unsubscribe: () => Promise<void> } {
  const subscriptions: Promise<RealtimeChannel>[] = []

  if (callbacks.onPointsChange) {
    subscriptions.push(
      realtimeService.subscribeToTable(projectId, {
        table: 'survey_points',
        onInsert: callbacks.onPointsChange,
        onUpdate: callbacks.onPointsChange,
        onDelete: callbacks.onPointsChange
      }, user)
    )
  }

  if (callbacks.onTraverseChange) {
    subscriptions.push(
      realtimeService.subscribeToTable(projectId, {
        table: 'traverses',
        onInsert: callbacks.onTraverseChange,
        onUpdate: callbacks.onTraverseChange,
        onDelete: callbacks.onTraverseChange
      }, user)
    )
  }

  if (callbacks.onLevelingChange) {
    subscriptions.push(
      realtimeService.subscribeToTable(projectId, {
        table: 'leveling_runs',
        onInsert: callbacks.onLevelingChange,
        onUpdate: callbacks.onLevelingChange,
        onDelete: callbacks.onLevelingChange
      }, user)
    )
  }

  let presenceUnsubscribe: (() => void) | null = null
  if (callbacks.onPresenceChange) {
    presenceUnsubscribe = realtimeService.subscribeToPresence(projectId, callbacks.onPresenceChange)
  }

  return {
    unsubscribe: async () => {
      if (presenceUnsubscribe) presenceUnsubscribe()
      await realtimeService.unsubscribe(projectId)
    }
  }
}
