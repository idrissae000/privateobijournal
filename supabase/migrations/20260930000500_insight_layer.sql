-- Phase 2: automated insight layer (traits, scoring, reflections, archetype, flags, usage cap).
-- Everything here is additive. AI output lives in its own columns/tables and never overwrites
-- anything the user wrote.

-- 1. Traits per influence. `traits` = accepted by the user; `suggested_traits` = awaiting review.
alter table public.influences
  add column traits text[] not null default '{}',
  add column suggested_traits text[] not null default '{}',
  add column traits_confidence text check (traits_confidence in ('high', 'medium', 'low')),
  add column traits_status text not null default 'none'
    check (traits_status in ('none', 'pending', 'suggested', 'done', 'failed', 'skipped'));

-- 2. Daily in-character score + reflection (separate from the user's own note).
alter table public.entries
  add column character_score smallint check (character_score between 0 and 10),
  add column insight text,
  add column insight_status text not null default 'none'
    check (insight_status in ('none', 'pending', 'done', 'failed', 'skipped')),
  add column insight_hash text,
  add column insight_at timestamptz,
  add column analysis jsonb; -- { topics: [{topic, stance, evidence}], tone: [..], model }

-- 4. Per-influence fidelity: one row per scored (entry, influence) pair.
create table public.entry_influence_scores (
  entry_id uuid not null references public.entries(id) on delete cascade,
  influence_id uuid not null references public.influences(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  score smallint not null check (score between 0 and 10),
  note text,
  primary key (entry_id, influence_id)
);
create index entry_influence_scores_influence_idx on public.entry_influence_scores(influence_id);

-- 3. Month-end conclusion (alongside, never replacing, month_end_reflection).
alter table public.months
  add column ai_conclusion text,
  add column ai_conclusion_verdict text
    check (ai_conclusion_verdict in ('stayed_true', 'partly', 'drifted', 'not_enough_data')),
  add column ai_conclusion_status text not null default 'none'
    check (ai_conclusion_status in ('none', 'pending', 'done', 'failed', 'skipped')),
  add column ai_conclusion_at timestamptz;

-- 6/7/8/5. Generated reports: one row per kind, replaced in place.
create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('archetype', 'foreshadow', 'review')),
  content jsonb not null default '{}',
  fingerprint text,
  status text not null default 'done' check (status in ('pending', 'done', 'failed')),
  generated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- 5. Flags raised by the accuracy pass. Flags only: nothing is ever edited automatically.
create table public.ai_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  code text not null,
  severity text not null default 'info' check (severity in ('info', 'warn')),
  target_type text not null default 'general',
  target_id uuid,
  message text not null,
  suggestion text,
  dedupe_key text not null,
  status text not null default 'open' check (status in ('open', 'dismissed', 'resolved')),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- Daily cap on AI calls, enforced atomically in the database (same pattern as search_usage).
create table public.ai_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);

create or replace function public.take_ai_credit(p_day text, p_limit integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.ai_usage as u (day, count)
  values (p_day, 1)
  on conflict (user_id, day) do update set count = u.count + 1
    where u.count < p_limit
  returning u.count;
$$;
revoke all on function public.take_ai_credit(text, integer) from public, anon;
grant execute on function public.take_ai_credit(text, integer) to authenticated;

-- RLS: owner only, and nothing for anon.
do $$
declare t text;
begin
  foreach t in array array['entry_influence_scores', 'ai_reports', 'ai_flags', 'ai_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
