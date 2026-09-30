-- Monthly counter for paid web image searches, so the app can stop at a cap.
create table public.search_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, month)
);
alter table public.search_usage enable row level security;
create policy "owner full access" on public.search_usage for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.search_usage from anon;

-- Atomically take one search credit. Returns the new count, or NULL when the cap is already reached.
create or replace function public.take_search_credit(p_month text, p_limit integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.search_usage as u (month, count)
  values (p_month, 1)
  on conflict (user_id, month) do update set count = u.count + 1
    where u.count < p_limit
  returning u.count;
$$;
revoke all on function public.take_search_credit(text, integer) from public, anon;
grant execute on function public.take_search_credit(text, integer) to authenticated;
