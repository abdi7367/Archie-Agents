import React from 'react'

/**
 * ErrorBoundary
 * Wraps any subtree. If a child throws during render, this shows a
 * fallback UI instead of blanking the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={styles.wrapper}>
        <div style={styles.card}>
          <div style={styles.icon}>⚠️</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          {import.meta.env.DEV && this.state.info && (
            <pre style={styles.stack}>
              {this.state.info.componentStack}
            </pre>
          )}
          <div style={styles.actions}>
            <button style={styles.btn} onClick={this.handleReset}>
              Try Again
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
  },
  card: {
    background: 'rgba(15, 15, 35, 0.95)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '20px',
    padding: '48px',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
  },
  icon: {
    fontSize: '56px',
    marginBottom: '20px',
  },
  title: {
    fontFamily: 'Space Grotesk, system-ui, sans-serif',
    fontSize: '28px',
    fontWeight: 800,
    color: '#e0e0e0',
    margin: '0 0 12px 0',
  },
  message: {
    color: '#a0a0a0',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 24px 0',
    fontFamily: 'JetBrains Mono, monospace',
  },
  stack: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '12px',
    color: '#ef4444',
    textAlign: 'left',
    overflowX: 'auto',
    marginBottom: '24px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  btn: {
    padding: '12px 28px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
  },
  btnSecondary: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    boxShadow: 'none',
    color: '#a0a0a0',
  },
}

export default ErrorBoundary