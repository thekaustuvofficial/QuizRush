import React, { useEffect, useState } from 'react'
import Confetti from './Confetti'

const PODIUM_HEIGHTS = [180, 130, 100] // 1st, 2nd, 3rd
const PODIUM_COLORS = [
  { bar: '#f5c542', glow: 'rgba(245,197,66,0.35)', badge: '🥇' },
  { bar: '#b0bec5', glow: 'rgba(176,190,197,0.25)', badge: '🥈' },
  { bar: '#cd7f32', glow: 'rgba(205,127,50,0.25)', badge: '🥉' },
]
// Podium display order: 2nd, 1st, 3rd (left to right)
const DISPLAY_ORDER = [1, 0, 2]

export default function Podium({ players, onContinue }) {
  const [revealed, setRevealed] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const top3 = players.slice(0, 3)

  useEffect(() => {
    // Stagger reveal for drama
    const t1 = setTimeout(() => setRevealed(true), 400)
    const t2 = setTimeout(() => setShowConfetti(true), 900)
    const t3 = setTimeout(() => setShowConfetti(false), 6000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '2rem 1rem', position: 'relative' }}>
      <Confetti active={showConfetti} />

      <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, color: 'var(--accent2)', letterSpacing: '0.08em', marginBottom: 8 }}>
        FINAL RESULTS
      </div>
      <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: '3rem' }}>
        🏆 That's a wrap!
      </h2>

      {/* Podium bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: '2.5rem', minHeight: 260 }}>
        {DISPLAY_ORDER.map((rank, col) => {
          const player = top3[rank]
          if (!player) return <div key={col} style={{ width: 120 }} />
          const { bar, glow, badge } = PODIUM_COLORS[rank]
          const height = PODIUM_HEIGHTS[rank]
          const delay = [0.6, 0.2, 1.0][col] // 2nd reveals first, then 1st, then 3rd

          return (
            <div key={col} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 120 }}>
              {/* Player info above bar */}
              <div style={{
                opacity: revealed ? 1 : 0,
                transform: revealed ? 'translateY(0)' : 'translateY(10px)',
                transition: `opacity 0.5s ease ${delay + 0.1}s, transform 0.5s ease ${delay + 0.1}s`,
                marginBottom: 10,
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{badge}</div>
                <div style={{
                  fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 15,
                  color: bar, maxWidth: 110, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {player.nickname}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 2 }}>
                  {player.score.toLocaleString()} pts
                </div>
              </div>

              {/* Bar */}
              <div style={{
                width: '100%',
                height: revealed ? height : 0,
                background: bar,
                borderRadius: '8px 8px 0 0',
                transition: `height 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s`,
                boxShadow: revealed ? `0 0 30px ${glow}` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: 'var(--font-head)', fontWeight: 800,
                  fontSize: rank === 0 ? 28 : 22,
                  color: rank === 0 ? '#1a1a00' : '#0a0a0f',
                  opacity: revealed ? 1 : 0,
                  transition: `opacity 0.3s ease ${delay + 0.5}s`,
                }}>
                  #{rank + 1}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Remaining players */}
      {players.length > 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 500, margin: '0 auto 2rem', animation: `fadeUp 0.5s ease ${revealed ? '1.2s' : '99s'} both` }}>
          {players.slice(3, 8).map((p, i) => (
            <div key={p.id} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-head)', fontWeight: 700, minWidth: 28 }}>#{i + 4}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{p.nickname}</span>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14 }}>{p.score.toLocaleString()}</span>
            </div>
          ))}
          {players.length > 8 && (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              +{players.length - 8} more players
            </div>
          )}
        </div>
      )}

      <button
        className="btn btn-ghost"
        style={{ marginTop: '0.5rem' }}
        onClick={onContinue}
      >
        Back to Dashboard
      </button>
    </div>
  )
}
