import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  supabase, withRetry, submitAnswerSecure, getGameForPlayer,
  rejoinGame, getMyAnswer
} from '../lib/supabase'
import Confetti from '../components/Confetti'

const OPTION_LABELS = ['A', 'B', 'C', 'D']
const OPTION_COLORS = ['#7c6cfc', '#34d399', '#fbbf24', '#f87171']
const OPTION_BG    = ['rgba(124,108,252,0.15)', 'rgba(52,211,153,0.15)', 'rgba(251,191,36,0.15)', 'rgba(248,113,113,0.15)']

const SESSION_KEY  = (id) => `qr_player_${id}`
const saveSession  = (id, d) => { try { localStorage.setItem(SESSION_KEY(id), JSON.stringify(d)) } catch {} }
const loadSession  = (id)    => { try { const s = localStorage.getItem(SESSION_KEY(id)); return s ? JSON.parse(s) : null } catch { return null } }
const clearSession = (id)    => { try { localStorage.removeItem(SESSION_KEY(id)) } catch {} }

export default function PlayerGame() {
  const { gameId } = useParams()
  const nav = useNavigate()

  const [game, setGame]             = useState(null)
  const [player, setPlayer]         = useState(null)
  const [phase, setPhase]           = useState('connecting')
  // phases: connecting | lobby | question | locked | waiting | finished

  const [currentQ, setCurrentQ]           = useState(null)
  const [qIndex, setQIndex]               = useState(-1)
  const [timeLeft, setTimeLeft]           = useState(0)
  const [selectedOption, setSelectedOption] = useState(null)
  const [scoreResult, setScoreResult]     = useState(null)
  const [submitError, setSubmitError]     = useState(false)
  const [totalScore, setTotalScore]       = useState(0)
  const [streak, setStreak]               = useState(0)
  const [scoreFloat, setScoreFloat]       = useState(false)
  const [showConfetti, setShowConfetti]   = useState(false)
  const [finalRank, setFinalRank]         = useState(null)
  const [topPlayers, setTopPlayers]       = useState([])

  const playerRef   = useRef(null)
  const scoreRef    = useRef(0)
  const streakRef   = useRef(0)
  const answeredRef = useRef(false)
  const startedAtRef = useRef(null)
  const timerRef    = useRef(null)
  const channelRef  = useRef(null)
  const gameRef     = useRef(null)
  const qIndexRef   = useRef(-1)

  useEffect(() => {
    initPlayer()
    return () => {
      clearInterval(timerRef.current)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [gameId])

  async function initPlayer() {
    let p = null
    const session = sessionStorage.getItem(`player_${gameId}`)
    if (session) { try { p = JSON.parse(session) } catch {} }

    if (!p) {
      const stored = loadSession(gameId)
      if (stored?.id) {
        const existing = await rejoinGame(gameId, stored.id)
        if (existing) {
          p = { id: existing.id, nickname: existing.nickname }
          scoreRef.current  = existing.score
          streakRef.current = existing.streak
          setTotalScore(existing.score)
          setStreak(existing.streak)
        }
      }
    }

    if (!p) { nav('/join'); return }

    playerRef.current = p
    setPlayer(p)
    sessionStorage.setItem(`player_${gameId}`, JSON.stringify(p))
    saveSession(gameId, p)

    const g = await getGameForPlayer(gameId)
    if (!g) { nav('/'); return }
    gameRef.current = g
    setGame(g)

    if (g.status === 'finished') {
      await loadFinalResults()
      setPhase('finished')
      clearSession(gameId)
      return
    }

    if (g.status === 'playing' && g.current_question_index >= 0) {
      const prev = await getMyAnswer(gameId, p.id, g.current_question_index)
      if (prev) {
        answeredRef.current = true
        qIndexRef.current   = g.current_question_index
        setQIndex(g.current_question_index)
        setCurrentQ(g.questions[g.current_question_index])
        setSelectedOption(parseInt(prev.answer))
        setScoreResult({ is_correct: prev.is_correct, points_earned: prev.points_earned })
        setPhase('locked')
      } else {
        handleNewQuestion(g, g.current_question_index, g.question_started_at)
      }
    } else {
      setPhase('lobby')
    }

    // Single shared channel — all players same name = 1 server subscription
    const channel = supabase
      .channel(`game_state:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public',
        table: 'games', filter: `id=eq.${gameId}`,
      }, async (payload) => {
        const raw = payload.new

        if (raw.status === 'finished') {
          clearInterval(timerRef.current)
          await loadFinalResults()
          setPhase('finished')
          clearSession(gameId)
          return
        }

        if (raw.status === 'playing') {
          const newIdx = raw.current_question_index
          if (newIdx >= 0 && newIdx !== qIndexRef.current) {
            const q = gameRef.current?.questions?.[newIdx]
            if (q) {
              const prev = await getMyAnswer(gameId, playerRef.current.id, newIdx)
              if (prev) {
                answeredRef.current = true
                qIndexRef.current   = newIdx
                setQIndex(newIdx)
                setCurrentQ(q)
                setSelectedOption(parseInt(prev.answer))
                setScoreResult({ is_correct: prev.is_correct, points_earned: prev.points_earned })
                setPhase('locked')
              } else {
                handleNewQuestion(
                  { ...gameRef.current, time_per_question: raw.time_per_question, question_started_at: raw.question_started_at },
                  newIdx,
                  raw.question_started_at
                )
              }
            } else {
              const freshG = await getGameForPlayer(gameId)
              if (freshG) { gameRef.current = freshG; setGame(freshG) }
              handleNewQuestion(
                { ...gameRef.current, time_per_question: raw.time_per_question, question_started_at: raw.question_started_at },
                newIdx,
                raw.question_started_at
              )
            }
          }
        }
      })
      .subscribe()

    channelRef.current = channel
  }

  function handleNewQuestion(g, idx, startedAt) {
    clearInterval(timerRef.current)
    answeredRef.current = false
    startedAtRef.current = new Date(startedAt).getTime()
    qIndexRef.current = idx

    setCurrentQ(g.questions[idx])
    setQIndex(idx)
    setSelectedOption(null)
    setScoreResult(null)
    setSubmitError(false)
    setPhase('question')

    // Timer runs fully client-side — no dependency on host after question starts
    const elapsed   = Date.now() - startedAtRef.current
    const remaining = Math.max(0, g.time_per_question - Math.floor(elapsed / 1000))
    setTimeLeft(remaining)

    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          setPhase(p => p === 'question' ? 'waiting' : p)
          return 0
        }
        return t - 1
      })
    }, 1000)
  }

  async function handleAnswer(optionIndex) {
    if (answeredRef.current || phase !== 'question') return
    answeredRef.current = true
    clearInterval(timerRef.current)

    setSelectedOption(optionIndex)
    setPhase('locked')
    setSubmitError(false)

    try {
      const result = await withRetry(
        () => submitAnswerSecure({ gameId, playerId: playerRef.current.id, questionIndex: qIndexRef.current, answer: optionIndex }),
        4, 400
      )
      scoreRef.current  = result.new_score
      streakRef.current = result.new_streak
      setTotalScore(result.new_score)
      setStreak(result.new_streak)
      setScoreResult(result)
      if (result.points_earned > 0) {
        setScoreFloat(true)
        setTimeout(() => setScoreFloat(false), 1200)
      }
    } catch (err) {
      setSubmitError(true)
      setTimeout(async () => {
        try {
          const result = await submitAnswerSecure({ gameId, playerId: playerRef.current.id, questionIndex: qIndexRef.current, answer: optionIndex })
          scoreRef.current  = result.new_score
          streakRef.current = result.new_streak
          setTotalScore(result.new_score)
          setStreak(result.new_streak)
          setScoreResult(result)
          setSubmitError(false)
        } catch {}
      }, 3000)
    }
  }

  async function loadFinalResults() {
    const { data } = await supabase
      .from('players').select('*').eq('game_id', gameId).order('score', { ascending: false })
    if (data) {
      setTopPlayers(data)
      const rank = data.findIndex(p => p.id === playerRef.current?.id) + 1
      setFinalRank(rank)
      if (rank >= 1 && rank <= 3) {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 7000)
      }
    }
  }

  const timePct = gameRef.current
    ? (timeLeft / gameRef.current.time_per_question) * 100
    : 100

  if (phase === 'connecting') return <Waiting text="Connecting..." />
  if (!game || !player)       return <Waiting text="Connecting..." />
  if (phase === 'lobby')      return <Waiting text="Waiting for host to start..." subtitle={game.title} pin={game.pin} nickname={player.nickname} />
  if (phase === 'finished')   return <FinishedScreen players={topPlayers} playerId={player.id} rank={finalRank} score={totalScore} showConfetti={showConfetti} onHome={() => nav('/')} />

  return (
    <div className="grain" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 300, height: 300, background: 'rgba(124,108,252,0.1)', top: -100, right: -80 }} />

      {/* Header */}
      <div style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
          {player.nickname}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {streak > 1 && <div style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>🔥 {streak}</div>}
          <div style={{ position: 'relative' }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>{totalScore.toLocaleString()}</div>
            {scoreFloat && scoreResult?.points_earned > 0 && (
              <div style={{ position: 'absolute', top: -8, right: 0, fontSize: 13, fontWeight: 700, color: 'var(--green)', animation: 'scoreFloat 1.2s ease forwards', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                +{scoreResult.points_earned}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timer bar */}
      {(phase === 'question' || phase === 'locked') && (
        <div style={{ height: 4, background: 'var(--surface2)' }}>
          <div style={{ height: '100%', width: `${timePct}%`, transition: 'width 1s linear, background 0.3s', background: timePct > 50 ? 'var(--green)' : timePct > 20 ? 'var(--amber)' : 'var(--red)' }} />
        </div>
      )}

      {/* Saving banner — only when DB write is retrying */}
      {submitError && (
        <div style={{ background: 'rgba(251,191,36,0.12)', borderBottom: '1px solid rgba(251,191,36,0.25)', padding: '7px 16px', fontSize: 12, color: 'var(--amber)', textAlign: 'center' }}>
          Saving answer... (slow connection)
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>

        {currentQ && (
          <div style={{ marginBottom: '1.25rem', animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Question {qIndex + 1} of {game.questions.length}
            </div>
            <h2 style={{ fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', lineHeight: 1.4, fontFamily: 'var(--font-head)', fontWeight: 700 }}>
              {currentQ.text}
            </h2>
          </div>
        )}

        {currentQ && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
            {currentQ.options.map((opt, i) => {
              const isSelected = selectedOption === i
              const isLocked   = phase === 'locked' || phase === 'waiting'
              let borderColor  = 'var(--border2)', bgColor = 'var(--surface)', textColor = 'var(--text)'
              if (isSelected) { borderColor = OPTION_COLORS[i]; bgColor = OPTION_BG[i] }
              else if (isLocked) { textColor = 'var(--text3)' }

              return (
                <button key={i} onClick={() => handleAnswer(i)} disabled={phase !== 'question'}
                  style={{
                    background: bgColor, border: `1.5px solid ${borderColor}`,
                    borderRadius: 'var(--radius)', padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: 14,
                    cursor: phase === 'question' ? 'pointer' : 'default',
                    transition: 'border-color 0.15s, background 0.15s',
                    textAlign: 'left', color: textColor,
                    opacity: isLocked && !isSelected ? 0.45 : 1,
                    animation: 'pop 0.3s ease both', animationDelay: `${i * 0.05}s`,
                  }}>
                  <span style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, fontFamily: 'var(--font-head)', background: isSelected ? OPTION_BG[i] : 'var(--surface3)', color: isSelected ? OPTION_COLORS[i] : 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                    {OPTION_LABELS[i]}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{opt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Locked — answer saved, score shown, no correct/wrong */}
        {phase === 'locked' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius)', background: 'var(--surface2)', border: '1px solid var(--border2)', animation: 'pop 0.4s ease both' }}>
            {scoreResult ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Answer locked ✓</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Waiting for next question</div>
                  {streak > 1 && <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 3 }}>🔥 {streak} streak</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16 }}>{totalScore.toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>total pts</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: 'var(--text2)' }}>Saving...</span>
              </div>
            )}
          </div>
        )}

        {phase === 'waiting' && (
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', animation: 'pop 0.4s ease both', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--red)', fontWeight: 500 }}>⏰ Time's up</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>Waiting for next question</div>
          </div>
        )}
      </div>
    </div>
  )
}

function Waiting({ text, subtitle, pin, nickname }) {
  return (
    <div className="grain page" style={{ position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(124,108,252,0.1)', top: -100, left: -100 }} />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1, animation: 'fadeUp 0.4s ease both' }}>
        {nickname && <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Hey, {nickname}!</div>}
        {subtitle  && <div style={{ color: 'var(--accent2)', fontSize: 14, marginBottom: '1.5rem' }}>{subtitle}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: '0.5rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent)', opacity: 0.25, animation: 'pulse-ring 1.5s ease-out infinite' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', position: 'relative' }} />
          </div>
          <span style={{ color: 'var(--text2)', fontSize: 15 }}>{text}</span>
        </div>
        {pin && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>PIN: <strong style={{ color: 'var(--text2)' }}>{pin}</strong></div>}
      </div>
    </div>
  )
}

function FinishedScreen({ players, playerId, rank, score, showConfetti, onHome }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const MEDALS = ['🥇', '🥈', '🥉']
  const topEmoji = rank <= 3 ? MEDALS[rank - 1] : rank <= 10 ? '🏅' : '🏁'
  return (
    <div className="grain page" style={{ justifyContent: 'flex-start', paddingTop: '2rem', position: 'relative', overflow: 'hidden' }}>
      <Confetti active={showConfetti} />
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(245,197,66,0.06)', top: -100, left: '50%', transform: 'translateX(-50%)' }} />
      <div style={{ width: '100%', maxWidth: 500, position: 'relative', zIndex: 1, animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: 48, marginBottom: 8, animation: 'pop 0.6s ease both' }}>{topEmoji}</div>
          <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 28, marginBottom: 6 }}>Game Over!</h2>
          <div style={{ color: 'var(--text2)', fontSize: 15 }}>
            You finished <strong style={{ color: 'var(--accent2)', fontFamily: 'var(--font-head)', fontSize: 18 }}>#{rank}</strong>{' '}
            with <strong style={{ color: 'var(--text)' }}>{score.toLocaleString()} pts</strong>
          </div>
          {rank <= 3 && <div style={{ color: 'var(--gold)', fontSize: 13, marginTop: 6 }}>🎉 Top 3 finish!</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '2rem' }}>
          {sorted.slice(0, 8).map((p, i) => (
            <div key={p.id} className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: 12, border: p.id === playerId ? '1px solid var(--accent)' : '1px solid var(--border)', background: p.id === playerId ? 'rgba(124,108,252,0.08)' : 'var(--surface)', animation: 'slideIn 0.4s ease both', animationDelay: `${i * 0.05}s` }}>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, minWidth: 28, textAlign: 'center' }}>{i < 3 ? MEDALS[i] : `#${i + 1}`}</span>
              <span style={{ flex: 1, fontWeight: p.id === playerId ? 600 : 400 }}>{p.nickname}</span>
              <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700 }}>{p.score.toLocaleString()}</span>
            </div>
          ))}
          {sorted.length > 8 && <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>+{sorted.length - 8} more players</div>}
        </div>
        <button className="btn btn-primary" style={{ width: '100%', padding: '13px' }} onClick={onHome}>Back to Home</button>
      </div>
    </div>
  )
}
