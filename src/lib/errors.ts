/**
 * Centralized error handling — no information leakage to clients.
 */
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    private internalDetail?: string
  ) {
    super(message)
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  // Zod validation errors
  if (error && typeof error === 'object' && 'flatten' in error) {
    const zodErr = error as { flatten: () => { fieldErrors: Record<string, string[]> } }
    return NextResponse.json(
      { error: 'Invalid input', details: zodErr.flatten().fieldErrors, code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // Log full error server-side, return generic message to client
  logger.error('[API Error]', { error: error })
  return NextResponse.json(
    { error: 'An internal error occurred', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}
