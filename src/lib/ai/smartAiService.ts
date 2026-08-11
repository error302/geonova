/**
 * METARDU Smart AI Service (Hybrid Cloud / Edge)
 * =======================================================
 * Automatically switches between NVIDIA NIM Cloud AI and Local WebGPU LLM.
 * 
 * - When online & connected: routes to /api/ai/chat (NVIDIA NIM)
 * - When offline in remote trench: routes to localLlmService (WebLLM - Survey Act Cap 299)
 */

import { localLlmService, LocalChatOptions } from './localLlmService'
import type { InitProgressReport } from '@mlc-ai/web-llm'

export interface SmartChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  onToken?: (token: string) => void
  onProgress?: (report: InitProgressReport) => void
  forceOffline?: boolean
}

export async function smartChat(options: SmartChatOptions): Promise<string> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false

  if (isOnline && !options.forceOffline) {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: options.messages,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as { response?: string }
        const text = data.response || ''
        if (options.onToken) {
          options.onToken(text)
        }
        return text
      }
    } catch {
      console.warn('[smartAiService] Cloud AI request failed — switching to Offline WebGPU LLM Engine')
    }
  }

  // Fallback to Offline Local LLM with Cap 299 Knowledge
  return await localLlmService.chat({
    messages: options.messages,
    onToken: options.onToken,
    onProgress: options.onProgress,
  })
}

const smartAiService = {
  smartChat,
  localLlmService,
}

export default smartAiService
