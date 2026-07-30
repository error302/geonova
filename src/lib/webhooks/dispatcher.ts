// server-only: this module is intended for server-side use only

import crypto from 'crypto'
import { createClient } from '@/lib/api-client/server'
import { WebhookPayload, WebhookEvent, WEBHOOK_SIGNATURE_HEADER } from './types'

// ByteByteGo audit fix: retry with exponential backoff + jitter
// Per ByteByteGo "Retry strategies": exponential jitter is recommended
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000  // 1s, 2s, 4s

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)

      // 4xx → don't retry (client error, per ByteByteGo guidance)
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // 5xx → retry with exponential backoff
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500  // jitter
        await sleep(delay)
        continue
      }

      return response
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      // Network error → retry
      if (attempt < maxRetries) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500
        await sleep(delay)
        continue
      }
    }
  }

  // All retries exhausted — throw the last error
  throw lastError || new Error('All retries exhausted')
}

export async function dispatchWebhook(
  event: WebhookEvent,
  data: Record<string, unknown>,
  options?: { userId?: string; projectId?: string }
): Promise<{ delivered: number; failed: number }> {
  const dbClientAdmin = await createClient()
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    userId: options?.userId,
    projectId: options?.projectId
  }

  const result = await dbClientAdmin
    .from('webhooks')
    .select('*')
    .eq('active', true)
    .contains('events', [event])

  const webhooks = (result as any).data
  const error = (result as any).error

  if (error || !webhooks || webhooks.length === 0) {
    return { delivered: 0, failed: 0 }
  }

  let delivered = 0
  let failed = 0

  for (const webhook of webhooks) {
    try {
      const signature = generateSignature(payload, webhook.secret)

      const response = await fetchWithRetry(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [WEBHOOK_SIGNATURE_HEADER]: signature
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      })

      if (response.ok) {
        delivered++
        await recordDelivery(webhook.id, event, payload, 'success', response.status)
      } else {
        failed++
        await recordDelivery(webhook.id, event, payload, 'failed', response.status, await response.text())
      }
    } catch {
      failed++
      await recordDelivery(
        webhook.id,
        event,
        payload,
        'failed',
        undefined,
        'Unknown error (after retries)'
      )
    }
  }

  return { delivered, failed }
}

function generateSignature(payload: WebhookPayload, secret: string): string {
  const raw = JSON.stringify(payload)
  const digest = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return `sha256=${digest}`
}

async function recordDelivery(
  webhookId: string,
  event: WebhookEvent,
  payload: WebhookPayload,
  status: 'success' | 'failed',
  responseCode?: number,
  responseBody?: string
) {
  const dbClientAdmin = await createClient()
  await dbClientAdmin.from('webhook_deliveries').insert({
    webhook_id: webhookId,
    event,
    payload,
    status,
    response_code: responseCode,
    response_body: responseBody,
    attempts: 1,
    delivered_at: status === 'success' ? new Date().toISOString() : null
  })
}

export function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
  try {
    const a = Buffer.from(String(signature || ''), 'utf8')
    const b = Buffer.from(expected, 'utf8')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}
