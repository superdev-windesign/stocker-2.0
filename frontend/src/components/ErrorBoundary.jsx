import { Component } from 'react'

// Catches render errors in a route subtree so a crash shows a recoverable message
// instead of a blank page. Keyed by route in App, so navigating elsewhere resets it.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[stocker] render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-xl border border-down/30 bg-down/5 p-6 text-center">
          <div className="text-3xl">⚠️</div>
          <h2 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">Something went wrong on this page</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {this.state.error?.message || 'Unexpected error.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.assign('/')}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-white/10"
            >
              Back to portfolio
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
