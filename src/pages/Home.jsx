import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const nav = useNavigate()
  const { user } = useAuth()

  return (
    <div className="page grain" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 500, height: 500, background: 'rgba(124,108,252,0.12)', top: -150, left: -100 }} />
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(232,121,249,0.08)', bottom: -100, right: -80 }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 560, animation: 'fadeUp 0.5s ease both' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: '2.5rem' }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="url(#lg)" />
            <path d="M10 22L16 12L22 20L26 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="36" y2="36">
                <stop stopColor="#7c6cfc"/><stop offset="1" stopColor="#e879f9"/>
              </linearGradient>
            </defs>
          </svg>
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>QuizRush</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '1.25rem' }}>
          Campus quizzes,{' '}
          <span style={{ background: 'var(--accent-g)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            next level.
          </span>
        </h1>

        <p style={{ fontSize: 17, color: 'var(--text2)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Run live MCQ battles for up to 250 players.<br />
          Real-time leaderboards. Speed scoring. Zero cost.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {user ? (
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => nav('/dashboard')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Go to Dashboard
            </button>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => nav('/auth')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Host a Game
            </button>
          )}
          <button className="btn btn-ghost" style={{ fontSize: 16, padding: '14px 32px' }} onClick={() => nav('/join')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
            Join a Game
          </button>
        </div>

        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid var(--border)' }}>
          {[['250', 'Max Players'], ['Real-time', 'Leaderboard'], ['Free', 'Forever']].map(([val, lbl]) => (
            <div key={lbl} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20 }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
