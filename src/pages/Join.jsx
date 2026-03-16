import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getGameByPin, joinGame } from '../lib/supabase'

export default function Join() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [pin, setPin] = useState(params.get('pin') || '')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState('pin') // pin | name | joining
  const [game, setGame] = useState(null)
  const [error, setError] = useState('')

  async function findGame() {
    setError('')
    if (pin.length !== 4) return setError('Enter a 4-digit PIN.')
    try {
      const g = await getGameByPin(pin.trim())
      if (g.status === 'finished') return setError('This game has already ended.')
      setGame(g)
      setStep('name')
    } catch {
      setError('No game found with that PIN. Double-check and try again.')
    }
  }

  async function joinNow() {
    setError('')
    const nick = nickname.trim()
    if (!nick) return setError('Enter a nickname.')
    if (nick.length > 20) return setError('Nickname too long (max 20 chars).')
    setStep('joining')
    try {
      const player = await joinGame(game.id, nick)
      // Store player id in sessionStorage so PlayerGame can pick it up
      sessionStorage.setItem(`player_${game.id}`, JSON.stringify({ id: player.id, nickname: nick }))
      nav(`/play/${game.id}`)
    } catch (e) {
      setError('Failed to join. The game may have already started.')
      setStep('name')
    }
  }

  return (
    <div className="grain page" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(52,211,153,0.08)', bottom: -100, right: -100 }} />
      <div className="glow-orb" style={{ width: 300, height: 300, background: 'rgba(124,108,252,0.1)', top: -80, left: -80 }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="url(#lg2)"/>
              <path d="M10 22L16 12L22 20L26 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs><linearGradient id="lg2" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#7c6cfc"/><stop offset="1" stopColor="#e879f9"/></linearGradient></defs>
            </svg>
            <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20 }}>QuizRush</span>
          </a>
        </div>

        <div className="card" style={{ animation: 'fadeUp 0.35s ease both' }}>
          {step === 'pin' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 24, marginBottom: '0.5rem' }}>Join a game</h2>
              <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: '1.5rem' }}>Enter the PIN shown on your host's screen.</p>
              <label className="label">Game PIN</label>
              <input
                className="input"
                style={{ fontSize: 28, fontFamily: 'var(--font-head)', fontWeight: 700, letterSpacing: '0.2em', textAlign: 'center' }}
                maxLength={4}
                placeholder="0000"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={e => e.key === 'Enter' && findGame()}
                autoFocus
              />
              {error && <ErrorMsg msg={error} />}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '13px' }} onClick={findGame}>
                Find Game
              </button>
            </>
          )}

          {(step === 'name' || step === 'joining') && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setStep('pin')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                </button>
                <div>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>{game?.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>PIN: {game?.pin}</div>
                </div>
              </div>
              <label className="label">Your Nickname</label>
              <input
                className="input"
                style={{ fontSize: 18, fontWeight: 500 }}
                maxLength={20}
                placeholder="e.g. Kaustuv 🔥"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && joinNow()}
                autoFocus
                disabled={step === 'joining'}
              />
              {error && <ErrorMsg msg={error} />}
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '13px' }} onClick={joinNow} disabled={step === 'joining'}>
                {step === 'joining' ? 'Joining...' : "Let's Go →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorMsg({ msg }) {
  return (
    <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--red)', fontSize: 13, marginTop: 10, animation: 'shake 0.4s ease' }}>
      {msg}
    </div>
  )
}
