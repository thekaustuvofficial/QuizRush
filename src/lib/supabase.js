import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  document.getElementById('root').innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;font-family:sans-serif;color:#f1f0ff;text-align:center;padding:2rem;">
      <div>
        <div style="font-size:2.5rem;margin-bottom:1rem">⚠️</div>
        <h2 style="margin-bottom:0.75rem;font-size:1.4rem">Missing Supabase credentials</h2>
        <p style="color:#9898b8;margin-bottom:1.5rem;line-height:1.7">
          Create <code style="background:#1c1c26;padding:2px 8px;border-radius:4px">.env.local</code> with:<br/><br/>
          <code style="background:#1c1c26;padding:10px 20px;border-radius:6px;display:inline-block;text-align:left;line-height:2.2;font-size:13px">
            VITE_SUPABASE_URL=https://xxxx.supabase.co<br/>
            VITE_SUPABASE_ANON_KEY=eyJhbG...
          </code>
        </p>
        <p style="color:#5a5a7a;font-size:13px">Restart with <code style="background:#1c1c26;padding:2px 8px;border-radius:4px">npm run dev</code></p>
      </div>
    </div>`
  throw new Error('MISSING .env.local')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  db: { schema: 'public' },
})

// ─── RETRY WRAPPER ────────────────────────────────────────────────────────────
export async function withRetry(fn, attempts = 3, delayMs = 300) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn()
      if (result?.error) throw result.error
      return result
    } catch (err) {
      lastError = err
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)))
    }
  }
  throw lastError
}

// ─── GAME HELPERS (HOST) ──────────────────────────────────────────────────────
// Host always reads from games table directly — they need the correct answers

export async function createGame({ title, questions, leaderboard_interval, time_per_question, hostId }) {
  const pin = Math.floor(1000 + Math.random() * 9000).toString()
  const { data, error } = await supabase
    .from('games')
    .insert({
      pin, title, questions, leaderboard_interval, time_per_question,
      status: 'lobby', current_question_index: -1,
      host_id: hostId || null,
    })
    .select().single()
  if (error) throw error
  return data
}

export async function getGameByPin(pin) {
  // JOIN page uses this — pin lookup only needs non-sensitive fields
  const { data, error } = await supabase
    .from('player_game_view')   // stripped view — no correct answers
    .select('*')
    .eq('pin', pin)
    .single()
  if (error) throw error
  return data
}

// Host-only: load full game with correct answers intact
export async function getGameForHost(gameId) {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()
  if (error) throw error
  return data
}

// Player-only: load game WITHOUT correct answers
export async function getGameForPlayer(gameId) {
  const { data, error } = await supabase
    .from('player_game_view')   // stripped view
    .select('*')
    .eq('id', gameId)
    .single()
  if (error) throw error
  return data
}

export async function updateGameStatus(gameId, status) {
  const { error } = await supabase.from('games').update({ status }).eq('id', gameId)
  if (error) throw error
}

export async function setCurrentQuestion(gameId, index, started_at) {
  const { error } = await supabase
    .from('games')
    .update({ current_question_index: index, question_started_at: started_at, status: 'playing' })
    .eq('id', gameId)
  if (error) throw error
}

export async function endGame(gameId) {
  const { error } = await supabase.from('games').update({ status: 'finished' }).eq('id', gameId)
  if (error) throw error
}

// ─── PLAYER HELPERS ───────────────────────────────────────────────────────────

export async function joinGame(gameId, nickname) {
  const { data, error } = await supabase
    .from('players')
    .insert({ game_id: gameId, nickname, score: 0, streak: 0 })
    .select().single()
  if (error) throw error
  return data
}

export async function rejoinGame(gameId, playerId) {
  const { data } = await supabase
    .from('players').select('*').eq('id', playerId).eq('game_id', gameId).single()
  return data || null
}

export async function getPlayers(gameId) {
  const { data, error } = await supabase
    .from('players').select('*').eq('game_id', gameId).order('score', { ascending: false })
  if (error) throw error
  return data
}

// ─── SERVER-SIDE SCORING (ANTI-CHEAT CORE) ───────────────────────────────────
// The client sends ONLY the answer index (0-3).
// The Postgres RPC function reads the correct answer server-side,
// calculates points, and writes everything atomically.
// The correct answer NEVER leaves the database.

export async function submitAnswerSecure({ gameId, playerId, questionIndex, answer }) {
  const { data, error } = await supabase.rpc('submit_answer', {
    p_game_id:        gameId,
    p_player_id:      playerId,
    p_question_index: questionIndex,
    p_answer:         answer,   // integer 0-3 only
  })
  if (error) throw error
  // data = { is_correct, points_earned, new_score, new_streak, speed_bonus, streak_bonus }
  // OR    = { error: "message" }
  // OR    = { already_answered: true, is_correct, points_earned }
  if (data?.error) throw new Error(data.error)
  return data
}

// ─── ANSWER LOOKUP (for rejoin) ───────────────────────────────────────────────
// Returns only the player's own answer result — NOT the correct answer
export async function getMyAnswer(gameId, playerId, questionIndex) {
  const { data } = await supabase
    .from('answers')
    .select('answer, is_correct, points_earned')  // no 'correct' field — that's in games table
    .eq('game_id', gameId)
    .eq('player_id', playerId)
    .eq('question_index', questionIndex)
    .single()
  return data || null
}
