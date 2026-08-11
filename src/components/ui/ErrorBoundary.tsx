'use client';

import { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/lib/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional custom fallback UI */
  fallback?: ReactNode
  /** Optional callback on error */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Optional title shown in default fallback */
  title?: string
  /** Whether to show a "Go Home" button in the default fallback */
  showHomeButton?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Enhanced error boundary with friendly error display, retry capability,
 * and optional error reporting.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[ErrorBoundary] Caught error:', { error, errorInfo })
    this.props.onError?.(error, errorInfo)

    // Collect error for feedback system if available
    try {
      const feedbackEntries: Record<string, unknown>[] = JSON.parse(
        sessionStorage.getItem('metardu_feedback_errors') || '[]'
      )
      feedbackEntries.push({
        message: error.message,
        stack: error.stack?.slice(0, 500),
        componentStack: errorInfo.componentStack?.slice(0, 500),
        url: typeof window !== 'undefined' ? window.location.href : '',
        timestamp: new Date().toISOString(),
      })
      // Keep only last 10 errors
      sessionStorage.setItem(
        'metardu_feedback_errors',
        JSON.stringify(feedbackEntries.slice(-10))
      )
    } catch {
      // ignore storage errors
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    // Custom fallback provided by parent
    if (this.props.fallback) {
      return this.props.fallback
    }

    // Default friendly error display
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          {/* Error icon */}
          <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2 font-['Barlow_Condensed']">
            {this.props.title || 'Something went wrong'}
          </h2>

          {this.state.error && (
            <p className="text-sm text-[var(--text-muted)] mb-6 font-mono bg-[var(--bg-secondary)] rounded-lg px-4 py-3 text-left break-all max-h-24 overflow-y-auto border border-[var(--border-color)]">
              {this.state.error.message}
            </p>
          )}

          <p className="text-[var(--text-secondary)] mb-6">
            This section encountered an unexpected error. Try again or navigate to a different page.
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            <button
              onClick={this.handleRetry}
              className="btn btn-primary"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Try Again
            </button>

            {this.props.showHomeButton !== false && (
              <a href="/" className="btn btn-secondary">
                Go Home
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }
}
