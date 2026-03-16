import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, setCurrentQuestion, endGame, getPlayers, getGameForHost } from '../lib/supabase'
import Podium from '../components/Podium'
import ConnectionGuard from '../components/ConnectionGuard'

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_COLORS = ['#7c6cfc', '#34d399', '#fbbf24', '#f87171']

export default function HostGame() {
  const { gameId } = useParams()
  const nav = useNavigate()
  const [game, setGame] = useState(null)
  const [qIndex, setQIndex] = useState(0)
  const [phase, setPhase] = useState('pre') // pre | question | reveal | leaderboard | podium
  const [timeLeft, setTimeLeft] = useState(0)
  const [answers, setAnswers] = useState([])
  const [players, setPlayers] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const timerRef = useRef(null)
  const answerChannelRef = useRef(null)
  const startingRef = useRef(false)  // guard against double-click on Start Question

  useEffect(() => {
    getGameForHost(gameId).then(data => {
      if (data) {
        setGame(data)
        // Resume: if game was already playing, restore state
        if (data.status === 'playing' && data.current_question_index >= 0) {
          setQIndex(data.current_question_index)
          setPhase('pre') // host must manually advance from here
        }
      }
    })
    refreshPlayers()
  }, [gameId])

  async function refreshPlayers() {
    const p = await getPlayers(gameId)
    setPlayers(p)
    setLeaderboard(p)
  }

  function currentQuestion(idx) {
    if (!game) return null
    return game.questions[idx ?? qIndex]
  }

  async function startQuestion() {
    if (startingRef.current) return  // prevent double-click
    startingRef.current = true
    const now = new Date().toISOString()
    try {
    await setCurrentQuestion(gameId, qIndex, now)
    setAnswers([])
    setPhase('question')
    setTimeLeft(game.time_per_question)

    // Unsubscribe old channel if any
    if (answerChannelRef.current) supabase.removeChannel(answerChannelRef.current)

    const channel = supabase
      .channel(`answers:${gameId}:${qIndex}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers', filter: `game_id=eq.${gameId}` },
        payload => { if (payload.new.question_index === qIndex) setAnswers(a => [...a, payload.new]) })
      .subscribe()
    answerChannelRef.current = channel

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          supabase.removeChannel(channel)
          setPhase('reveal')
          refreshPlayers()
          return 0
        }
        return t - 1
      })
    }, 1000)
    } catch(e) { console.error('startQuestion error:', e) }
    finally { startingRef.current = false }
  }

  function advanceAfterReveal() {
    const nextIdx = qIndex + 1
    const showLB = (qIndex + 1) % game.leaderboard_interval === 0
    const isLast = nextIdx >= game.questions.length

    if (isLast) {
      finishGame()
    } else if (showLB) {
      setPhase('leaderboard')
      refreshPlayers()
    } else {
      setQIndex(nextIdx)
      setPhase('pre')
    }
  }

  function advanceAfterLeaderboard() {
    const nextIdx = qIndex + 1
    if (nextIdx >= game.questions.length) {
      finishGame()
    } else {
      setQIndex(nextIdx)
      setPhase('pre')
    }
  }

  async function finishGame() {
    await endGame(gameId)
    await refreshPlayers()
    setPhase('podium')
  }

  function skipTimer() {
    clearInterval(timerRef.current)
    if (answerChannelRef.current) supabase.removeChannel(answerChannelRef.current)
    setPhase('reveal')
    refreshPlayers()
  }

  const q = currentQuestion()
  const pct = answers.length && players.length ? Math.round(answers.length / players.length * 100) : 0
  const timePct = game ? timeLeft / game.time_per_question * 100 : 100

  function getDistribution() {
    if (!q) return []
    return q.options.map((opt, i) => ({
      label: OPTION_LABELS[i],
      text: opt,
      count: answers.filter(a => a.answer === String(i)).length,
      isCorrect: q.correct === i,
    }))
  }
  const dist = getDistribution()
  const maxCount = Math.max(...dist.map(d => d.count), 1)

  if (!game) return <LoadingScreen />

  // ── PODIUM (final) ────────────────────────────────────────
  if (phase === 'podium') {
    return (
      <div className="grain" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
        <div className="glow-orb" style={{ width: 500, height: 500, background: 'rgba(245,197,66,0.08)', top: -150, left: '50%', transform: 'translateX(-50%)' }} />
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem', position: 'relative', zIndex: 1 }}>
          <Podium players={leaderboard} onContinue={() => nav('/dashboard')} />
        </div>
      </div>
    )
  }

  return (
    <div className="grain" style={{ minHeight: '100vh', padding: '1.5rem 1rem', position: 'relative', overflow: 'hidden' }}>
      <ConnectionGuard gameId={gameId} />
      <div className="glow-orb" style={{ width: 500, height: 500, background: 'rgba(124,108,252,0.08)', top: -200, right: -100 }} />
      <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 18 }}>{game.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>PIN: <strong style={{ color: 'var(--accent2)' }}>{game.pin}</strong></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13 }}>{players.length} players</span>
            <span className="badge" style={{ background: 'var(--surface2)', color: 'var(--text2)', fontSize: 13 }}>Q{qIndex + 1}/{game.questions.length}</span>
          </div>
        </div>

        {/* ── PRE ── */}
        {phase === 'pre' && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem', animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, color: 'var(--accent2)', marginBottom: 12 }}>UP NEXT — QUESTION {qIndex + 1}</div>
            <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 1.8rem)', marginBottom: '2rem', maxWidth: 600, margin: '0 auto 2rem' }}>{q?.text}</h2>
            <button className="btn btn-primary" style={{ fontSize: 16, padding: '14px 40px' }} onClick={startQuestion}>Start Question</button>
          </div>
        )}

        {/* ── QUESTION ── */}
        {phase === 'question' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${timePct}%`, transition: 'width 1s linear, background 0.3s',
                  background: timePct > 50 ? 'var(--green)' : timePct > 20 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 24, minWidth: 36, textAlign: 'right',
                color: timePct > 50 ? 'var(--green)' : timePct > 20 ? 'var(--amber)' : 'var(--red)' }}>{timeLeft}</div>
            </div>

            <div className="card"><h2 style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)', lineHeight: 1.4 }}>{q?.text}</h2></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {q?.options.map((opt, i) => (
                <div key={i} className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 6, background: OPTION_COLORS[i] + '33', color: OPTION_COLORS[i], fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{OPTION_LABELS[i]}</span>
                  <span style={{ fontSize: 14 }}>{opt}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: '1rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Answers received</span>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700 }}>{answers.length} / {players.length}</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent-g)', borderRadius: 99, width: `${pct}%`, transition: 'width 0.4s' }} />
              </div>
            </div>

            <button className="btn btn-ghost" onClick={skipTimer}>Skip timer & reveal</button>
          </div>
        )}

        {/* ── REVEAL ── */}
        {phase === 'reveal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', animation: 'fadeUp 0.3s ease both' }}>
            <div className="card">
              <h2 style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)', marginBottom: '1.5rem' }}>{q?.text}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dist.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                      background: d.isCorrect ? 'rgba(52,211,153,0.2)' : 'var(--surface3)',
                      border: d.isCorrect ? '1px solid var(--green)' : '1px solid var(--border)',
                      color: d.isCorrect ? 'var(--green)' : 'var(--text2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                      {d.isCorrect ? '✓' : OPTION_LABELS[i]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, marginBottom: 4, color: d.isCorrect ? 'var(--green)' : 'var(--text)' }}>{d.text}</div>
                      <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 99, background: d.isCorrect ? 'var(--green)' : OPTION_COLORS[i] + '80',
                          width: `${(d.count / maxCount) * 100}%`, transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 24, textAlign: 'right', color: d.isCorrect ? 'var(--green)' : 'var(--text2)' }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={advanceAfterReveal} style={{ width: '100%' }}>
              {qIndex + 1 < game.questions.length ? 'Next Question →' : 'Finish & Show Results →'}
            </button>
          </div>
        )}

        {/* ── MID-GAME LEADERBOARD ── */}
        {phase === 'leaderboard' && (
          <MidLeaderboard players={leaderboard} qIndex={qIndex} total={game.questions.length} onNext={advanceAfterLeaderboard} />
        )}
      </div>
    </div>
  )
}

