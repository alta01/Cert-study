-- supabase/schema.sql — Cert Study accounts & progress schema
--
-- Run once in your Supabase project: SQL Editor → paste → Run.
-- Requires the Google auth provider to be enabled (Authentication → Providers).
--
-- Two tables, both protected by Row-Level Security so a signed-in user can only
-- ever read/write their own rows (auth.uid() = user_id). The anon key shipped to
-- the browser is therefore safe: RLS is the security boundary, not the key.

-- ── In-progress quiz sessions ──────────────────────────────────────────
-- One resumable session per (user, exam). Mirrors the localStorage session
-- shape used by app.js (saveSession/loadSession). Upserted on save.
create table if not exists public.quiz_sessions (
  user_id         uuid        not null references auth.users (id) on delete cascade,
  exam_code       text        not null,
  pool_ids        jsonb       not null,
  idx             integer     not null default 0,
  answers         jsonb       not null default '{}'::jsonb,
  settings        jsonb       not null default '{}'::jsonb,
  timer_remaining integer,
  saved_at        bigint      not null,           -- client Date.now() epoch ms
  updated_at      timestamptz not null default now(),
  primary key (user_id, exam_code)
);

-- ── Completed attempts (progress history) ──────────────────────────────
-- Insert-only log of finished quizzes. `id` is client-generated (crypto.randomUUID)
-- so re-syncing local history is idempotent (dedupe by primary key).
create table if not exists public.quiz_attempts (
  id           uuid        primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  exam_code    text        not null,
  exam_name    text,
  total        integer     not null,
  correct      integer     not null,
  pct          integer     not null,
  domains      jsonb       not null default '[]'::jsonb,  -- [{number,name,correct,total}]
  settings     jsonb,
  completed_at timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists quiz_attempts_user_exam_time_idx
  on public.quiz_attempts (user_id, exam_code, completed_at);

-- ── Row-Level Security ─────────────────────────────────────────────────
alter table public.quiz_sessions enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "own sessions" on public.quiz_sessions;
create policy "own sessions" on public.quiz_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own attempts" on public.quiz_attempts;
create policy "own attempts" on public.quiz_attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
