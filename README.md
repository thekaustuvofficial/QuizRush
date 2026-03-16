# QuizRush 🎯

Live MCQ quiz platform for campus events. Supports 250+ simultaneous players with real-time leaderboards, speed scoring, and streak bonuses. **100% free to run.**

---

## Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast, modern |
| Routing | React Router v6 | Clean SPA routing |
| Realtime | Supabase Realtime | WebSocket pub/sub, 500 free connections |
| Database | Supabase PostgreSQL | Free, serverless |
| Hosting | Vercel | Free, auto-deploy from GitHub |

---

## Setup in 5 minutes

### 1. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project (free tier)
2. Note your **Project URL** and **anon/public API key** from Settings → API

### 2. Run the database schema
1. In your Supabase dashboard → SQL Editor → New query
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**

### 3. Enable Realtime
1. Supabase dashboard → Database → Replication
2. Toggle ON: `games`, `players`, `answers`

### 4. Configure environment
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run locally
```bash
npm install
npm run dev
```
Open http://localhost:5173

---

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```
Set environment variables in Vercel dashboard → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## How to Run a Game

1. **Host:** Go to your deployed URL → **Host a Game**
2. Build your quiz (questions, timer, leaderboard interval)
3. Click **Launch Quiz** → you'll get a **4-digit PIN**
4. **Players:** Go to the URL → **Join a Game** → enter PIN + nickname
5. Host clicks **Start Game** → questions begin
6. Leaderboard auto-shows every N questions (configurable)

---

## Scoring System

| Event | Points |
|---|---|
| Correct answer | 1000 base |
| Speed bonus | Up to +500 (faster = more) |
| Streak bonus | +100 per consecutive correct (max +300) |
| Wrong answer | 0 |

---

## Capacity

Supabase free tier supports **500 concurrent Realtime connections** — comfortably handles 250 players + 1 host with headroom.

For larger events, upgrade to Supabase Pro ($25/month) which supports 10,000 concurrent connections.

---

## File Structure

```
src/
  pages/
    Home.jsx          # Landing page
    CreateGame.jsx    # Quiz builder
    HostLobby.jsx     # Waiting room with live player feed
    HostGame.jsx      # Host control panel (questions, reveal, leaderboard)
    Join.jsx          # Player PIN + nickname entry
    PlayerGame.jsx    # Player answer screen + real-time feedback
    NotFound.jsx
  lib/
    supabase.js       # All DB helpers + scoring logic
  index.css           # Global design system
  App.jsx             # Routes
  main.jsx            # Entry point
supabase_schema.sql   # Database setup (run once)
.env.example          # Environment template
```
