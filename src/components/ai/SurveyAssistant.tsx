'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { smartChat } from '@/lib/ai/smartAiService'
import { localLlmService } from '@/lib/ai/localLlmService'
import type { InitProgressReport } from '@mlc-ai/web-llm'
import { Send, Bot, User, Wifi, WifiOff, Loader2, Sparkles, AlertTriangle } from 'lucide-react'
import { logger } from '@/lib/logger'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'What are the traverse misclosure limits for a rural cadastral survey?',
  'What must a survey plan include for submission to the Director?',
  'Explain the mutation form process for RIM amendment.',
  'What equipment checks are required under Regulation 25?',
  'How do I prepare a digital submission per SRVY2025-1?',
  'What are the angular misclosure rules for Class A traverses?',
]

export default function SurveyAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `👋 Welcome to METARDU Survey Assistant. I'm powered by the offline WebGPU LLM (Phi-3-mini) with full Survey Act Cap 299, Survey Regulations LN 168/1994, and SRVY2025-1 Submission Standards knowledge.

Ask me anything about Kenyan cadastral surveying, or try one of the suggestions below.`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [loadProgress, setLoadProgress] = useState(0)
  const [isOnline, setIsOnline] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handler = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)
    return () => {
      window.removeEventListener('online', handler)
      window.removeEventListener('offline', handler)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const warmUpModel = useCallback(async () => {
    if (modelStatus === 'ready' || modelStatus === 'loading') return
    setModelStatus('loading')
    try {
      await localLlmService.initialize(undefined, (report: InitProgressReport) => {
        setLoadProgress(Math.round(report.progress * 100))
      })
      setModelStatus('ready')
    } catch {
      setModelStatus('error')
    }
  }, [modelStatus])

  useEffect(() => {
    warmUpModel()
  }, [warmUpModel])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages((prev) => [...prev, assistantMsg])

    let accumulated = ''
    try {
      await smartChat({
        messages: [
          {
            role: 'system',
            content: `You are METARDU Survey Assistant, an expert cadastral survey AI trained on the full Survey Act Cap 299, Survey Regulations LN 168/1994, SRVY2025-1 Submission Standards, and Kenyan cadastral practice. Answer precisely and cite regulation numbers where possible. Keep answers concise but complete. If asked about something outside surveying, politely redirect.`,
          },
          { role: 'user', content: text },
        ],
        onToken: (token) => {
          accumulated += token
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: accumulated }
            return updated
          })
        },
      })
    } catch (err) {
      // web-llm worker errors arrive as plain strings (not Error instances),
      // so stringify them instead of defaulting to "Unknown error".
      const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : (() => {
        try { return JSON.stringify(err) } catch { return String(err) }
      })()
      const errorMsg = (raw || '').trim() ? raw : 'Unknown error'
      logger.error('[SurveyAssistant] Chat failed:', { error: err })
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `⚠️ Error: ${errorMsg}\n\nThis run could not use the AI engine (${
            isOnline ? 'online NIM unavailable, WebGPU fallback failed' : 'offline WebGPU engine failed'
          }). Please try again or check the browser console for details.`,
        }
        return updated
      })
    } finally {
      setLoading(false)
    }
  }, [input, loading, isOnline])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Survey Assistant</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                modelStatus === 'ready' ? 'bg-green-500' :
                modelStatus === 'loading' ? 'bg-amber-500 animate-pulse' :
                modelStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-[10px] text-[var(--text-muted)]">
                {modelStatus === 'ready' ? 'WebGPU LLM ready' :
                 modelStatus === 'loading' ? `Loading model (${loadProgress}%)...` :
                 modelStatus === 'error' ? 'WebGPU unavailable' :
                 'Initializing...'}
              </span>
              {isOnline ? (
                <Wifi className="w-3 h-3 text-green-500 ml-1" />
              ) : (
                <WifiOff className="w-3 h-3 text-amber-500 ml-1" />
              )}
            </div>
          </div>
        </div>
        {modelStatus === 'loading' && (
          <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${loadProgress}%` }} />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 mt-0.5 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-[var(--accent)] text-black rounded-br-sm'
                : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 mt-0.5 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl rounded-bl-sm px-3.5 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (first message only) */}
      {messages.length === 1 && (
        <div className="shrink-0 px-4 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setInput(s)
                  inputRef.current?.focus()
                }}
                className="text-[11px] px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-4 py-3 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modelStatus === 'loading'
                ? `Loading WebGPU model (${loadProgress}%)...`
                : modelStatus === 'error'
                ? 'WebGPU unavailable — check browser support'
                : 'Ask a survey question...'
            }
            disabled={loading || modelStatus === 'loading'}
            rows={1}
            className="flex-1 resize-none bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || modelStatus === 'loading'}
            className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent)] text-black flex items-center justify-center hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--text-muted)] flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          AI-generated — always verify against official regulations. The Director of Surveys is the final authority.
        </p>
      </div>
    </div>
  )
}