/**
 * METARDU Local LLM Service (WebLLM / WebGPU)
 * Provides offline, on-device AI capabilities for field surveyors.
 * 
 * Uses WebLLM to run quantized models directly on device via WebGPU.
 * Automatically injects Survey Act Cap 299 knowledge into system prompt.
 */

import { CreateWebWorkerMLCEngine, type WebWorkerMLCEngine, type InitProgressReport } from '@mlc-ai/web-llm'
import { CAP_299_KNOWLEDGE } from './knowledge/cap299'

// Selected mobile-friendly 3B parameter model
export const DEFAULT_LOCAL_MODEL = 'Phi-3-mini-4k-instruct-q4f16_1-MLC'

export interface LocalChatOptions {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  onProgress?: (report: InitProgressReport) => void
  onToken?: (token: string) => void
}

class LocalLlmService {
  private engine: WebWorkerMLCEngine | null = null
  private worker: Worker | null = null
  private isInitializing = false
  private initPromise: Promise<WebWorkerMLCEngine> | null = null
  private loadProgress: InitProgressReport | null = null

  get isReady(): boolean {
    return this.engine !== null
  }

  get currentProgress(): InitProgressReport | null {
    return this.loadProgress
  }

  /**
   * Initializes the WebGPU Web Worker Engine with the target model.
   */
  async initialize(
    model: string = DEFAULT_LOCAL_MODEL,
    onProgress?: (report: InitProgressReport) => void
  ): Promise<WebWorkerMLCEngine> {
    if (this.engine) return this.engine
    if (this.initPromise) return this.initPromise

    this.isInitializing = true

    this.initPromise = (async () => {
      try {
        // Create Web Worker instance targeting llm.worker.ts
        this.worker = new Worker(new URL('./llm.worker.ts', import.meta.url), {
          type: 'module',
        })

        this.engine = await CreateWebWorkerMLCEngine(
          this.worker,
          model,
          {
            initProgressCallback: (report) => {
              this.loadProgress = report
              onProgress?.(report)
            },
          }
        )

        this.isInitializing = false
        return this.engine
      } catch (err) {
        this.isInitializing = false
        this.initPromise = null
        this.engine = null
        throw new Error(`Failed to initialize local WebGPU LLM engine: ${err instanceof Error ? err.message : String(err)}`)
      }
    })()

    return this.initPromise
  }

  /**
   * Chat interface for offline inference with Survey Act Cap 299 system prompt context.
   */
  async chat(options: LocalChatOptions): Promise<string> {
    // web-llm worker failures (device lost, context overflow, OOM) reject with a
    // plain string. Retry once with a cold engine reset before giving up.
    try {
      return await this.chatOnce(options)
    } catch (err) {
      const firstMsg = this.normalizeError(err)
      try {
        await this.unload()
        return await this.chatOnce(options)
      } catch (err2) {
        throw new Error(`Local AI engine failed: ${this.normalizeError(err2)} (first attempt: ${firstMsg})`)
      }
    }
  }

  private normalizeError(err: unknown): string {
    if (typeof err === 'string') return err
    if (err instanceof Error) return err.message
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }

  private async chatOnce(options: LocalChatOptions): Promise<string> {
    const engine = await this.initialize(DEFAULT_LOCAL_MODEL, options.onProgress)

    // Prepend Survey Act Cap 299 knowledge to system prompt
    const systemMessageContent = `You are METARDU Field Assistant, an offline AI trained to assist land surveyors in remote areas.
You have authoritative knowledge of the Kenyan Survey Act Cap 299.

${CAP_299_KNOWLEDGE}

Always provide accurate misclosure rules, tolerances, and technical guidance based on Cap 299.`

    const messages = [...options.messages]
    const systemIdx = messages.findIndex((m) => m.role === 'system')
    
    if (systemIdx >= 0) {
      messages[systemIdx] = {
        role: 'system',
        content: `${systemMessageContent}\n\nAdditional Instructions:\n${messages[systemIdx].content}`,
      }
    } else {
      messages.unshift({
        role: 'system',
        content: systemMessageContent,
      })
    }

    if (options.onToken) {
      // Streaming completion
      const completion = await engine.chat.completions.create({
        messages,
        stream: true,
      })

      let fullText = ''
      for await (const chunk of completion) {
        const delta = chunk.choices[0]?.delta?.content || ''
        if (delta) {
          fullText += delta
          options.onToken(delta)
        }
      }
      return fullText
    } else {
      // Non-streaming completion
      const reply = await engine.chat.completions.create({
        messages,
      })
      return reply.choices[0]?.message?.content || ''
    }
  }

  /**
   * Unload the model engine from WebGPU VRAM.
   */
  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload()
      this.engine = null
    }
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    this.initPromise = null
    this.isInitializing = false
    this.loadProgress = null
  }
}

export const localLlmService = new LocalLlmService()
export default localLlmService
