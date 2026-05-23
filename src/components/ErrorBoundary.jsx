import React from 'react'
import s from './ErrorBoundary.module.css'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to Sentry if available
    if (window.__SENTRY__) {
      window.__SENTRY__.captureException(error, {
        level: 'error',
        tags: { component: 'ErrorBoundary' }
      })
    }
    console.error('[ErrorBoundary] Caught error:', errorInfo.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={s.container}>
          <div className={s.box}>
            <div className={s.icon}>⚠️</div>
            <h1 className={s.title}>Something went wrong</h1>
            <p className={s.description}>
              We encountered an unexpected error. Try refreshing the page or contact support if the problem persists.
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className={s.details}>
                <summary>Error details (dev only)</summary>
                <pre className={s.stack}>{this.state.error?.toString()}</pre>
              </details>
            )}
            <button className={s.button} onClick={this.handleReset}>
              Try Again →
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
