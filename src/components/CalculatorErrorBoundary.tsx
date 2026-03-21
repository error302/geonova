'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  toolName?: string
}

interface State {
  hasError: boolean
  message: string
}

export class CalculatorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error) {
    console.error(`[METARDU] Calculator error${this.props.toolName ? ` (${this.props.toolName})` : ''}:`, error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-12 rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="text-base font-semibold mb-2">Calculation error</p>
          <p className="text-red-700 dark:text-red-300 mb-4">
            {this.state.message || 'An unexpected error occurred. Check your inputs and try again.'}
          </p>
          <button
            className="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition-colors"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Reset calculator
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
