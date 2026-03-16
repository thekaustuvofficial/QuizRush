import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase, createGame } from '../lib/supabase'

const STATUS_STYLE = {
  lobby:    { bg: 'rgba(124,108,252,0.15)', color: '#a78bfa', label: 'In Lobby' },
  playing:  { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: 'Live Now' },
  finished: { bg: 'rgba(255,255,255,0.06)', color: '#5a5a7a', label: 'Finished' },
}

export default function Dashboard() {
  const nav = useNavigate()
  const { user, signOut } = useAuth()
  const [quizzes, setQuizzes] = useState([])
  const [loading, setLoading] = useState(true)
  const [relaunching, setRelaunching] = useState(null)

  useEffect(() => {
    if (!user) { nav('/auth'); return }
    loadQuizzes()

    // Realtime: refresh list if any game status changes
    const channel = supabase
      .channel('dashboard:games')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `host_id=eq.${user.id}` },
        () => loadQuizzes())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  async function loadQuizzes() {
    const { data, error } = await supabase
      .from('games')
      .select('*, players(count)')
      .eq('host_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setQuizzes(data)
    setLoading(false)
  }

  async function handleRelaunch(quiz) {
    setRelaunching(quiz.id)
    try {
      // Create a fresh game session with same questions/settings
      const newGame = await createGame({
        title: quiz.title,
        questions: quiz.questions,
        leaderboard_interval: quiz.leaderboard_interval,
        time_per_question: quiz.time_per_question,
        hostId: user.id,
      })
      nav(`/host/${newGame.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setRelaunching(null)
    }
  }

  async function handleJoinActive(quiz) {
    if (quiz.status === 'lobby') nav(`/host/${quiz.id}`)
    else if (quiz.status === 'playing') nav(`/host/${quiz.id}/play`)
  }

  async function handleDelete(quizId) {
    if (!window.confirm('Delete this quiz? This cannot be undone.')) return
    await supabase.from('games').delete().eq('id', quizId).eq('host_id', user.id)
    setQuizzes(q => q.filter(g => g.id !== quizId))
  }

  async function handleSignOut() {
    await signOut()
    nav('/')
  }

  const liveCount = quizzes.filter(q => q.status === 'playing' || q.status === 'lobby').length

  return (
    <div className="grain" style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 500, height: 500, background: 'rgba(124,108,252,0.07)', top: -150, right: -100 }} />

      {/* Nav */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="url(#lg-dash)"/>
            <path d="M10 22L16 12L22 20L26 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs><linearGradient id="lg-dash" x1="0" y1="0" x2="36" y2="36"><stop stopColor="#7c6cfc"/><stop offset="1" stopColor="#e879f9"/></linearGradient></defs>
          </svg>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 18 }}>QuizRush</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>{user?.email}</span>
          <button className="btn btn-ghost" style={{ padding: '7px 14px', fontSize: 13 }} onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2.5rem 1.5rem', position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', marginBottom: 4 }}>
              Your Quizzes
            </h1>
            <p style={{ color: 'var(--text2)', fontSize: 14 }}>
              {quizzes.length} quiz{quizzes.length !== 1 ? 'zes' : ''} total
              {liveCount > 0 && <span style={{ color: 'var(--green)', marginLeft: 8 }}>· {liveCount} active</span>}
            </p>
          </div>
          <button className="btn btn-primary" style={{ padding: '11px 24px' }} onClick={() => nav('/create')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            New Quiz
          </button>
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            ['Total Quizzes', quizzes.length],
            ['Active Now', liveCount],
            ['Finished', quizzes.filter(q => q.status === 'finished').length],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.1rem 1.25rem' }}>
              <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 26 }}>{val}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Quiz list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : quizzes.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>No quizzes yet</h3>
            <p style={{ color: 'var(--text2)', marginBottom: '1.5rem', fontSize: 14 }}>Create your first quiz and run it live with your class or campus.</p>
            <button className="btn btn-primary" onClick={() => nav('/create')}>Create Your First Quiz</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {quizzes.map((quiz, i) => {
              const s = STATUS_STYLE[quiz.status] || STATUS_STYLE.finished
              const playerCount = quiz.players?.[0]?.count ?? 0
              const isActive = quiz.status === 'lobby' || quiz.status === 'playing'
              return (
                <div
                  key={quiz.id}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                    animation: 'fadeUp 0.3s ease both',
                    animationDelay: `${i * 0.04}s`,
                    border: isActive ? '1px solid rgba(124,108,252,0.35)' : '1px solid var(--border)',
                    background: isActive ? 'rgba(124,108,252,0.04)' : 'var(--surface)',
                  }}
                >
                  {/* Status dot */}
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0, boxShadow: isActive ? `0 0 8px ${s.color}` : 'none' }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 16, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {quiz.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{quiz.questions?.length || 0} questions</span>
                      <span>{quiz.time_per_question}s per Q</span>
                      {playerCount > 0 && <span>{playerCount} players</span>}
                      <span>PIN: <strong style={{ color: 'var(--text2)' }}>{quiz.pin}</strong></span>
                      <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 12 }}>
                    {s.label}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {isActive ? (
                      <button className="btn btn-primary" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => handleJoinActive(quiz)}>
                        Rejoin →
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '7px 16px', fontSize: 13 }}
                        onClick={() => handleRelaunch(quiz)}
                        disabled={relaunching === quiz.id}
                      >
                        {relaunching === quiz.id ? '...' : '↺ Relaunch'}
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      style={{ padding: '7px 12px', fontSize: 13 }}
                      onClick={() => handleDelete(quiz.id)}
                      title="Delete quiz"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
