-- Monthly spending ledger + atomic budget reservation, and stored opinions.
-- Money is tracked in micro-dollars (1 USD = 1,000,000), which is exactly (tokens x $/MTok).

create table public.ai_spend (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  kind text not null check (kind in ('reads', 'sheet', 'opinions', 'traits', 'conclusions', 'foreshadow', 'review', 'reserve')),
  micro_usd bigint not null default 0 check (micro_usd >= 0),
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, month, kind)
);

-- One row per finished Claude call: the receipts that the monthly totals must add up to.
create table public.ai_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  month text not null,
  kind text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_micro bigint not null default 0,
  ok boolean not null default true
);
create index ai_ledger_month_idx on public.ai_ledger(user_id, month, at desc);

-- Claude's opinion of a month's (or a character's) breakdown. One row per subject, replaced in place.
create table public.ai_opinions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject_type text not null check (subject_type in ('month', 'character')),
  subject_id uuid not null,
  content jsonb not null default '{}',
  fingerprint text,
  status text not null default 'done' check (status in ('pending', 'done', 'failed')),
  generated_at timestamptz not null default now(),
  unique (user_id, subject_type, subject_id)
);

-- Atomically reserve `p_estimate` against BOTH the category limit and the overall monthly limit.
-- Returns the category's new reserved total, or NULL when either limit would be exceeded (nothing is reserved).
create or replace function public.reserve_ai_budget(
  p_month text, p_kind text, p_estimate bigint, p_kind_limit bigint, p_total_limit bigint
) returns bigint
language sql
security invoker
set search_path = ''
as $$
  with total as (
    select coalesce(sum(micro_usd), 0) as spent from public.ai_spend where month = p_month
  )
  insert into public.ai_spend as s (month, kind, micro_usd, calls)
  select p_month, p_kind, p_estimate, 1
  from total
  where total.spent + p_estimate <= p_total_limit and p_estimate <= p_kind_limit
  on conflict (user_id, month, kind) do update
    set micro_usd = s.micro_usd + p_estimate, calls = s.calls + 1
    where s.micro_usd + p_estimate <= p_kind_limit
      and (select coalesce(sum(micro_usd), 0) from public.ai_spend where month = p_month) + p_estimate <= p_total_limit
  returning s.micro_usd;
$$;

-- Settle a reservation against what the call really cost (negative delta = refund).
create or replace function public.adjust_ai_spend(p_month text, p_kind text, p_delta bigint)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  update public.ai_spend
  set micro_usd = greatest(0, micro_usd + p_delta)
  where month = p_month and kind = p_kind
  returning micro_usd;
$$;

revoke all on function public.reserve_ai_budget(text, text, bigint, bigint, bigint) from public, anon;
revoke all on function public.adjust_ai_spend(text, text, bigint) from public, anon;
grant execute on function public.reserve_ai_budget(text, text, bigint, bigint, bigint) to authenticated;
grant execute on function public.adjust_ai_spend(text, text, bigint) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['ai_spend', 'ai_ledger', 'ai_opinions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner full access" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
