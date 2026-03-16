import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a logging service
    console.error('QuizRush crash:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', fontFamily: 'sans-serif', color: '#f1f0ff',
        textAlign: 'center', padding: '2rem',
      }}>
        <div style={{ maxWidth: 440 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Something crashed</h2>
          <p style={{ color: '#9898b8', marginBottom: 24, lineHeight: 1.7, fontSize: 14 }}>
            Don't panic — your score is saved in the database.<br />
            Tap below to reload and rejoin instantly.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'linear-gradient(135deg, #7c6cfc, #e879f9)',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '12px 32px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', marginBottom: 16,
            }}
          >
            Reload & Rejoin
          </button>
          <details style={{ marginTop: 12 }}>
            <summary style={{ fontSize: 12, color: '#5a5a7a', cursor: 'pointer' }}>Error details</summary>
            <pre style={{ fontSize: 11, color: '#5a5a7a', marginTop: 8, textAlign: 'left', overflow: 'auto' }}>
              {this.state.error?.message}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
