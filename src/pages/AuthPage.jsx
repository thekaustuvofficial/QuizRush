import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AuthPage() {
  const nav = useNavigate()
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSubmit() {
    setError('')
    setSuccess('')
    if (!email.trim()) return setError('Email is required.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')

    try {
      setLoading(true)
      if (mode === 'signup') {
        await signUp(email.trim(), password)
        setSuccess('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
        setPassword('')
      } else {
        await signIn(email.trim(), password)
        nav('/dashboard')
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grain page" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(124,108,252,0.12)', top: -120, left: -100 }} />
      <div className="glow-orb" style={{ width: 300, height: 300, background: 'rgba(232,121,249,0.07)', bottom: -80, right: -80 }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="url(#lg-auth)"/>
              <path d="M10 22L16 12L22 20L26 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="lg-auth" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#7c6cfc"/><stop offset="1" stopColor="#e879f9"/></linearGradient></defs>
            </svg>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>QuizRush</span>
          </a>
        </div>

        <div className="card" style={{ animation: 'fadeUp 0.35s ease both' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: 4, marginBottom: '1.75rem' }}>
            {[['signin', 'Sign In'], ['signup', 'Create Account']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => { setMode(val); setError(''); setSuccess('') }}
                style={{
                  flex: 1, padding: '9px', border: 'none', borderRadius: 6,
                  background: mode === val ? 'var(--surface3)' : 'transparent',
                  color: mode === val ? 'var(--text)' : 'var(--text3)',
                  fontWeight: mode === val ? 600 : 400,
                  fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 22, marginBottom: '0.35rem' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>
            {mode === 'signin' ? 'Sign in to access your quizzes and dashboard.' : 'Host unlimited quizzes for free.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="you@college.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          {error && (
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginTop: '1rem', animation: 'shake 0.4s ease' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--green)', fontSize: 13, marginTop: '1rem', animation: 'fadeIn 0.3s ease' }}>
              {success}
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '1.25rem', padding: '13px', fontSize: 15 }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign In →' : 'Create Account →'}
          </button>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginTop: '1.25rem' }}>
          Players don't need an account —{' '}
          <a href="/join" style={{ color: 'var(--accent2)', textDecoration: 'none' }}>join a game here</a>
        </p>
      </div>
    </div>
  )
}