function MidLeaderboard({ players, qIndex, total, onNext }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const MEDALS = ['🥇', '🥈', '🥉']
  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'var(--font-head)', fontSize: 13, color: 'var(--accent2)', marginBottom: 4 }}>AFTER QUESTION {qIndex + 1} OF {total}</div>
        <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 28 }}>Leaderboard</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1.5rem' }}>
        {sorted.slice(0, 10).map((p, i) => (
          <div key={p.id} className="card" style={{
            padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: 16,
            background: i === 0 ? 'rgba(245,197,66,0.08)' : i === 1 ? 'rgba(176,190,197,0.06)' : i === 2 ? 'rgba(205,127,50,0.06)' : 'var(--surface)',
            border: i === 0 ? '1px solid rgba(245,197,66,0.3)' : '1px solid var(--border)',
            animation: 'slideIn 0.4s ease both', animationDelay: `${i * 0.05}s`,
          }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18, minWidth: 32, textAlign: 'center' }}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</div>
            <div style={{ flex: 1, fontWeight: 500 }}>{p.nickname}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 18 }}>{p.score.toLocaleString()}</div>
              {p.streak > 1 && <div style={{ fontSize: 11, color: 'var(--amber)' }}>🔥 {p.streak} streak</div>}
            </div>
          </div>
        ))}
        {sorted.length > 10 && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)', padding: '0.5rem' }}>+{sorted.length - 10} more</div>}
      </div>
      <button className="btn btn-primary" style={{ width: '100%', fontSize: 16, padding: '14px' }} onClick={onNext}>Next Question →</button>
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
