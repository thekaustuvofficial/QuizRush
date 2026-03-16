import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createGame } from '../lib/supabase'

const OPTION_LABELS = ['A', 'B', 'C', 'D']

function emptyQuestion() {
  return { id: Date.now() + Math.random(), text: '', options: ['', '', '', ''], correct: 0 }
}

export default function CreateGame() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([emptyQuestion()])
  const [timePer, setTimePer] = useState(20)
  const [lbInterval, setLbInterval] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function addQuestion() { setQuestions(q => [...q, emptyQuestion()]) }
  function removeQuestion(idx) { if (questions.length > 1) setQuestions(q => q.filter((_, i) => i !== idx)) }
  function updateQuestion(idx, field, value) { setQuestions(q => q.map((qq, i) => i === idx ? { ...qq, [field]: value } : qq)) }
  function updateOption(qIdx, oIdx, value) {
    setQuestions(q => q.map((qq, i) => {
      if (i !== qIdx) return qq
      const opts = [...qq.options]; opts[oIdx] = value; return { ...qq, options: opts }
    }))
  }

  async function handleCreate() {
    setError('')
    if (!user) return nav('/auth')
    if (!title.trim()) return setError('Give your quiz a title.')
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (!q.text.trim()) return setError(`Question ${i + 1} has no text.`)
      if (q.options.some(o => !o.trim())) return setError(`All 4 options in question ${i + 1} must be filled.`)
    }
    try {
      setLoading(true)
      const game = await createGame({ title: title.trim(), questions, leaderboard_interval: lbInterval, time_per_question: timePer, hostId: user.id })
      nav(`/host/${game.id}`)
    } catch (e) {
      setError('Failed to create game: ' + (e.message || 'Check your Supabase config.'))
    } finally { setLoading(false) }
  }

  return (
    <div className="grain" style={{ minHeight: '100vh', padding: '2rem 1rem', position: 'relative', overflow: 'hidden' }}>
      <div className="glow-orb" style={{ width: 400, height: 400, background: 'rgba(124,108,252,0.1)', top: -100, right: -80 }} />
      <div style={{ maxWidth: 700, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '2rem' }}>
          <button className="btn btn-ghost" style={{ padding: '8px 14px' }} onClick={() => nav(user ? '/dashboard' : '/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </button>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 24, fontWeight: 800 }}>Create Quiz</h1>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem', animation: 'fadeUp 0.3s ease both' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label className="label">Quiz Title</label>
              <input className="input" placeholder="e.g. CSE Trivia Battle — Semester 4" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label className="label">Time per question</label>
                <select className="input" value={timePer} onChange={e => setTimePer(Number(e.target.value))}>
                  {[10, 15, 20, 30, 45, 60].map(t => <option key={t} value={t}>{t} seconds</option>)}
                </select>
              </div>
              <div>
                <label className="label">Show leaderboard every</label>
                <select className="input" value={lbInterval} onChange={e => setLbInterval(Number(e.target.value))}>
                  {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>Every {n} {n === 1 ? 'question' : 'questions'}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.map((q, qIdx) => (
            <div key={q.id} className="card" style={{ animation: 'fadeUp 0.3s ease both', animationDelay: `${qIdx * 0.04}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 14, color: 'var(--accent2)' }}>Q{qIdx + 1}</span>
                {questions.length > 1 && (
                  <button className="btn btn-danger" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => removeQuestion(qIdx)}>Remove</button>
                )}
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label">Question</label>
                <textarea className="input" style={{ resize: 'vertical', minHeight: 72 }} placeholder="Type your question here..." value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => updateQuestion(qIdx, 'correct', oIdx)}
                      title="Mark as correct"
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0, cursor: 'pointer',
                        background: q.correct === oIdx ? 'var(--accent-g)' : 'var(--surface3)',
                        color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font-head)',
                        transition: 'all 0.15s',
                        boxShadow: q.correct === oIdx ? '0 0 12px rgba(124,108,252,0.4)' : 'none',
                      }}
                    >{OPTION_LABELS[oIdx]}</button>
                    <input className="input" style={{ flex: 1 }} placeholder={`Option ${OPTION_LABELS[oIdx]}`} value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                Tap a letter to mark correct (currently: <strong style={{ color: 'var(--accent2)' }}>{OPTION_LABELS[q.correct]}</strong>)
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem', paddingBottom: '3rem' }}>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={addQuestion}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Question
          </button>
          {error && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'var(--red)', fontSize: 14 }}>{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', fontSize: 16, padding: '15px' }} onClick={handleCreate} disabled={loading}>
            {loading ? 'Creating...' : `Launch Quiz (${questions.length} question${questions.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  )
}
