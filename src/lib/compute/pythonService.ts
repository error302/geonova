import { z } from 'zod'

const pythonErrorSchema = z.object({
  error: z.string().optional(),
  fallback: z.boolean().optional(),
  details: z.any().optional(),
})

export function getPythonComputeUrl(): string | null {
  const url = process.env.PYTHON_COMPUTE_URL || process.env.PYTHON_SERVICE_URL
  if (!url) return null
  return url
}

export async function callPythonCompute<T>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number }
): Promise<{ ok: true; value: T } | { ok: false; status: number; error: string; fallback?: boolean; details?: unknown }> {
  const base = getPythonComputeUrl()
  if (!base) {
    return { ok: false, status: 503, error: 'Python compute service is not configured.', fallback: true }
  }

  const controller = new AbortController()
  const timeoutMs = opts?.timeoutMs ?? 10000
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const status = response.status
    const json = await response.json().catch(() => null)

    if (!response.ok) {
      const parsed = pythonErrorSchema.safeParse(json)
      return {
        ok: false,
        status,
        error: parsed.success && parsed.data.error ? parsed.data.error : `Python service returned ${status}`,
        fallback: parsed.success ? parsed.data.fallback : undefined,
        details: parsed.success ? parsed.data.details : json,
      }
    }

    return { ok: true, value: json as T }
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { ok: false, status: 503, error: `Python compute service unavailable (timeout after ${timeoutMs}ms).`, fallback: true }
    }
    return { ok: false, status: 503, error: 'Python compute service unavailable.', fallback: true, details: e?.message }
  } finally {
    clearTimeout(timeoutId)
  }
}

