'use client'

/**
 * CollaborationPanel — Combined presence + chat panel for project workspaces
 *
 * Features:
 * - Online collaborators with avatars
 * - Live chat messages
 * - Send messages
 * - Conflict warnings
 * - Collapsible panel
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  MessageSquare, Send, Users, ChevronDown, ChevronUp,
  AlertTriangle,
} from 'lucide-react'
import { PresenceIndicator } from './PresenceIndicator'
import { HydrationSafeTime } from '@/components/shared/HydrationSafeTime'
import type { Collaborator } from '@/lib/realtime/useCollaboration'

interface ChatMessage {
  id: string
  userId: string
  userName: string
  message: string
  timestamp: number
}

interface CollaborationPanelProps {
  collaborators: Collaborator[]
  isConnected: boolean
  messages: ChatMessage[]
  onSend: (message: string) => void
  conflictWarnings?: string[]
}

export function CollaborationPanel({
  collaborators,
  isConnected,
  messages,
  onSend,
  conflictWarnings = [],
}: CollaborationPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    if (!input.trim()) return
    onSend(input.trim())
    setInput('')
  }, [input, onSend])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[color-mix(in_srgb,var(--bg-tertiary)_50%,transparent)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Team Collaboration</span>
            <p className="text-[10px] text-gray-500">
              {isConnected
                ? `${collaborators.length + 1} online`
                : 'Disconnected'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PresenceIndicator collaborators={collaborators} isConnected={isConnected} max={4} />
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border-color)]">
          {/* Conflict warnings */}
          {conflictWarnings.length > 0 && (
            <div className="p-2 bg-amber-500/5 border-b border-amber-500/10">
              {conflictWarnings.map((warning, i) => (
                <div key={`${warning}-${i}`} className="flex items-center gap-1.5 text-[10px] text-amber-400">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div className="max-h-[200px] overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <div className="text-center py-4">
                <MessageSquare className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                <p className="text-[10px] text-gray-500">No messages yet</p>
                <p className="text-[9px] text-gray-600">Start a conversation with your team</p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="shrink-0 w-6 h-6 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] flex items-center justify-center text-[9px] font-bold text-[var(--accent)]">
                    {msg.userName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] font-medium text-[var(--text-primary)]">{msg.userName}</span>
                      <span className="text-[8px] text-gray-600">
                        <HydrationSafeTime ms={msg.timestamp} variant="time" />
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] break-words">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[var(--border-color)] p-2 flex items-center gap-2">
            <input aria-label="Type a message"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isConnected ? 'Type a message...' : 'Disconnected'}
              disabled={!isConnected}
              className="flex-1 h-8 px-2 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-primary)] placeholder-gray-600 focus:border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!isConnected || !input.trim()}
              aria-label="Send message"
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--accent)] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--accent-dim)]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
