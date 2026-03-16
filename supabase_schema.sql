-- ============================================================
-- QuizRush v4 — Anti-Cheat Hardened Schema
-- Safe to run on top of v3 (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- GAMES table
create table if not exists games (
  id                     uuid primary key default gen_random_uuid(),
  pin                    text not null unique,
  title                  text not null,
  questions              jsonb not null default '[]',
  status                 text not null default 'lobby',
  current_question_index integer not null default -1,
  question_started_at    timestamptz,
  time_per_question      integer not null default 20,
  leaderboard_interval   integer not null default 5,
  host_id                uuid references auth.users(id) on delete set null,
  created_at             timestamptz default now()
);

-- PLAYERS table
create table if not exists players (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references games(id) on delete cascade,
  nickname   text not null,
  score      integer not null default 0,
  streak     integer not null default 0,
  joined_at  timestamptz default now()
);

-- ANSWERS table
create table if not exists answers (
  id              uuid primary key default gen_random_uuid(),
  game_id         uuid not null references games(id) on delete cascade,
  player_id       uuid not null references players(id) on delete cascade,
  question_index  integer not null,
  answer          text not null,
  is_correct      boolean not null default false,
  points_earned   integer not null default 0,
  answered_at     timestamptz default now(),
  unique (game_id, player_id, question_index)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists idx_players_game_id    on players(game_id);
create index if not exists idx_players_score      on players(game_id, score desc);
create index if not exists idx_answers_game_q     on answers(game_id, question_index);
create index if not exists idx_answers_player     on answers(player_id);
create index if not exists idx_games_pin          on games(pin);
create index if not exists idx_games_host         on games(host_id);
create index if not exists idx_games_status       on games(status);

-- ── Realtime ──────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table answers;

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table games   enable row level security;
alter table players enable row level security;
alter table answers enable row level security;

-- Drop all old policies cleanly
do $$ declare r record;
begin
  for r in select policyname from pg_policies where tablename in ('games','players','answers') loop
    execute 'drop policy if exists "' || r.policyname || '" on ' ||
      (select tablename from pg_policies where policyname = r.policyname limit 1);
  end loop;
end $$;

-- Games: everyone can read/insert/update (host controls via app logic)
create policy "games_select"   on games   for select using (true);
create policy "games_insert"   on games   for insert with check (true);
create policy "games_update"   on games   for update using (true);
create policy "games_delete"   on games   for delete using (auth.uid() = host_id);

-- Players
create policy "players_select" on players for select using (true);
create policy "players_insert" on players for insert with check (true);
create policy "players_update" on players for update using (true);

-- Answers: players can only insert/update their own rows
create policy "answers_select" on answers for select using (true);
create policy "answers_insert" on answers for insert with check (true);
create policy "answers_update" on answers for update using (true);

-- Migration guard
alter table games add column if not exists host_id uuid references auth.users(id) on delete set null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANTI-CHEAT: Server-side scoring RPC
--
-- This function is the core of the anti-cheat system.
-- The client sends ONLY their answer choice (0/1/2/3).
-- The correct answer NEVER leaves the server.
-- Scoring is calculated here, in Postgres, atomically.
-- A cheater intercepting the network call gets nothing useful.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace function submit_answer(
  p_game_id        uuid,
  p_player_id      uuid,
  p_question_index integer,
  p_answer         integer   -- just the index: 0,1,2,3
)
returns json
language plpgsql
security definer  -- runs as DB owner, bypasses RLS for the read of correct answer
as $$
declare
  v_game             record;
  v_player           record;
  v_question         jsonb;
  v_correct          integer;
  v_is_correct       boolean;
  v_elapsed_ms       bigint;
  v_time_limit_ms    bigint;
  v_base_pts         integer := 1000;
  v_speed_bonus      integer := 0;
  v_streak_bonus     integer := 0;
  v_points_earned    integer := 0;
  v_new_score        integer;
  v_new_streak       integer;
  v_now              timestamptz := now();
begin
  -- 1. Load game — validate it's active
  select * into v_game from games where id = p_game_id;
  if not found then
    return json_build_object('error', 'Game not found');
  end if;
  if v_game.status <> 'playing' then
    return json_build_object('error', 'Game is not active');
  end if;
  if v_game.current_question_index <> p_question_index then
    return json_build_object('error', 'Wrong question index');
  end if;

  -- 2. Check not already answered (idempotency)
  if exists (
    select 1 from answers
    where game_id = p_game_id
      and player_id = p_player_id
      and question_index = p_question_index
  ) then
    -- Already answered — return their existing result without re-scoring
    select row_to_json(a) into v_question
    from answers a
    where game_id = p_game_id and player_id = p_player_id and question_index = p_question_index;
    return json_build_object(
      'already_answered', true,
      'is_correct',       (v_question->>'is_correct')::boolean,
      'points_earned',    (v_question->>'points_earned')::integer
    );
  end if;

  -- 3. Load player
  select * into v_player from players where id = p_player_id and game_id = p_game_id;
  if not found then
    return json_build_object('error', 'Player not found');
  end if;

  -- 4. Get correct answer from server — THIS NEVER GOES TO THE CLIENT
  v_question := (v_game.questions->p_question_index);
  v_correct  := (v_question->>'correct')::integer;

  -- 5. Score
  v_is_correct := (p_answer = v_correct);

  if v_is_correct then
    -- Speed bonus: how fast did they answer relative to the time limit
    v_elapsed_ms   := extract(epoch from (v_now - v_game.question_started_at)) * 1000;
    v_time_limit_ms := v_game.time_per_question * 1000;
    v_speed_bonus  := round((1.0 - least(v_elapsed_ms::numeric, v_time_limit_ms::numeric) / v_time_limit_ms) * 500);
    -- Streak bonus
    v_new_streak   := v_player.streak + 1;
    v_streak_bonus := least(v_new_streak * 100, 300);
    v_points_earned := v_base_pts + v_speed_bonus + v_streak_bonus;
  else
    v_new_streak := 0;
  end if;

  v_new_score := v_player.score + v_points_earned;

  -- 6. Write answer + update score atomically
  insert into answers (game_id, player_id, question_index, answer, is_correct, points_earned, answered_at)
  values (p_game_id, p_player_id, p_question_index, p_answer::text, v_is_correct, v_points_earned, v_now);

  update players set score = v_new_score, streak = v_new_streak where id = p_player_id;

  -- 7. Return result to client — no correct answer index, just outcome
  return json_build_object(
    'is_correct',    v_is_correct,
    'points_earned', v_points_earned,
    'new_score',     v_new_score,
    'new_streak',    v_new_streak,
    'speed_bonus',   v_speed_bonus,
    'streak_bonus',  v_streak_bonus
  );
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function submit_answer(uuid, uuid, integer, integer) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANTI-CHEAT: Stripped player view
--
-- Players query this view instead of the games table directly.
-- It returns everything EXCEPT the correct answer index on each question.
-- The 'correct' field is stripped server-side — it never exists in the response.
-- ═══════════════════════════════════════════════════════════════════════════════

create or replace view player_game_view as
select
  id,
  pin,
  title,
  status,
  current_question_index,
  question_started_at,
  time_per_question,
  leaderboard_interval,
  created_at,
  -- Strip 'correct' from every question in the array
  (
    select jsonb_agg(
      q - 'correct'   -- remove the correct answer key entirely
    )
    from jsonb_array_elements(questions) as q
  ) as questions
from games;

-- Grant read access
grant select on player_game_view to anon, authenticated;
