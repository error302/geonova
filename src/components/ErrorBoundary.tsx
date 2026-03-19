'use client'
import { Component, ReactNode } from 'react'

interface Props { 
  children: ReactNode
  fallback?: ReactNode 
}

interface State { 
  hasError: boolean
  error?: Error 
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    console.error('GeoNova Error:', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
          <div className="text-center max-w-md p-8">
            <h1 className="text-amber-500 text-2xl font-bold mb-4">
              GEONOVA
            </h1>
            <p className="text-white text-lg mb-2">
              Something went wrong
            </p>
            <p className="text-gray-400 text-sm mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-500 text-black px-6 py-2 rounded font-bold" aria-label="Reload page"
            >
              Reload Page
            </button>
            <p className="text-gray-500 text-xs mt-4">
              If this keeps happening please use the feedback button
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
