import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, updateGameStatus } from '../lib/supabase'

export default function HostLobby() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('games').select('*').eq('id', gameId).single()
      if (error || !data) { nav('/'); return }
      setGame(data)
      setLoading(false)
    }
    load()

    // Subscribe to players joining
    const channel = supabase
      .channel(`lobby:${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `game_id=eq.${gameId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            setPlayers(p => [...p, payload.new])
          }
          if (payload.eventType === 'DELETE') {
            setPlayers(p => p.filter(pp => pp.id !== payload.old.id))
          }
        })
      .subscribe()

    // Initial load of players
    supabase.from('players').select('*').eq('game_id', gameId).then(({ data }) => {
      if (data) setPlayers(data)
    })

    return () => supabase.removeChannel(channel)
  }, [gameId])

  async function startGame() {
    setStarting(true)
    await updateGameStatus(gameId, 'playing')
    nav(`/host/${gameId}/play`)
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="grain page" style={{ justifyContent: 'flex-start', paddingTop: '3rem', position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 500, height: 500, background: 'rgba(124,108,252,0.1)', top: -200, left: -150 }} />

      <div style={{ width: '100%', maxWidth: 800, position: 'relative', zIndex: 1 }}>
        {/* PIN display */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', animation: 'fadeUp 0.4s ease both' }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>Join at <strong style={{ color: 'var(--accent2)' }}>quizrush.vercel.app</strong> with PIN</p>
          <div style={{
            display: 'inline-block',
            fontFamily: 'var(--font-head)',
            fontSize: 'clamp(3rem, 10vw, 5.5rem)',
            fontWeight: 800,
            letterSpacing: '0.15em',
            background: 'var(--accent-g)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            padding: '0.25rem 0',
          }}>
            {game?.pin}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>{game?.title}</p>
        </div>

        {/* Player count + start */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'var(--green)', opacity: 0.3,
                animation: 'pulse-ring 1.5s ease-out infinite'
              }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--green)', position: 'relative' }} />
            </div>
            <span style={{ fontSize: 15, color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-head)' }}>{players.length}</strong> players in lobby
            </span>
          </div>
          <button
            className="btn btn-primary"
            onClick={startGame}
            disabled={players.length === 0 || starting}
            style={{ padding: '10px 28px' }}
          >
            {starting ? 'Starting...' : 'Start Game →'}
          </button>
        </div>

        {/* Player grid */}
        <div className="card" style={{ minHeight: 200 }}>
          {players.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
              <p>Waiting for players to join...</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Share the PIN above</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {players.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--surface2)',
                    border: '1px solid var(--border)',
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontSize: 14,
                    fontWeight: 500,
                    animation: 'pop 0.3s ease both',
                    animationDelay: `${Math.min(i * 0.03, 0.5)}s`,
                  }}
                >
                  {p.nickname}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Game info */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '1.5rem' }}>
          {[
            ['Questions', game?.questions?.length || 0],
            ['Time/Q', `${game?.time_per_question}s`],
            ['LB every', `${game?.leaderboard_interval}Q`],
          ].map(([lbl, val]) => (
            <div key={lbl} className="card" style={{ textAlign: 'center', padding: '1rem' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 22 }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="page">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text2)' }}>Loading game...</p>
      </div>
    </div>
  )
}
