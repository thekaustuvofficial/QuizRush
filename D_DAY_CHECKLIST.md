# QuizRush — D-Day Checklist
# Do these IN ORDER. Don't skip anything.

---

## 48 Hours Before

### Supabase
- [ ] Go to supabase.com → your project → Settings → Usage
- [ ] Confirm you are NOT near the free tier limits (500MB DB, 500 realtime connections)
- [ ] Run the full supabase_schema.sql one more time (safe, uses IF NOT EXISTS)
- [ ] Go to Database → Publications → confirm games, players, answers are in supabase_realtime
- [ ] Go to Auth → Settings → confirm "Enable email confirmations" is OFF
- [ ] Go to Settings → API → copy your URL and anon key — keep them safe

### App
- [ ] Run `npm run build` locally — must complete with zero errors
- [ ] Run `npm run preview` and test the full flow: create quiz → lobby → play → finish
- [ ] Test on your PHONE (not just desktop) — players will use phones
- [ ] Test with 2 browser tabs as 2 different players to confirm realtime sync works
- [ ] Test player rejoin: join as a player, refresh the tab mid-question, confirm you land back in the game

### Deploy
- [ ] Push to GitHub → Vercel auto-deploys
- [ ] On Vercel: Settings → Environment Variables → confirm VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set
- [ ] Visit your live Vercel URL and do a full test run on the deployed version
- [ ] Check that the URL is short and easy to type (set a custom domain on Vercel if needed)

---

## Day Before

- [ ] Create your quiz in the app — do NOT create it on the day
- [ ] Save the game PIN somewhere (it stays the same until you start)
- [ ] Do a dry run with 5-10 people if possible
- [ ] Prepare a backup: screenshot every question on your phone
- [ ] Charge all devices you'll use as host

---

## 1 Hour Before the Event

- [ ] Open the host dashboard on your laptop
- [ ] Confirm the quiz is showing as "In Lobby"
- [ ] Open the lobby on the projector screen — players should see the big PIN
- [ ] Have the join URL visible: your-app.vercel.app/join
- [ ] Turn off laptop sleep/screensaver
- [ ] Connect laptop to power (not battery)
- [ ] Connect to the venue WiFi — test it loads fast
- [ ] If venue WiFi is unreliable, hotspot from your phone for the HOST device only
  (players on venue WiFi is fine — only the host needs rock-solid connection)
- [ ] Open Supabase dashboard in another tab — you can monitor the players table live

---

## During the Event

- [ ] Project the lobby screen — show the PIN BIG
- [ ] Wait for all players to join before starting (watch the count)
- [ ] Start the game only when you're ready — the "Start Question" button is deliberate
- [ ] If a player can't connect: tell them to go to /join, enter PIN, use exact same nickname
      (they will rejoin and continue from current score)
- [ ] If the HOST tab crashes: re-open the same URL /host/:gameId/play
      The game state is in Supabase — nothing is lost
- [ ] Do NOT refresh during a live question — wait for reveal phase

---

## Emergency Procedures

### Player can't join
→ Check they're typing the PIN correctly (4 digits)
→ Check the game status is "lobby" not "playing" (late joiners can't join mid-game)
→ If game already started: they can't join — this is by design

### Host tab crashes mid-game
→ Re-open browser → go to your-app.vercel.app/dashboard
→ Click "Rejoin" on the active game
→ You're back exactly where you left off — no data lost

### Realtime seems frozen (no answer count updating)
→ Host: refresh the page → rejoin → the game row in DB still has correct state
→ Players: ask them to refresh — they will auto-rejoin

### Supabase free tier limit hit (very unlikely for 1 quiz)
→ Free tier = 500 realtime connections
→ 400 players + 1 host = 401 connections — well within limit
→ If you somehow hit it: upgrade to Supabase Pro ($25) — takes 2 minutes

### Total internet outage at venue
→ Nothing can save this — the app requires internet
→ Backup plan: run questions verbally from your phone screenshots

---

## After the Event

- [ ] Screenshot the final podium for social media
- [ ] Go to Supabase → Table Editor → players — you can export scores as CSV
- [ ] Your quiz stays in the dashboard — you can relaunch it for the next event
